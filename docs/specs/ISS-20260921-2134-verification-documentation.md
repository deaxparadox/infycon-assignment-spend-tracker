# ISS-20260921-2134 — Verification and submission documentation

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`
- **Depends on:** All approved feature items

## Need

Passing individual feature tests does not establish that the complete assignment works, remains secure across boundaries, or can be run and explained by a reviewer. The final system needs cross-stack verification and concise submission documentation.

## Verification scope

Run from clean, documented commands:

- backend dependency installation in the project virtual environment;
- Django system checks;
- migration consistency checks and migration execution against a disposable database;
- full backend test suite;
- backend lint/format checks;
- frontend dependency installation from its lock file;
- frontend lint, type check, unit/component tests, and production build; and
- an end-to-end smoke flow covering registration, login, expense creation, expense filtering, summary, refresh restoration, and logout.

No failing check may be hidden, skipped, or converted into documentation-only future work.

## Recursive verification

### Lateral spread

Search the full codebase for:

- unscoped expense queries or aggregates;
- endpoints missing explicit permissions;
- float/major-unit monetary calculations outside API/display boundaries;
- duplicated category normalization or money formatting;
- refresh/access tokens written to storage, URLs, or logs;
- cookie writes/deletes with mismatched attributes;
- undocumented configuration defaults;
- ad hoc error response shapes; and
- frontend filters or selected months held only in component memory.

Record what was found and either fix it under the owning active item or create a separately approved TODO item if it is a new independent finding.

### Causal depth

Map every assignment requirement and every approved authentication/money/routing decision to implemented code, automated tests, and README instructions. Confirm there are no uncovered contributing requirements such as zero-baseline semantics, cross-user isolation, page reload restoration, or failure responses.

## README

Create a concise root `README.md` containing:

- project overview and features;
- repository structure and architecture;
- exact supported Python/Node/package versions;
- environment variables with safe local setup guidance;
- backend virtual environment, install, migration, test, lint, and run commands;
- frontend install, test, lint, build, and run commands;
- API endpoint table and representative requests/responses;
- access/refresh token lifecycle and security decisions;
- integer minor-unit money policy and zero-baseline summary behavior;
- key design decisions and trade-offs;
- what would be changed with more time;
- deployment considerations without claiming deployment; and
- a truthful 2–3 line AI-use disclosure describing reviewed, changed, or rejected output.

The README must not contain secrets, raw tokens, local absolute paths, or claims not demonstrated by checks.

## Acceptance criteria

- All checks and the smoke flow pass from documented commands.
- A fresh SQLite database can be migrated without manual edits.
- No uncommitted generated databases, secrets, environments, dependencies, or build outputs remain.
- Every assignment requirement is traceable to code and tests.
- Lateral-spread and causal-depth results are stated in the close-out.
- The public repository excludes `AGENTS.md`.
- README instructions have been followed once as written.

## Commit boundary

One final verification/documentation commit will contain README and verification-only adjustments, plus the in-place completion of this TODO item. Any functional defect discovered here belongs to its owning feature or a newly approved tracked item rather than being silently patched into the documentation commit.

## Verification results

- Reinstalled the locked Python and npm dependencies inside the project, then confirmed `pip check`, `npm ls`, and `npm audit --audit-level=high` succeed; npm reports zero vulnerabilities.
- Ran the root verification command: Ruff lint and formatting, 91 backend tests, Django system and migration-drift checks, ESLint, TypeScript, 53 frontend tests, and the Next.js production build all pass.
- Migrated every app from zero into a disposable SQLite database under production settings, then passed Django's deployment checks with explicit secure environment values. The disposable and smoke databases were removed afterward.
- Started the built frontend and Django server together. A live HTTP smoke session verified the frontend registration route, registration, login, expense creation, category/date filtering, monthly summary, cookie-backed token refresh and `/auth/me` restoration, logout, and rejection of refresh after logout. No controllable browser was available in the execution environment, so UI transitions are covered by the component integration suite rather than an additional browser runner.
- Confirmed the GitHub repository is public at `deaxparadox/infycon-assignment-spend-tracker`, the working tree contains no generated database or secret, and no `AGENTS.md` file is tracked.
- Followed the README install and check commands using Python 3.12.2, Node.js 22.18.0, and npm 11.19.1.

## Recursive verification results

### Lateral spread

Searched all backend queries and aggregates: every expense read is owner-scoped before filtering or grouping, and creates assign the authenticated owner. Searched all API views and confirmed protected views declare `IsAuthenticated`, while only the named authentication lifecycle endpoints use `AllowAny`.

Searched backend and frontend code for float fields/conversions, JavaScript number parsing, storage/log token persistence, duplicated category or money formatting, cookie mutation, ad hoc response envelopes, and component-only filter/month state. Monetary values remain integer minor units or boundary strings; category normalization, output formatting, cookie handling, and API error normalization each have one owning module; tokens are not persisted or logged; filter/month view state comes from the URL.

### Causal depth

Mapped each assignment requirement and approved authentication, money, summary, and routing decision to implementation, automated tests, live smoke coverage, and README instructions. The check includes non-happy paths for invalid inputs and query shapes, missing/expired sessions, CSRF/origin enforcement, refresh reuse, user isolation, database constraints, calendar boundaries, percentage rounding, zero baselines, strict insight thresholds, URL restoration, loading/empty/error states, and clean migration/startup behavior. No additional contributing requirement was found within the inspected scope.
