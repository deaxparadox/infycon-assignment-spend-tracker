# ISS-20260921-2134 — Verification and submission documentation

- **Status:** Approved
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
