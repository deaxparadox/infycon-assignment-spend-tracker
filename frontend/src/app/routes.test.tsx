import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ProtectedError from "./(protected)/error";
import ProtectedLoading from "./(protected)/loading";
import ErrorBoundary from "./error";
import Loading from "./loading";
import NotFound from "./not-found";
import Home from "./page";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));

describe("route boundaries", () => {
  it("redirects the root route to the summary", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/summary");
  });

  it("provides root and protected loading states", () => {
    const { rerender } = render(<Loading />);
    expect(screen.getByText("Loading…")).toBeVisible();

    rerender(<ProtectedLoading />);
    expect(screen.getByText("Loading your spending data…")).toBeVisible();
  });

  it("provides a not-found route", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Return to the summary" })).toHaveAttribute(
      "href",
      "/summary",
    );
  });

  it("lets root and protected error boundaries retry", async () => {
    const user = userEvent.setup();
    const resetRoot = vi.fn();
    const { rerender } = render(
      <ErrorBoundary error={new Error("failure")} reset={resetRoot} />,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(resetRoot).toHaveBeenCalledOnce();

    const resetProtected = vi.fn();
    rerender(<ProtectedError reset={resetProtected} />);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(resetProtected).toHaveBeenCalledOnce();
  });
});
