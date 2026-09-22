# Spend Tracker

An authenticated expense tracker built as a Django REST API and a routed Next.js application. Each user can add expenses, filter and page through their own records, view monthly totals and category breakdowns, and see when a category is new or has increased by more than 20% from the previous month.

## Features

- Email/password accounts using a custom Django user model.
- Short-lived JWT access tokens kept only in browser memory.
- Rotating refresh tokens in HTTP-only cookies, with CSRF protection and token blacklisting.
- SQLite persistence with user-scoped expense queries and aggregates.
- Exact integer-minor-unit money calculations.
- URL-backed expense filters, pagination, and month selection.
- Consistent JSON errors and explicit frontend loading, empty, validation, authentication, server, and network states.
- Automated backend and frontend tests, including security and failure cases.

## Repository layout

```text
backend/
  src/apps/accounts/       custom user and authentication use cases
  src/apps/expenses/       expense, money, filtering, and summary domains
  src/config/              settings, routing, CSRF, and API error policy
  tests/                   API, model, money, settings, and summary tests
frontend/
  src/app/                 URL routes and route-level states
  src/features/auth/       session lifecycle and authentication UI
  src/features/expenses/   expense and summary UI
  src/lib/                 API client, contracts, config, money, and URL helpers
compose.yaml               portable local container topology
scripts/check.ps1          PowerShell verification entry point
scripts/check.sh           Bash verification entry point
docs/                      approved architecture records and implementation specs
```

The backend separates HTTP validation, selectors, and business services. The frontend keeps transport and cross-cutting helpers outside feature components. Filters and the selected month live in the URL; only transient form and request state lives in component memory.

## Supported toolchain

This repository pins the following toolchain:

- Python 3.12.2 (pinned by `.python-version`)
- Node.js 22.18.0 and npm 11.19.1
- Django 5.2.17, Django REST Framework 3.17.2, Simple JWT 5.5.1, django-cors-headers 4.9.0, and Gunicorn 26.2.0
- Next.js 16.3.5, React 19.2.8, TypeScript 5.9.3, and Vitest 5.0.1

Python dependencies are fully listed in `backend/requirements.lock`; JavaScript dependencies are locked by `frontend/package-lock.json`.

## Run locally

### 1. Backend

From the repository root in PowerShell:

```powershell
pyenv local 3.12.2
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.lock
python src/manage.py migrate
python src/manage.py runserver
```

The development settings intentionally provide visible localhost-only defaults and create `backend/db.sqlite3`. Django listens on `http://localhost:8000`.

On macOS or Linux, activate with `source .venv/bin/activate`; the other commands are unchanged. If `pyenv` is unavailable, use another Python 3.12.2 installation and confirm it with `python --version`.

### 2. Frontend

In a second terminal, from the repository root:

```powershell
Set-Location frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000/register`. Registration returns to sign-in; after signing in, `/summary`, `/expenses`, and `/expenses/new` are protected URL routes.

## Run with Docker Compose

Use Docker Engine on Linux or Docker Desktop configured for Linux containers on Windows. The stack uses immutable images and a Docker-managed volume, so it does not need host UID/GID variables or writable source bind mounts.

Copy the Compose environment example from the repository root:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

Set a strong, unique `DJANGO_SECRET_KEY` in `.env`; it is intentionally blank in the example so Compose fails before building if it is not supplied. The remaining example values run the stack over localhost HTTP and are not internet-production settings.

Build and start all services:

```console
docker compose up --build
```

Compose first runs migrations as a one-shot service, then starts the API after migration success, and finally starts the frontend after the API is healthy. Open `http://localhost:3000`; the API is exposed at `http://localhost:8000`.

Operational commands:

```console
docker compose logs --follow
docker compose down
```

SQLite is stored in the named `spend-tracker-data` volume and survives `docker compose down`. The following command also deletes that volume and permanently removes its database, so use it only when a full local reset is intended:

```console
docker compose down --volumes
```

The frontend embeds `NEXT_PUBLIC_API_URL` during its image build. Change that value in `.env` and rebuild the frontend image whenever its public API origin changes. Do not use the internal `http://backend:8000` hostname for this value: browser requests originate outside the Compose network.

