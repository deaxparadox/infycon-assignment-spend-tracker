"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import type { MonthlySummary } from "@/lib/api/contracts";
import { formatAmount } from "@/lib/money/format";

import { classifyViewFailure, ViewError, type ViewFailure } from "./view-error";

type SummaryState =
  | { status: "success"; key: string; data: MonthlySummary }
  | { status: "error"; key: string; failure: ViewFailure };

export function currentLocalMonth(date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;
}

export function SummaryView({ queryString }: { queryString: string }) {
  const { api } = useAuth();
  const router = useRouter();
  const params = useMemo(() => new URLSearchParams(queryString), [queryString]);
  const month = params.get("month");
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<SummaryState | null>(null);
  const requestKey = `${queryString}:${retryCount}`;
  const state = !month
    ? { status: "waiting" as const }
    : result?.key === requestKey
      ? result
      : { status: "loading" as const };

  useEffect(() => {
    if (!month) {
      const next = new URLSearchParams(queryString);
      next.set("month", currentLocalMonth());
      router.replace(`/summary?${next}`);
      return;
    }
    const controller = new AbortController();
    void api
      .request<MonthlySummary>(`/summary?${queryString}`, {
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
  }, [api, month, queryString, requestKey, router]);

  function selectMonth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = String(form.get("month") ?? "");
    if (selected) {
      router.push(`/summary?month=${encodeURIComponent(selected)}`);
    }
  }

  return (
    <section>
      <div className="section-heading">
        <h1>Monthly summary</h1>
        <form className="month-form" onSubmit={selectMonth}>
          <label htmlFor="month">Month</label>
          <input id="month" name="month" type="month" defaultValue={month ?? ""} required />
          <button type="submit">View month</button>
        </form>
      </div>

      {state.status === "waiting" || state.status === "loading" ? (
        <p className="view-message">Loading summary…</p>
      ) : null}
      {state.status === "error" ? (
        <ViewError failure={state.failure} onRetry={() => setRetryCount((value) => value + 1)} />
      ) : null}
      {state.status === "success" ? (
        <>
          <div className="summary-grid">
            <article className="metric-card">
              <h2>Selected month</h2>
              <p>{formatAmount(state.data.total)}</p>
            </article>
            <article className="metric-card">
              <h2>Previous month</h2>
              <p>{formatAmount(state.data.previous_month_total)}</p>
            </article>
            <article className="metric-card">
              <h2>Month-over-month</h2>
              <p>
                {state.data.month_over_month_percentage === null
                  ? "Unavailable (no previous-month spend)"
                  : `${state.data.month_over_month_percentage}%`}
              </p>
            </article>
          </div>

          <section className="content-card">
            <h2>Spend by category</h2>
            {state.data.spend_by_category.length ? (
              <ul className="category-list">
                {state.data.spend_by_category.map((item) => (
                  <li key={item.category}>
                    <span>{item.category}</span>
                    <strong>{formatAmount(item.amount)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No spending recorded for this month.</p>
            )}
          </section>

          <section className="content-card">
            <h2>Insights</h2>
            {state.data.insights.length ? (
              <ul className="insight-list">
                {state.data.insights.map((insight) => (
                  <li key={`${insight.type}-${insight.category}`}>
                    <strong>{insight.category}</strong>: {insight.message} Current{" "}
                    {formatAmount(insight.current_amount)}; previous{" "}
                    {formatAmount(insight.previous_amount)}
                    {insight.percentage === null ? "" : `; change ${insight.percentage}%`}.
                  </li>
                ))}
              </ul>
            ) : (
              <p>No category increases above the insight threshold.</p>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
