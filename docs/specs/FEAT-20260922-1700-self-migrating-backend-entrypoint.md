# FEAT-20260922-1700 — Self-migrating backend image entrypoint

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`
- **Supersedes:** part of `docs/specs/FEAT-20260922-0842-container-stack.md`'s design ("do not run migrations implicitly in the API process")
- **Related:** `docs/specs/FEAT-20260922-1530-demo-seed-command.md`

## Need

FEAT-20260922-0842 deliberately kept `migrate` as a separate one-shot Compose service so the backend API container's own command stayed "just run the server." Render's free tier has no equivalent of a separate one-shot service and no Pre-Deploy Command (paid-only) and no shell/console access to run one manually, so that design cannot be replicated there: the backend image has to migrate and seed itself, unconditionally, every time its container starts, on whatever platform runs it.

## Design

Added `backend/entrypoint.sh`:

```sh
#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py seed_demo_data

exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --access-logfile - \
    --error-logfile -
```

`backend/Dockerfile` now `COPY`s it in, `chmod +x`s it while still root, and sets it as the image's `ENTRYPOINT` (replacing the old `CMD` that ran Gunicorn directly). `backend/.dockerignore` needed `!entrypoint.sh` added — the same deny-all-then-allowlist pattern that excluded `vitest.setup.ts` from the frontend image in ISS-20260922-1215 excluded this file too, caught immediately this time by checking for it proactively. `${PORT:-8000}` defaults to `8000` (matching Compose, which never sets `PORT`) and binds to Render's injected value when present, without needing per-platform configuration.

Chose an image-level entrypoint over the two alternatives discussed:
- A `render.yaml` Blueprint `dockerCommand` override only takes effect when the service is created via Render's Blueprint flow specifically; a plain "New Web Service" (the normal free-tier path) ignores `render.yaml` entirely.
- A dashboard-only "Docker Command" override works, but is a manual, unversioned setting with nothing in git to review or reproduce it.

An image-level entrypoint works regardless of how or where the container is run (Render dashboard, a future Blueprint, or plain `docker run`), and needs no per-platform configuration at all.

### Docker Compose simplification (found during verification, not planned upfront)

Rebuilt and ran the full Compose stack to verify this before declaring it done. The separate one-shot `migrate` service still had `command: ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_demo_data"]` — but Compose's `command:` only replaces an image's `CMD`, not its `ENTRYPOINT`. Since the image now has a fixed `ENTRYPOINT`, that `command` was being passed as ignored arguments to `entrypoint.sh`, which unconditionally runs migrate, seed, and **Gunicorn** regardless of arguments — so the "one-shot" migrate container never exited, instead running a full second API server that never stopped.

Since the backend image is now fully self-sufficient, the separate `migrate` service is redundant, not just misconfigured — removed it entirely from `docker-compose.yaml`, along with `backend`'s now-unnecessary `depends_on: migrate: condition: service_completed_successfully`. The `backend` service's own healthcheck (`GET /auth/csrf`) still only reports healthy once its own entrypoint's migrate/seed/Gunicorn sequence has completed, so `frontend`'s existing `depends_on: backend: condition: service_healthy` continues to order startup correctly with one fewer moving part.

Updated `README.md` in the places that described the old two-service (`migrate` + `backend`) startup sequence and the now-unnecessary Render "Docker Command" override instructions, plus two stale `compose.yaml` filename references left over from the earlier rename to `docker-compose.yaml`.

## Verification

- Built the backend image standalone (no Compose) and ran it with `docker run -e PORT=9000 ...`, simulating exactly how Render invokes a container: confirmed migrate, then `seed_demo_data`, then Gunicorn binding to `0.0.0.0:9000` in the logs, and a real HTTP request returned the CSRF token with `Set-Cookie: ...; SameSite=None; Secure` as configured.
- Rebuilding the full Compose stack first reproduced the `command`-vs-`ENTRYPOINT` bug above (the `migrate` container never exited); after removing the redundant service, `docker compose up -d --build` starts only `backend` and `frontend`, `backend` goes straight to `Healthy`, and its logs show migrate → seed → Gunicorn in one place.
- Logged in via the real API against the rebuilt stack and confirmed `GET /summary` for the current month returns the expected total and both insight types (unchanged from prior verification, confirming no regression).
- Full backend suite: 95/95 passing. `ruff check` / `ruff format --check` clean.

## Recursive checks

### Lateral spread

Checked `backend/.dockerignore` proactively for the same allowlist-omission class of bug already found once in the frontend image (ISS-20260922-1215) before it could bite twice silently — `entrypoint.sh` needed adding. Checked for other `command:` overrides elsewhere in `docker-compose.yaml` that could hit the same `ENTRYPOINT`-vs-`CMD` issue — none; `frontend` has no `command:` override.

### Causal depth

The underlying cause here wasn't "the seed command doesn't run on Render" — it was that the backend image's own startup command was never self-sufficient, only the external Compose orchestration around it was. Fixing the image itself, rather than adding another platform-specific external wrapper, is what makes it work identically under Compose, Render's dashboard, or a bare `docker run`.

## Commit boundary

One commit contains `entrypoint.sh`, the `Dockerfile`/`.dockerignore` changes, the `docker-compose.yaml` simplification, the README updates, this spec, and the TODO entry.
