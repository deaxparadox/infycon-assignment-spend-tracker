import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import { ExpenseForm } from "./expense-form";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ api: { request: mocks.request } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

describe("ExpenseForm", () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.push.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function completeForm(amount = " 00125.50 ") {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Amount"), amount);
    await user.type(screen.getByLabelText("Category"), "Food");
    await user.type(screen.getByLabelText("Note (optional)"), "Lunch");
    return user;
  }

  it("sends the normalized amount as a string and routes with visible success state", async () => {
    mocks.request.mockResolvedValue({ id: 1 });
    render(<ExpenseForm />);
    const user = await completeForm();

    await user.click(screen.getByRole("button", { name: "Save expense" }));

    await waitFor(() => expect(mocks.request).toHaveBeenCalledOnce());
    const [, options] = mocks.request.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(options.body)) as Record<string, unknown>;
    expect(body.amount).toBe("00125.50");
    expect(typeof body.amount).toBe("string");
    expect(body.category).toBe("Food");
    expect(mocks.push).toHaveBeenCalledWith("/expenses?created=1");
  });

  it("maps backend general and field errors", async () => {
    mocks.request.mockRejectedValue(
      new ApiError({
        status: 400,
        code: "invalid",
        message: "The request contains invalid values.",
        fields: { amount: ["Amount is too large."] },
      }),
    );
    render(<ExpenseForm />);
    const user = await completeForm("999999999999999.00");

    await user.click(screen.getByRole("button", { name: "Save expense" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The request contains invalid values.",
    );
    expect(screen.getByText("Amount is too large.")).toBeVisible();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("rejects invalid amount shape before calling the API", async () => {
    render(<ExpenseForm />);
    const user = await completeForm("1.001");

    await user.click(screen.getByRole("button", { name: "Save expense" }));

    expect(
      screen.getByText("Enter a positive amount with at most two decimal places."),
    ).toBeVisible();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
