import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./auth-provider";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("authentication forms", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
    router.push.mockReset();
    router.replace.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps login general and field errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf" }))
        .mockResolvedValueOnce(
          jsonResponse({ error: { code: "authentication_failed", message: "Missing" } }, 401),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              error: {
                code: "invalid",
                message: "The request contains invalid values.",
                fields: { email: ["Enter a valid email address."] },
              },
            },
            400,
          ),
        ),
    );
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <LoginForm
          nextPath="/expenses"
          registrationComplete={false}
          logoutIncomplete={false}
        />
      </AuthProvider>,
    );
    const submit = screen.getByRole("button", { name: "Sign in" });
    await waitFor(() => expect(submit).toBeEnabled());

    await user.type(screen.getByLabelText("Email"), "invalid@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The request contains invalid values.",
    );
    expect(screen.getByText("Enter a valid email address.")).toBeVisible();
    expect(router.replace).not.toHaveBeenCalledWith("/expenses");
  });

  it("registers without assuming a token and routes to login", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf" }))
        .mockResolvedValueOnce(
          jsonResponse({ error: { code: "authentication_failed", message: "Missing" } }, 401),
        )
        .mockResolvedValueOnce(
          jsonResponse({ user: { id: 1, email: "person@example.com" } }, 201),
        ),
    );
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <RegisterForm />
      </AuthProvider>,
    );
    const submit = screen.getByRole("button", { name: "Create account" });
    await waitFor(() => expect(submit).toBeEnabled());

    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password", { exact: true }), "password-123");
    await user.type(screen.getByLabelText("Confirm password"), "password-123");
    await user.click(submit);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login?registered=1"));
  });
});
