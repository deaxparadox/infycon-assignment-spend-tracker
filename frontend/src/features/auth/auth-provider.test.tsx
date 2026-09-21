import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./auth-provider";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function Status() {
  const { state } = useAuth();
  return (
    <p>
      {state.status}
      {state.status === "authenticated" ? `:${state.user.email}` : ""}
    </p>
  );
}

describe("AuthProvider bootstrap", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("restores an authenticated session through csrf, refresh, and me", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf" }))
      .mockResolvedValueOnce(jsonResponse({ access: "access" }))
      .mockResolvedValueOnce(
        jsonResponse({ user: { id: 1, email: "person@example.com" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <Status />
      </AuthProvider>,
    );

    expect(await screen.findByText("authenticated:person@example.com")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("treats a normal missing refresh session as anonymous", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf" }))
        .mockResolvedValueOnce(
          jsonResponse({ error: { code: "authentication_failed", message: "Missing" } }, 401),
        ),
    );

    render(
      <AuthProvider>
        <Status />
      </AuthProvider>,
    );

    expect(await screen.findByText("anonymous")).toBeVisible();
  });

  it("keeps a retryable error distinct from anonymous state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network unavailable")));

    render(
      <AuthProvider>
        <Status />
      </AuthProvider>,
    );

    expect(await screen.findByText("error")).toBeVisible();
    expect(screen.queryByText("anonymous")).not.toBeInTheDocument();
  });

  it("never writes access tokens to browser storage", async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf" }))
        .mockResolvedValueOnce(jsonResponse({ access: "access" }))
        .mockResolvedValueOnce(
          jsonResponse({ user: { id: 1, email: "person@example.com" } }),
        ),
    );

    render(
      <AuthProvider>
        <Status />
      </AuthProvider>,
    );

    await screen.findByText("authenticated:person@example.com");
    expect(localStorageSpy).not.toHaveBeenCalled();
  });
});
