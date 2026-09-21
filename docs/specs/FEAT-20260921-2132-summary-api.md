# FEAT-20260921-2132 — Monthly summary and insights

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`
- **Depends on:** `FEAT-20260921-2131`

## Need

An authenticated user needs a selected-month summary containing total spend, spend by category, month-over-month change, and actionable category insights. Calculations must be exact, efficient, and isolated to that user.

## API contract

Implement `GET /summary?month=YYYY-MM`.

- `month` is required and must be a real ISO year-month.
- Selected range: `selected_start <= expense_date < next_month_start`.
- Previous range: `previous_start <= expense_date < selected_start`.
- Half-open ranges handle variable month lengths and year transitions without last-day arithmetic.
- Every query starts with `owner=request.user`.

Response fields:

- selected `month`;
- selected-month `total` as a fixed two-place decimal string;
- `previous_month_total` as a fixed two-place decimal string;
- `month_over_month_percentage` as a two-place decimal string or `null` when previous total is zero;
- deterministic `spend_by_category`, ordered by amount descending then category ascending; and
- deterministic `insights`.

## Calculation rules

Database aggregation returns integer minor-unit sums. Missing sums become integer zero explicitly.

When the previous total is greater than zero:

```text
((current_minor - previous_minor) * 100) / previous_minor
```

Calculate using Python `Decimal` created from integers and quantize the percentage to `0.01` using `ROUND_HALF_UP`.

When the previous total is zero, return a `null` percentage. Do not invent infinity or a 100% increase.

## Insight rules

For every category present in either month:

- Previous > 0 and percentage increase strictly > 20.00: emit `category_increase`.
- Previous = 0 and current > 0: emit `new_category_spend` with no percentage.
- Current = 0, equal values, decreases, and increases <= 20.00: no increase insight.

Messages are derived presentation text; structured type/category/amount/percentage fields remain the contract clients can rely on.

## Query design

Use grouped aggregate queries rather than loading expense rows into Python. The selector returns minor-unit maps for selected and previous periods. The service combines maps, calculates percentages/insights, and the serializer applies public formatting.

## Tests

- Reject missing, malformed, and impossible months.
- Empty selected and previous months return zeros, empty categories, and `null` percentage.
- Aggregate multiple rows and categories correctly.
- Keep users fully isolated.
- Handle January/December transition, leap February, and 30/31-day boundaries.
- Calculate positive, negative, zero, and fractional percentage changes.
- Apply `ROUND_HALF_UP` to percentage output.
- Return `null` percentage for a zero previous total.
- Flag 20.01% but not exactly 20.00%.
- Emit `new_category_spend` for zero-to-positive category spend.
- Keep output ordering deterministic.
- Demonstrate that monetary sums remain integers until response serialization.

## Recursive checks

### Lateral spread

Review every total, group, comparison, and insight path for float/major-unit calculations; every query for user scope; and every date range for the same half-open boundary convention.

### Causal depth

Confirm the summary covers all assignment outputs, empty-data semantics, zero baselines, calendar boundaries, per-category comparison, deterministic output, and database-side aggregation. A correct overall total does not prove category or insight correctness.

## Commit boundary

One summary commit will contain selectors, service logic, serializers, route, tests, and the in-place completion of this TODO item. Frontend presentation remains separate.

## Verification results

### Lateral spread

Every summary aggregate begins with the authenticated owner and uses the same half-open `>= start, < end` range convention. Source scans found no floating-point calculations or major-unit arithmetic; `Decimal` appears only in the percentage service and serializer, while all monetary totals and category maps remain integers until the shared amount formatter.

### Causal depth

Tests cover all required summary outputs, empty and zero-baseline semantics, user isolation, January/December, leap February, 30/31-day boundaries, positive, negative, zero, and half-up fractional percentages, the strict insight threshold, new-category spending, deterministic ordering, and exactly two grouped aggregate queries.
