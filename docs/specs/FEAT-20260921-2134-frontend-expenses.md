# FEAT-20260921-2134 — Frontend expense and summary experience

- **Status:** Approved
- **Working branch:** `main`
- **Base branch:** `main`
- **Depends on:** `FEAT-20260921-2131`, `FEAT-20260921-2132`, `FEAT-20260921-2133`

## Need

Authenticated users need minimal but complete routed UI for expense creation, filtered/paginated expense viewing, and monthly summary viewing. UI state that defines a view must be represented in the URL.

## Routes and URL state

- `/expenses` lists expenses.
- `/expenses/new` creates an expense.
- `/summary?month=YYYY-MM` displays the selected month's summary.
- Expense filters use `category`, `start_date`, `end_date`, `limit`, and `offset` query parameters.
- Filter and pagination controls update the URL; refresh/back/forward navigation reproduce the same view.
- If summary month is absent, replace the URL with the current local `YYYY-MM` before fetching so the active period is explicit.

## Expense creation

The form contains amount text input, category, optional note, and expense date. The amount remains a string from input through request construction; the frontend does not parse it as a JavaScript number.

Client validation provides immediate required/shape feedback, while backend errors remain authoritative and map to fields. On success, route to `/expenses` and show a visible success state without relying on a hidden modal state.

## Expense list

- Render stable rows containing formatted amount, canonical/display category, note, and date.
- Provide category/start/end filter controls initialized from the URL.
- Provide apply and clear actions that update the URL.
- Render pagination from backend metadata.
- Distinguish loading, empty unfiltered data, empty filtered results, validation errors, authentication failures, and retryable server/network errors.
- Do not calculate totals from list rows.

## Summary

Render:

- selected-month total;
- previous-month total;
- month-over-month percentage or a clear unavailable state;
- spend by category; and
- structured increase/new-spend insights.

The month control updates `?month=YYYY-MM`. The frontend displays backend calculations rather than recomputing monetary totals or percentages.

## Money formatting

All public monetary values arrive as fixed decimal strings. One shared helper adds grouping separators and preserves exactly two fractional digits without converting through floating point. No currency symbol is displayed because currency is intentionally unspecified.

## Architecture

- Route files compose feature components.
- `features/expenses` owns form/list/filter/summary components and view-specific hooks.
- `lib/api` owns transport and typed contracts.
- `lib/money` owns display formatting and input helpers.
- Shared components remain domain-neutral.
- No global state library is added; URL state and local component state are sufficient.

## Tests

- Expense form sends amount as the original normalized string.
- Backend field/general errors render in the correct places.
- Successful creation routes to expense list and displays success feedback.
- Filters initialize from and write back to URL parameters.
- Clearing filters removes parameters.
- Pagination preserves active filters.
- Summary month initializes and updates through the URL.
- Loading, both empty states, validation, authentication, and network/server errors differ visibly.
- Money formatting covers whole, one-place, two-place, large, and zero values without numeric conversion.
- Summary renders `null` percentage and both insight types correctly.

## Recursive checks

### Lateral spread

Search all components for direct `Number`, `parseFloat`, or arithmetic on amount strings; all filter/month state for hidden non-URL sources; and all requests for duplicated error/auth handling.

### Causal depth

Confirm every required end-to-end action works after refresh and browser navigation, not only during one live React session. Confirm UI states explain empty data and failures rather than rendering blank output.

## Commit boundary

One frontend-expense commit will contain routed pages, feature components, URL state, formatter, tests, and the in-place completion of this TODO item.
