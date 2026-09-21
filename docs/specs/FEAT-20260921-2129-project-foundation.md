# FEAT-20260921-2129 — Project foundation

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`
- **ADR:** `docs/adr/0001-django-nextjs-jwt-architecture.md`

## Need

The repository currently contains only planning documents and local agent instructions. The application needs reproducible Django and Next.js foundations before domain features can be implemented. Authentication also requires the custom email user model to exist before the first application migration.

## Verified current state

- The Git repository is on an unborn `main` branch with no commits.
- The public GitHub remote exists and is configured as `origin`.
- `AGENTS.md` is ignored and must remain untracked.
- Node.js 22.18.0 and npm 11.19.1 are available.
- Python 3.12.2 is reported available through pyenv but has not yet been pinned or re-verified because the earlier sandbox failed.
- No backend or frontend scaffold exists, so generator overwrite risk is currently absent. This will be checked again immediately before each generator runs.

## Proposed implementation

1. Run `pyenv local 3.12.2` and verify `python --version` reports exactly Python 3.12.2.
2. Create `backend/.venv` with that interpreter; never install packages globally.
3. Resolve a tested Django 5.2 LTS, DRF, Simple JWT, and `django-cors-headers` set plus pytest, pytest-django, and Ruff. Record exact direct dependencies in `backend/pyproject.toml` and a reproducible lock/freeze artifact selected during implementation.
4. Use `django-admin startproject` under `backend/src`.
5. Use `manage.py startapp` for `accounts` and `expenses`; do not hand-write framework scaffolds.
6. Create a custom user model with unique normalized email, no username, a correct manager, and Django password hashing.
7. Create the initial accounts migration only after `AUTH_USER_MODEL` is configured.
8. Split Django settings into base, development, and test modules without hiding required production configuration behind insecure defaults.
9. Configure SQLite with an explicit path, UTC timestamps, REST framework defaults, Simple JWT, CORS, CSRF, and a consistent exception envelope.
10. Use `create-next-app` to generate `frontend` with npm, TypeScript, ESLint, App Router, `src/`, the `@/*` alias, and no Tailwind dependency.
11. Add root ignore rules for Python, Django, SQLite, Node, Next.js, coverage, build output, editor files, and secrets while retaining the existing `AGENTS.md` exclusion.
12. Add project-local scripts for checks, tests, linting, and builds.

## Required configuration behavior

Security-sensitive production values must fail fast when absent or invalid. Development and tests may use explicitly named local settings modules and clearly local values.

At minimum, configuration covers:

- Django secret key;
- allowed hosts;
- frontend origin;
- SQLite path;
- refresh-cookie name/path/secure/same-site behavior;
- access and refresh token lifetimes; and
- frontend API origin.

`.env.example` files document keys but contain no secrets. Environment files are ignored.

## Custom user acceptance criteria

- Email is the sole login identifier and is required.
- Username is absent.
- Email identity is normalized and uniqueness is enforced case-insensitively at both validation and database levels supported by SQLite/Django.
- `create_user` and `create_superuser` validate required fields and hash passwords.
- The user model is registered with Django admin.
- Tests cover creation, superuser flags, missing email, duplicate differently-cased email, and password hashing.

## Acceptance criteria

- Both official generators complete without overwriting an existing scaffold.
- `python --version` is 3.12.2 inside the repository and virtual environment.
- Backend packages install only in `backend/.venv`.
- Django imports, system checks, initial migrations, and foundation tests pass.
- Next.js dependency installation, lint, type checking, tests, and a production build pass for the generated baseline.
- Required configuration fails at startup with a direct actionable message.
- `AGENTS.md`, secrets, databases, virtual environments, dependencies, and build outputs are not tracked.
- No application endpoint is falsely presented as complete by this foundation item.

## Recursive checks

### Lateral spread

Inspect every settings module and executable entry point for hidden security defaults, every generated path for misplaced source files, and every ignore rule for secrets or local artifacts. Confirm all user references use `settings.AUTH_USER_MODEL` or `get_user_model()` rather than importing a concrete user class.

### Causal depth

Confirm the foundation supports every later requirement: authentication, user-owned expenses, integer money, migrations, API tests, routed Next.js pages, cross-origin cookie refresh, root documentation, and reproducible local commands. A successful scaffold alone is not sufficient.

## Commit boundary

One foundation commit will contain the generated scaffolds, verified dependency/configuration setup, custom user model and initial migration, foundation tests, and the in-place completion of this TODO item. Authentication endpoints and expense behavior remain separate commits.