The backend and frontend run as non-root users inside their Linux images. Docker owns the database volume and its permissions, which avoids Windows/Linux host ownership differences. SQLite limits this topology to one backend replica; move to PostgreSQL before horizontal scaling.

## Configuration

The root `.env.example` is the Compose contract. `compose.yaml` requires every interpolated value explicitly and uses the fixed internal database path `/var/lib/spend-tracker/db.sqlite3`.

`frontend/.env.example` contains the required public API origin:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`backend/.env.example` documents every backend setting. Django does not silently load that file: production processes must export the values in their environment. Required settings cover the Django secret and allowed hosts, frontend/CORS origin, SQLite path, token lifetimes, refresh-cookie name/path/SameSite/secure attributes, CSRF/session cookie security, HTTPS redirect, and HSTS. Invalid or missing production settings fail during startup.

Local `manage.py` commands use `config.settings.development`, whose explicit defaults are limited to localhost development. WSGI and ASGI use `config.settings.base`, which has no secret or endpoint fallback.

## API

All endpoint paths intentionally have no trailing slash.

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/auth/csrf` | Public | Set/read the CSRF token used by cookie-bearing writes |
| `POST` | `/auth/register` | Public + CSRF | Create an email-based account |
| `POST` | `/auth/login` | Public + CSRF | Return an access token and set the refresh cookie |
| `POST` | `/auth/refresh` | Refresh cookie + CSRF | Rotate refresh token and return a new access token |
| `POST` | `/auth/logout` | Refresh cookie + CSRF | Blacklist the refresh token and clear its cookie |
| `GET` | `/auth/me` | Bearer access token | Return the current user |
| `POST` | `/expenses` | Bearer access token | Create an expense |
| `GET` | `/expenses` | Bearer access token | List the current user's expenses |
| `GET` | `/summary?month=YYYY-MM` | Bearer access token | Return a monthly comparison and insights |

Expense listing accepts `category`, `start_date`, `end_date`, `limit` (1–100, default 20), and `offset`. Unknown, repeated, invalid, or reversed-range parameters return `400` rather than being ignored.

An expense request and response look like this:

```http
POST /expenses
Authorization: Bearer <access-token>
Content-Type: application/json

