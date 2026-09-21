# ADR 0001 — Django, Next.js, and split JWT storage

- **Status:** Accepted
- **Date:** 2026-09-21
- **Working branch:** `main`
- **Base branch:** `main`

## Context

The assignment requires a Python REST API, persistent relational storage, validation, automated tests, and a lightweight routed frontend. Authentication is part of the agreed baseline. Each user's expenses and summaries must be private.

The repository owner selected Next.js for the frontend and requested email/password authentication with an access JWT held only in browser memory and a refresh JWT held in an HTTP-only cookie.

Money must remain in integer minor units inside the backend. Public API amounts use fixed two-place decimal strings. Values with more than two decimal places are rejected rather than rounded.

## Decision

### Backend

Use Python 3.12.2, Django 5.2 LTS, Django REST Framework, Simple JWT, SQLite, and Django migrations.

- Create a custom Django user model before the first application migration.
- Use unique normalized email as `USERNAME_FIELD`; do not keep a username field.
- Use DRF serializers for boundary validation, views for HTTP orchestration, services for writes/business decisions, and selectors for reusable read/aggregation queries.
- Do not add a generic repository wrapper around Django's ORM.
- Store expense amounts as positive integer minor units.
- Scope every expense query and aggregate by the authenticated user.
- Require explicit security-sensitive configuration at startup.

### Authentication

- Return a short-lived access token in login and refresh response bodies.
- Keep the access token only in frontend memory.
- Store the rotating refresh token in an HTTP-only cookie with an explicit path, lifetime, `SameSite` policy, and environment-controlled `Secure` flag.
- Enable Simple JWT's outstanding-token and blacklist support.
- Blacklist rotated and logged-out refresh tokens.
- Protect cookie-authenticated refresh/logout behavior with explicit origin and CSRF controls.
- Restrict credentialed CORS to configured frontend origins.

Simple JWT's stock JSON refresh flow will be wrapped because it does not implement the agreed cookie transport by itself.

### Frontend

Use the current generator-compatible Next.js App Router release with TypeScript, ESLint, npm, and a `src/` layout.

- Use URL routes for login, registration, expense listing, expense creation, and summary.
- Store filters and selected summary month in URL query parameters.
- Use a client authentication provider because an in-memory access token cannot be read by Next.js middleware or Server Components.
- On page reload, attempt one cookie-backed refresh before deciding whether the user is anonymous.
- Coordinate concurrent `401` responses through one refresh promise and retry each request at most once.
- Never persist tokens in local storage, session storage, URLs, or logs.

## Compatibility gate

The local interpreter will be pinned with `pyenv local 3.12.2`. Exact dependency versions will be resolved and recorded only after the proposed Django/DRF/Simple JWT combination passes:

- installation in a project-local virtual environment;
- import smoke checks;
- Django system checks;
- migrations against a disposable SQLite database; and
- authentication tests.

Compatibility failure stops implementation. It must not trigger an undocumented framework downgrade or package substitution.

## Consequences

### Benefits

- Django supplies mature authentication, password hashing, ORM, migrations, admin support, and system checks.
- The custom email user model avoids a later high-risk identity migration.
- Integer money storage prevents binary floating-point errors in business calculations.
- URL state makes frontend views refresh-safe and shareable.
- Split token storage limits persistent access-token exposure while supporting session restoration.

### Costs

- Cookie-backed refresh requires custom endpoint wrappers and cross-origin/CSRF care.
- Memory-only access tokens require a startup refresh after every full page load.
- Simple JWT compatibility must be verified because its published support table can lag current Django and DRF releases.
- SQLite is appropriate for the assignment but would need operational review before a multi-instance production deployment.

## Rejected alternatives

### FastAPI with separately assembled persistence and authentication

FastAPI remains suitable for the expense endpoints, but authentication is now baseline scope. Django reduces custom user, password, migration, permission, and administration work.

### Django session authentication

Session authentication would be simpler for a same-origin browser application, but it conflicts with the explicitly approved access-JWT/refresh-JWT design.

### Refresh token in JavaScript storage

Rejected because it exposes the long-lived credential to JavaScript and increases the impact of an XSS vulnerability.

### Access token in local storage

Rejected because the approved design requires memory-only access tokens and no persistent browser token storage.

### Decimal or floating-point database amounts

Rejected for this fixed two-place, single-currency assignment. Integer minor units make persistence and aggregation exact and keep conversion at the API boundary.

### Generic repository abstraction over Django ORM

Rejected because it would mostly rename ORM operations without providing a second persistence implementation or meaningful isolation. Services and selectors provide the useful boundaries.

