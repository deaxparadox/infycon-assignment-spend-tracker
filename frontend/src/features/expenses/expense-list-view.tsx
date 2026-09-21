"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import type { ExpenseListResponse } from "@/lib/api/contracts";
import { formatAmount } from "@/lib/money/format";

import { classifyViewFailure, ViewError, type ViewFailure } from "./view-error";

type ListState =
  | { status: "success"; key: string; data: ExpenseListResponse }
  | { status: "error"; key: string; failure: ViewFailure };

const FILTER_KEYS = ["category", "start_date", "end_date"] as const;

export function ExpenseListView({ queryString }: { queryString: string }) {
  const { api } = useAuth();
  const router = useRouter();
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<ListState | null>(null);
  const params = useMemo(() => new URLSearchParams(queryString), [queryString]);
  const hasFilters = FILTER_KEYS.some((key) => Boolean(params.get(key)));
  const created = params.get("created") === "1";
  const requestKey = `${queryString}:${retryCount}`;
  const state = result?.key === requestKey ? result : { status: "loading" as const };

  useEffect(() => {
    const controller = new AbortController();
    const apiParams = new URLSearchParams(queryString);
    apiParams.delete("created");
    const suffix = apiParams.toString();
    void api
      .request<ExpenseListResponse>(`/expenses${suffix ? `?${suffix}` : ""}`, {
        signal: controller.signal,
      })
      .then((data) => setResult({ status: "success", key: requestKey, data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setResult({
          status: "error",
          key: requestKey,
          failure: classifyViewFailure(error),
        });
      });
    return () => controller.abort();
  }, [api, queryString, requestKey]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = String(form.get(key) ?? "").trim();
      if (value) {
        next.set(key, value);
      }
    }
    const limit = params.get("limit");
    if (limit) {
      next.set("limit", limit);
    }
    router.push(`/expenses${next.size ? `?${next}` : ""}`);
  }

  function navigatePage(offset: number, limit: number) {
    const next = new URLSearchParams(queryString);
    next.delete("created");
    next.set("limit", String(limit));
    if (offset > 0) {
      next.set("offset", String(offset));
    } else {
      next.delete("offset");
    }
    router.push(`/expenses?${next}`);
  }

  return (
    <section>
      <div className="section-heading">
        <h1>Expenses</h1>
        <Link className="button-link" href="/expenses/new">
          Add expense
        </Link>
      </div>
      {created ? (
        <p className="success-message" role="status">
          Expense added successfully.
        </p>
      ) : null}
      <form className="filter-form" onSubmit={applyFilters}>
        <label htmlFor="category">Category</label>
        <input id="category" name="category" defaultValue={params.get("category") ?? ""} />
        <label htmlFor="start_date">From</label>
        <input
          id="start_date"
          name="start_date"
          type="date"
          defaultValue={params.get("start_date") ?? ""}
        />
        <label htmlFor="end_date">To</label>
        <input
          id="end_date"
          name="end_date"
          type="date"
          defaultValue={params.get("end_date") ?? ""}
        />
        <button type="submit">Apply filters</button>
        <button type="button" onClick={() => router.push("/expenses")}>
          Clear filters
        </button>
      </form>

      {state.status === "loading" ? <p className="view-message">Loading expenses…</p> : null}
      {state.status === "error" ? (
        <ViewError failure={state.failure} onRetry={() => setRetryCount((value) => value + 1)} />
      ) : null}
      {state.status === "success" && state.data.count === 0 ? (
        <p className="view-message">
          {hasFilters
            ? "No expenses match the selected filters."
            : "No expenses yet. Add your first expense to get started."}
        </p>
      ) : null}
      {state.status === "success" && state.data.count > 0 ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Category</th>
                  <th scope="col">Note</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {state.data.results.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.date}</td>
                    <td>{expense.category}</td>
                    <td>{expense.note || "—"}</td>
                    <td>{formatAmount(expense.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination" aria-label="Expense pagination">
            <button
              type="button"
              disabled={state.data.offset === 0}
              onClick={() =>
                navigatePage(
                  Math.max(0, state.data.offset - state.data.limit),
                  state.data.limit,
                )
              }
            >
              Previous
            </button>
            <span>
              Showing {state.data.offset + 1}–
              {Math.min(state.data.offset + state.data.results.length, state.data.count)} of{" "}
              {state.data.count}
            </span>
            <button
              type="button"
              disabled={state.data.offset + state.data.results.length >= state.data.count}
              onClick={() =>
                navigatePage(state.data.offset + state.data.limit, state.data.limit)
              }
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