{"amount":"125.50","category":"Food","note":"Lunch","date":"2026-09-21"}
```

```json
{
  "id": 1,
  "amount": "125.50",
  "category": "food",
  "note": "Lunch",
  "date": "2026-09-21",
  "created_at": "2026-09-21T12:00:00Z",
  "updated_at": "2026-09-21T12:00:00Z"
}
```

A summary response has this shape:

```json
{
  "month": "2026-09",
  "total": "125.50",
  "previous_month_total": "100.00",
  "month_over_month_percentage": "25.50",
  "spend_by_category": [{"category": "food", "amount": "125.50"}],
  "insights": [
    {
      "type": "category_increase",
      "category": "food",
      "current_amount": "125.50",
      "previous_amount": "100.00",
      "percentage": "25.50",
      "message": "food spending increased by 25.50% compared with the previous month."
    }
  ]
}
```

Errors use one envelope throughout the API:

```json
{
  "error": {
    "code": "invalid",
    "message": "The request contains invalid values.",
    "fields": {"amount": ["Amount must be greater than zero."]}
  }
}
```

## Authentication and security

The login response supplies a short-lived access token to the frontend, which stores it only inside the `ApiClient` instance. It is never written to local storage, session storage, cookies, URLs, or logs. The refresh token is available only to the browser as an HTTP-only cookie scoped to `/auth/`.

On page load, the frontend obtains a CSRF token, uses the refresh cookie to restore an access token, then retrieves `/auth/me`. Concurrent `401` responses share one refresh request and each original request is retried at most once. Refresh rotation blacklists the old token; logout blacklists the current token, deletes the cookie with matching attributes, and always clears local session state.

## Money and summary rules

The API accepts positive decimal strings with at most two fractional digits. Conversion to a Python integer happens once at the request boundary (`"125.50"` becomes `12550`); models, filters, totals, and category logic use integer minor units. Serialization and the single frontend formatter convert back to fixed two-place strings only at output/display boundaries.

No amount rounding is performed because inputs with more than two fractional digits are rejected. Percentage results use decimal arithmetic and round half up to two places. The current implementation intentionally assumes one unspecified currency with 100 minor units per major unit and therefore displays no currency symbol.

If the previous month's total is zero, month-over-month percentage is `null` rather than infinite or `100%`. A category with current spend and no previous spend is reported as `new_category_spend`; otherwise `category_increase` is emitted only when the increase is strictly greater than 20%.

## Verification

Backend checks, from `backend/` with the virtual environment active:

```powershell
python -m ruff check .
python -m ruff format --check .
python -m pytest
python src/manage.py check --settings=config.settings.test
python src/manage.py makemigrations --check --dry-run --settings=config.settings.test
```

Frontend checks, from `frontend/` after creating `.env.local`:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

The root wrappers run the same backend and frontend checks. Both require the build-time API URL explicitly.

PowerShell:

```powershell
$env:NEXT_PUBLIC_API_URL = "http://localhost:8000"
.\scripts\check.ps1
```

Bash on Linux, macOS, WSL, or Git Bash:

```bash
export NEXT_PUBLIC_API_URL="http://localhost:8000"
./scripts/check.sh
```

The Bash wrapper uses `backend/.venv/bin/python` for a Unix virtual environment or `backend/.venv/Scripts/python.exe` for a Windows virtual environment used from Git Bash. It fails instead of falling back to a global Python interpreter.

The application checks above passed before the later containerization work. Per the repository owner's instruction, the Dockerfiles, Compose topology, and Bash wrapper were source-reviewed but were not executed.

## Design decisions and trade-offs

- Django and DRF provide mature user, password-validation, ORM, migration, permission, and API primitives while keeping business rules in small application modules.
- SQLite keeps local setup and review simple. User ownership is enforced in selectors and aggregate queries, not filtered after retrieval.
- Access tokens in memory reduce persistence exposure, at the cost of one refresh request after each page reload.
- URL-owned list and summary state makes views linkable and reproducible across refresh/back/forward navigation.
- Offset pagination is simple and adequate for this assignment; very large or rapidly changing datasets would benefit from cursor pagination.

## With more time

- Add Playwright browser tests to the existing unit/API coverage.
- Add email verification, password reset, login throttling, and operational audit events.
- Publish an OpenAPI schema and generate typed frontend contracts from it.
- Move production data to PostgreSQL, add structured logs/metrics, and automate backups.
- Add currency to the data model with a per-currency minor-unit multiplier before supporting JPY, BHD, or mixed-currency summaries.
- Improve accessibility and responsive polish after a dedicated audit.

## Deployment notes

Deployment is intentionally left to the repository owner. The Compose file is production-shaped but its example values deliberately use localhost HTTP. An internet-facing deployment must supply every `config.settings.base` environment variable, use a strong secret, exact public origins/hosts, TLS termination, secure cookies, HTTPS redirect/HSTS values appropriate to the proxy, database backups (or PostgreSQL), migrations during release, and `NEXT_PUBLIC_API_URL` at frontend build time.

The live deployment for this assignment runs the frontend on Vercel and the backend on Render's free tier, keeping SQLite as specified by the brief rather than adding a hosted database. Render's free web services have an ephemeral filesystem: it is discarded on every redeploy, restart, **and** inactivity spin-down (after roughly 15 idle minutes), not only on code changes. `python manage.py seed_demo_data`, run alongside `migrate` on every start, recreates a fixed demo account with sample expenses each time this happens, so the deployment is always demoable without registering first — sign in with `demo@example.com` / `CorrectHorseBattery9!` (or whatever `DEMO_ACCOUNT_PASSWORD` is set to). Any account registered directly against the live deployment, and its expenses, will be lost the next time the free instance restarts or wakes from sleep; this is expected behavior for this hosting tier, not a bug.

## AI-use disclosure

I used OpenAI Codex to help plan the architecture, scaffold the projects, implement code, and propose tests and documentation.
I reviewed the generated work against the requirements and installed versions, then changed or rejected suggestions such as JSON-exposed refresh tokens, floating-point money handling, and hidden non-URL filter state.
I ran the complete automated checks and a live cross-stack HTTP smoke flow for the application; later Docker and shell additions were source-reviewed only at the repository owner's request.
