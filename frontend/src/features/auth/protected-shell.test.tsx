import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./auth-provider";
import { ProtectedShell } from "./protected-shell";

const navigation = vi.hoisted(() => ({
  pathname: "/expenses",
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ProtectedShell", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
    navigation.push.mockReset();
    navigation.replace.mockReset();
    window.history.replaceState({}, "", "/expenses?category=food");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("waits for bootstrap before redirecting an anonymous user", async () => {
    let resolveRefresh: ((response: Response) => void) | undefined;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf" }))
        .mockReturnValueOnce(refreshResponse),
    );

    render(
      <AuthProvider>
        <ProtectedShell>
          <p>Private content</p>
        </ProtectedShell>
      </AuthProvider>,
    );

    expect(screen.getByText("Restoring your session…")).toBeVisible();
    expect(navigation.replace).not.toHaveBeenCalled();

    resolveRefresh?.(
      jsonResponse({ error: { code: "authentication_failed", message: "Missing" } }, 401),
    );

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(
        "/login?next=%2Fexpenses%3Fcategory%3Dfood",
      ),
    );
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it("renders protected content only after restoration succeeds", async () => {
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
        <ProtectedShell>
          <p>Private content</p>
        </ProtectedShell>
      </AuthProvider>,
    );

    expect(await screen.findByText("Private content")).toBeVisible();
    expect(screen.getByText("person@example.com")).toBeVisible();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("logs out through the backend, clears memory, and routes to login", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf" }))
      .mockResolvedValueOnce(jsonResponse({ access: "access" }))
      .mockResolvedValueOnce(
        jsonResponse({ user: { id: 1, email: "person@example.com" } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <ProtectedShell>
          <p>Private content</p>
        </ProtectedShell>
      </AuthProvider>,
    );
    const signOut = await screen.findByRole("button", { name: "Sign out" });

    await user.click(signOut);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login"));
    expect(String(fetchMock.mock.calls[3]?.[0]).endsWith("/auth/logout")).toBe(true);
  });
});
