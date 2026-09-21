# FEAT-20260921-2131 — Expense persistence and API

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`
- **Depends on:** `FEAT-20260921-2129`, `FEAT-20260921-2130`

## Need

Authenticated users need durable expense creation and listing. Money must be exact, validation failures must be useful, filters must be URL-compatible, and no user may observe another user's data.

## Data model

Create an `Expense` with:

- integer primary key;
- owner foreign key to `settings.AUTH_USER_MODEL` with cascade deletion;
- positive `amount_minor` big integer;
- canonical category string, maximum 100 characters;
- optional note, maximum 500 characters;
- `expense_date` date;
- creation and update timestamps; and
- indexes on `(owner, expense_date)` and `(owner, category, expense_date)`.

Add a database check constraint requiring `amount_minor > 0`. Default ordering is expense date descending, creation time descending, then ID descending for stable pagination.

Category input is trimmed, internal whitespace collapsed, and stored in canonical lowercase so case/spacing variations do not create separate filter or summary groups.

## Money boundary

The public `amount` field is a plain decimal string. Accepted syntax is non-scientific positive decimal notation with at most two fraction digits.

- `"125"`, `"125.5"`, and `"125.50"` are accepted.
- `"0"`, negative values, non-numbers, exponent notation, and more than two fractional digits are rejected.
- Accepted input is converted once to integer minor units.
- Responses serialize minor units through one shared formatter to fixed two-place strings.
- A documented upper bound keeps minor values within database and JavaScript safe limits.

## `POST /expenses`

Request fields:

- `amount` — required decimal string;
- `category` — required non-blank string;
- `note` — optional string;
- `date` — required ISO calendar date.

The authenticated user is always taken from `request.user`; an owner supplied by a client is ignored or rejected. Successful creation returns `201` and the serialized expense.

## `GET /expenses`

Optional query parameters:

- `category` — canonical exact category match;
- `start_date` — inclusive ISO date;
- `end_date` — inclusive ISO date;
- `limit` and `offset` — bounded pagination.

Reject malformed dates, unsupported repeated/scalar values, out-of-range pagination, and `start_date > end_date`. Filter first by authenticated owner, then apply client filters. Return deterministic pagination metadata and results.

## Error behavior

Use the shared error envelope for serializer, query, authentication, and unexpected failures. Field errors identify public field names such as `amount` and `date`, never internal `amount_minor` or model implementation details.

## Tests

- Persist a valid amount as the expected integer minor value.
- Return fixed two-place amount strings.
- Reject zero, negative, exponent, malformed, too-large, and over-precision amounts.
- Reject blank/overlong category, overlong note, and invalid date.
- Canonicalize category case and whitespace consistently.
- Filter by category, each date bound, and combined date bounds.
- Include exact start/end boundary dates.
- Reject reversed date range and malformed pagination.
- Verify deterministic ordering and pagination.
- Verify unauthenticated rejection.
- Verify one user cannot list another user's expenses.
- Verify the database constraint independently of serializer validation.

## Recursive checks

### Lateral spread

Search serializers, services, selectors, models, tests, and response helpers for decimal/float money calculations or duplicated conversion. Search all expense queries for missing owner scope and all category handling for inconsistent normalization.

### Causal depth

Confirm the API satisfies persistence, exact money handling, validation, filtering, stable pagination, ownership, and predictable errors. A successful create/list happy path alone does not complete this item.

## Commit boundary

One expense API commit will contain the model/migration, shared money boundary helpers, serializers, selectors/services, routes, tests, and the in-place completion of this TODO item.

## Verification results

### Lateral spread

Source searches confirmed that all amount conversion lives in the shared money boundary, with no float or decimal business calculations elsewhere. Expense reads are owner-scoped in one selector, writes always take the owner from the authenticated request, and creation, filtering, model saves, and later summaries share the same category canonicalization function.

### Causal depth

Tests cover durable minor-unit persistence, exact formatting, the documented upper bound, the independent database range constraints, public-field validation, category normalization, inclusive and independent date filters, repeated and malformed query parameters, stable pagination, authentication, and cross-user isolation. The shared exception handler also now returns the required safe envelope for unexpected API failures.
