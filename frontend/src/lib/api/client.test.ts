import { describe, expect, it, vi } from "vitest";

import { ApiClient, ApiError } from "./client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ApiClient", () => {
  it("coordinates concurrent unauthorized requests through one refresh", async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        await Promise.resolve();
        return jsonResponse({ access: "renewed-access" });
      }
      if (url.endsWith("/expenses")) {
        const authorization = new Headers(init?.headers).get("Authorization");
        return authorization === "Bearer renewed-access"
          ? jsonResponse({ results: [] })
          : jsonResponse({ error: { code: "token_not_valid", message: "Expired" } }, 401);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const client = new ApiClient({
      baseUrl: "https://api.example.test",
      fetchImplementation: fetchMock as typeof fetch,
    });
    client.adoptSession("expired-access", "csrf-token");

    const [first, second] = await Promise.all([
      client.request<{ results: unknown[] }>("/expenses"),
      client.request<{ results: unknown[] }>("/expenses"),
    ]);

    expect(first.results).toEqual([]);
    expect(second.results).toEqual([]);
    expect(refreshCalls).toBe(1);
  });

  it("retries an original request at most once", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse({ access: "renewed-access" });
      }
      protectedCalls += 1;
      return jsonResponse(
        { error: { code: "not_authenticated", message: "Unauthorized" } },
        401,
      );
    });
    const client = new ApiClient({
      baseUrl: "https://api.example.test",
      fetchImplementation: fetchMock as typeof fetch,
    });
    client.adoptSession("expired-access", "csrf-token");

    await expect(client.request("/expenses")).rejects.toBeInstanceOf(ApiError);
    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  it("does not recursively refresh an auth request", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { error: { code: "authentication_failed", message: "Invalid credentials" } },
        401,
      ),
    );
    const client = new ApiClient({
      baseUrl: "https://api.example.test",
      fetchImplementation: fetchMock as typeof fetch,
    });

    await expect(
      client.request("/auth/login", {
        auth: false,
        retryOnUnauthorized: false,
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("clears memory after terminal refresh failure", async () => {
    const onSessionCleared = vi.fn();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return url.endsWith("/auth/refresh")
        ? jsonResponse({ error: { code: "token_not_valid", message: "Invalid" } }, 401)
        : jsonResponse({ error: { code: "not_authenticated", message: "Expired" } }, 401);
    });
    const client = new ApiClient({
      baseUrl: "https://api.example.test",
      fetchImplementation: fetchMock as typeof fetch,
      onSessionCleared,
    });
    client.adoptSession("expired-access", "csrf-token");

    await expect(client.request("/expenses")).rejects.toMatchObject({ status: 401 });
    expect(onSessionCleared).toHaveBeenCalledOnce();
  });

  it("adds credentials only to cookie-relevant requests", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return jsonResponse({ ok: true });
      },
    );
    const client = new ApiClient({
      baseUrl: "https://api.example.test",
      fetchImplementation: fetchMock as typeof fetch,
    });

    await client.request("/public", { auth: false });
    await client.request("/cookie", { auth: false, cookie: true });

    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty("credentials");
    expect(fetchMock.mock.calls[1]?.[1]).toHaveProperty("credentials", "include");
  });

  it("preserves abort errors without turning them into auth failures", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    const client = new ApiClient({
      baseUrl: "https://api.example.test",
      fetchImplementation: vi.fn(async () => {
        throw abortError;
      }) as typeof fetch,
    });

    await expect(
      client.request("/expenses", { signal: new AbortController().signal }),
    ).rejects.toBe(abortError);
  });

  it("does not lose Window binding when falling back to the global fetch", async () => {
    const brandedFetch = function (this: unknown) {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    };
    vi.stubGlobal("fetch", brandedFetch);

    try {
      const client = new ApiClient({ baseUrl: "https://api.example.test" });
      await expect(client.request("/public", { auth: false })).resolves.toEqual({
        ok: true,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("parses backend field errors into a typed ApiError", async () => {
    const client = new ApiClient({
      baseUrl: "https://api.example.test",
      fetchImplementation: vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "invalid",
              message: "Invalid values",
              fields: { email: ["Already registered"] },
            },
          },
          400,
        ),
      ) as typeof fetch,
    });

    await expect(client.request("/auth/register", { auth: false })).rejects.toMatchObject({
      status: 400,
      code: "invalid",
      fields: { email: ["Already registered"] },
    });
  });
});
