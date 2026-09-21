import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { ExpenseListResponse } from "@/lib/api/contracts";

import { ExpenseListView } from "./expense-list-view";

const mocks = vi.hoisted(() => ({ request: vi.fn(), push: vi.fn() }));

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ api: { request: mocks.request } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const emptyResponse: ExpenseListResponse = {
  count: 0,
  limit: 20,
  offset: 0,
  results: [],
};

describe("ExpenseListView", () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.push.mockReset();
  });

  it("initializes filters from the URL and writes applied and cleared state back", async () => {
    mocks.request.mockResolvedValue(emptyResponse);
    const user = userEvent.setup();
    render(
      <ExpenseListView queryString="category=food&start_date=2026-09-01&limit=10" />,
    );
    expect(screen.getByLabelText("Category")).toHaveValue("food");
    expect(screen.getByLabelText("From")).toHaveValue("2026-09-01");

    await user.clear(screen.getByLabelText("Category"));
    await user.type(screen.getByLabelText("Category"), "travel");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(mocks.push).toHaveBeenCalledWith(
      "/expenses?category=travel&start_date=2026-09-01&limit=10",
    );
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(mocks.push).toHaveBeenCalledWith("/expenses");
  });

  it("preserves filters while paginating", async () => {
    mocks.request.mockResolvedValue({
      count: 5,
      limit: 2,
      offset: 0,
      results: [
        {
          id: 1,
          amount: "1000.00",
          category: "food",
          note: "",
          date: "2026-09-01",
          created_at: "",
          updated_at: "",
        },
        {
          id: 2,
          amount: "2.50",
          category: "food",
          note: "Lunch",
          date: "2026-09-02",
          created_at: "",
          updated_at: "",
        },
      ],
    });
    const user = userEvent.setup();
    render(<ExpenseListView queryString="category=food&limit=2" />);

    expect(await screen.findByText("1,000.00")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(mocks.push).toHaveBeenCalledWith("/expenses?category=food&limit=2&offset=2");
  });

  it("uses distinct unfiltered and filtered empty states", async () => {
    mocks.request.mockResolvedValue(emptyResponse);
    const { unmount } = render(<ExpenseListView queryString="" />);
    expect(
      await screen.findByText("No expenses yet. Add your first expense to get started."),
    ).toBeVisible();
    unmount();

    render(<ExpenseListView queryString="category=missing" />);
    expect(await screen.findByText("No expenses match the selected filters.")).toBeVisible();
  });

  it("shows creation success without forwarding the UI-only parameter", async () => {
    mocks.request.mockResolvedValue(emptyResponse);
    render(<ExpenseListView queryString="created=1" />);

    expect(screen.getByText("Expense added successfully.")).toBeVisible();
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith("/expenses", expect.anything()));
  });

  it.each([
    [
      new ApiError({ status: 400, code: "invalid", message: "Invalid", fields: { limit: ["Invalid limit"] } }),
      "Invalid limit",
    ],
    [
      new ApiError({ status: 401, code: "not_authenticated", message: "Expired" }),
      "Your session has expired. Redirecting to sign in…",
    ],
    [
      new ApiError({ status: 500, code: "server_error", message: "Failed" }),
      "The server could not complete this request. Please retry.",
    ],
    [new TypeError("Network error"), "The API could not be reached. Check your connection and retry."],
  ])("shows a distinct failure for %s", async (error, expected) => {
    mocks.request.mockRejectedValue(error);
    render(<ExpenseListView queryString="limit=bad" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
  });

  it("shows loading while the API request is pending", () => {
    mocks.request.mockReturnValue(new Promise(() => undefined));
    render(<ExpenseListView queryString="" />);
    expect(screen.getByText("Loading expenses…")).toBeVisible();
  });
});
