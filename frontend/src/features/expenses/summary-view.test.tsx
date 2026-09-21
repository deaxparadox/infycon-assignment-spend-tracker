import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MonthlySummary } from "@/lib/api/contracts";

import { currentLocalMonth, SummaryView } from "./summary-view";

const mocks = vi.hoisted(() => ({ request: vi.fn(), push: vi.fn(), replace: vi.fn() }));

vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ api: { request: mocks.request } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));

const summary: MonthlySummary = {
  month: "2026-09",
  total: "1234.50",
  previous_month_total: "0.00",
  month_over_month_percentage: null,
  spend_by_category: [{ category: "food", amount: "1234.50" }],
  insights: [
    {
      type: "category_increase",
      category: "food",
      current_amount: "1234.50",
      previous_amount: "1000.00",
      percentage: "23.45",
      message: "food spending increased by 23.45% compared with the previous month.",
    },
    {
      type: "new_category_spend",
      category: "travel",
      current_amount: "20.00",
      previous_amount: "0.00",
      percentage: null,
      message: "New spending in travel this month.",
    },
  ],
};

describe("SummaryView", () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.push.mockReset();
    mocks.replace.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("makes an absent month explicit in the URL before fetching", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 21, 12));
    render(<SummaryView queryString="" />);

    expect(mocks.replace).toHaveBeenCalledWith("/summary?month=2026-09");
    expect(mocks.request).not.toHaveBeenCalled();
    expect(currentLocalMonth()).toBe("2026-09");
  });

  it("updates the selected month through the URL", async () => {
    mocks.request.mockResolvedValue(summary);
    const user = userEvent.setup();
    render(<SummaryView queryString="month=2026-09" />);
    await screen.findAllByText("1,234.50");

    const month = screen.getByLabelText("Month");
    await user.clear(month);
    await user.type(month, "2026-10");
    await user.click(screen.getByRole("button", { name: "View month" }));

    expect(mocks.push).toHaveBeenCalledWith("/summary?month=2026-10");
  });

  it("renders backend totals, null percentage, and both insight types", async () => {
    mocks.request.mockResolvedValue(summary);
    render(<SummaryView queryString="month=2026-09" />);

    expect(await screen.findAllByText("1,234.50")).toHaveLength(2);
    expect(screen.getByText("Unavailable (no previous-month spend)")).toBeVisible();
    expect(screen.getByText(/food spending increased by 23.45%/)).toBeVisible();
    expect(screen.getByText(/New spending in travel this month/)).toBeVisible();
  });

  it("shows a loading state while waiting for the backend", () => {
    mocks.request.mockReturnValue(new Promise(() => undefined));
    render(<SummaryView queryString="month=2026-09" />);
    expect(screen.getByText("Loading summary…")).toBeVisible();
  });
});
