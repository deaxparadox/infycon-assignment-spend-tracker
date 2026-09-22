# FEAT-20260922-1830 — DATABASE_URL support for a hosted Postgres backend

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`
- **Supersedes:** `docs/specs/ISS-20260922-1745-render-sqlite-path.md` (reverted — see below)

## Need

Render's free-tier deploy kept failing at `migrate` with `sqlite3.OperationalError: unable to open database file`, even after ISS-20260922-1745's `mkdir -p` fix and moving `SQLITE_PATH` to `/tmp`. Without console access to inspect the actual failure on Render's infrastructure, further guessing at SQLite-specific filesystem behavior wasn't productive. The repository owner obtained a Neon Postgres database and asked to switch the deployed backend to it, matching the standard pattern (SQLite for local/dev/tests, `DATABASE_URL`-based Postgres in production) used by Vercel's own official Django deployment guide.

## Reverted work

`git revert 2447d1e` undid ISS-20260922-1745's `entrypoint.sh` `mkdir -p` and `/tmp` `SQLITE_PATH` recommendation (commit `4642f3b`) — superseded by this change rather than kept as unused defensive code for a path no longer in use.

## Design

Added `database_config_from_url(url: str) -> dict` to `backend/src/config/settings/base.py`, hand-rolled with `urllib.parse` (`urlparse`/`parse_qs`/`unquote`) rather than adding a `dj-database-url` dependency for what's a small, fully-specified parse: extracts `NAME`/`USER`/`PASSWORD`/`HOST`/`PORT` (percent-decoding user/password), defaults `PORT` to `5432`, and passes every query-string parameter through as `OPTIONS` — which is what carries Neon's required `sslmode=require` and `channel_binding=require` down to `psycopg.connect()`.

`DATABASES` now branches:

```python
database_url = os.environ.get("DATABASE_URL", "").strip()
if database_url:
    DATABASES = {"default": database_config_from_url(database_url)}
else:
    database_name = required_env("SQLITE_PATH")
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ...}}
```

`DATABASE_URL` is optional, not `required_env`, because `config.settings.base` is shared by both the Render deployment (sets it) and local Docker Compose (doesn't, by the repository owner's own choice — they're wiring `docker-compose.yaml`/root `.env` separately) — this keeps Compose, tests, and `manage.py runserver` entirely unaffected.

Added `psycopg[binary]==3.3.6` to `backend/pyproject.toml` and regenerated `backend/requirements.lock` — by hand, not a raw `pip freeze` overwrite, since a Linux-only freeze would have silently dropped `colorama` and `tzdata`, which are legitimate Windows-only conditional dependencies the original lock carried for this project's documented Windows support. Added exactly the three new packages (`psycopg`, `psycopg-binary`, and psycopg's `typing_extensions` dependency) in their correct alphabetical positions instead.

## Verification

- Unit tests in `backend/tests/config/test_settings.py` for `database_config_from_url`: a full Neon-shaped DSN including percent-encoded password and query-string options, and a bare DSN confirming the port default and empty `OPTIONS`.
- **Real connectivity, not just parsing**: ran `manage.py migrate --noinput` and `manage.py seed_demo_data` directly against the actual live Neon database (credential from the gitignored `backend/.env`, never committed). Migrations applied and the demo account/expenses seeded successfully; re-running `seed_demo_data` correctly reported "already exists" — idempotency holds against real Postgres, not just SQLite in tests.
- Built the backend Docker image with the new dependency and ran it standalone (`docker run -e DATABASE_URL=... -e PORT=...`, no `SQLITE_PATH` at all) — simulating exactly how Render will invoke it. Migrate/seed/Gunicorn all completed successfully. The first connection took roughly 20–25 seconds before producing any output, consistent with Neon's free-tier compute auto-suspend/cold-start behavior — worth knowing for Render specifically, since the first request after any idle period will see a similar delay during `migrate` before the app responds.
- Directly queried the live database afterward to confirm a single consistent final state (no duplication from the multiple verification runs): exactly one `demo@example.com` user, 5 expenses, 32 applied migrations.
- Full backend suite: 97/97 passing (95 + 2 new). `ruff check`, `ruff format --check`, `manage.py check`, and `makemigrations --check --dry-run` all clean, reinstalling from the hand-edited `requirements.lock` to confirm it's actually installable, not just plausible-looking.

## Recursive checks

### Lateral spread

Checked whether `requirements.lock` regeneration would silently drop platform-conditional packages before committing it — it would have (`colorama`, `tzdata`), so corrected by hand-editing instead of overwriting with a Linux-only freeze.

### Causal depth

Deliberately verified against the real Neon database and a real Docker container invocation, not just the parsing function in isolation — the actual failure mode being guarded against (Render's specific runtime environment) can't be fully reproduced locally, so the closest available proxy (a standalone `docker run` with the exact same `DATABASE_URL` and a Render-like `$PORT`) was used instead of trusting unit tests alone.

## Acceptance criteria

- `DATABASE_URL`, when set, fully determines the database backend; when unset, existing SQLite behavior (Compose, tests, local `manage.py`) is unchanged.
- `migrate` and `seed_demo_data` succeed against the real Neon database.
- Full backend suite passes; `requirements.lock` installs cleanly and preserves Windows-only conditional dependencies.

## Commit boundary

One commit contains the settings/dependency/lock changes, the new tests, this spec, and the TODO entry. The `git revert` of ISS-20260922-1745 is a separate, already-completed commit (`4642f3b`).
