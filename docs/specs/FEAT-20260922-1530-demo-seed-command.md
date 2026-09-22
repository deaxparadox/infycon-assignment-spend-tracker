# FEAT-20260922-1530 — Idempotent demo-account seed command

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`

## Need

The backend is being deployed to Render, whose default web-service filesystem is ephemeral: every redeploy discards the SQLite database. To keep the app demoable without forcing every evaluator to register their own account first, the deployment needs a fixed demo login that's guaranteed to exist after any deploy, while still allowing anyone to register an independent account normally.

## Design

Added `python manage.py seed_demo_data` (`backend/src/apps/expenses/management/commands/seed_demo_data.py`):

- Looks up a fixed demo account (`demo@example.com`, case-insensitive) and creates it via `User.objects.create_user` only if it doesn't already exist. Never touches the password of an existing demo account, so a redeploy can't silently reset credentials someone changed.
- The password comes from `DEMO_ACCOUNT_PASSWORD` if set, else a documented default (`CorrectHorseBattery9!`) — a public demo credential by design, not a secret.
- If the demo account already has any expenses, seeding is skipped entirely (idempotent no-op on repeat runs within the same database lifetime).
- Otherwise it bulk-creates 5 sample expenses spanning the previous and current month, chosen specifically to exercise both bonus insight types out of the box: `food` spend increases 30% month-over-month (>20% triggers `category_increase`), and `transport` has no prior-month spend (triggers `new_category_spend`). Dates are computed relative to `django.utils.timezone.localdate()` at run time, not hardcoded, so the demo stays meaningful whenever it's actually seeded.
- Registering a separate account is unaffected — the command only ever reads/writes the one fixed demo email.

Wired into the existing Compose `migrate` one-shot service so local Docker also seeds automatically on `docker compose up`:

```yaml
command: ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_demo_data"]
```

For Render, the same pattern applies as the service's pre-deploy/start command: `python manage.py migrate --noinput && python manage.py seed_demo_data`.

## Verification

- Added `backend/tests/expenses/test_seed_demo_data.py`: creation produces the demo account (5 expenses, correct password) and does not touch other accounts; a second run is a no-op (idempotency); a manually changed demo password survives a re-run.
- Full backend suite: 94 tests pass (91 prior + 3 new). `ruff check`/`ruff format --check` clean.
- End-to-end: ran `docker compose down --volumes` (simulating a Render redeploy wiping the database) then `docker compose up -d --build`. Migrate logs show `Created demo account demo@example.com` / `Seeded demo expenses for demo@example.com`. Logged in via the real API afterward and confirmed `GET /summary` for the current month returns both insight types with the expected numbers: `food` +30% (`category_increase`), `transport` `new_category_spend`, total `190.00`.

## Recursive checks

### Lateral spread

Checked whether any other code path creates accounts or expenses that this could collide with (registration, existing manual API testing from earlier sessions) — none; the command only matches on the fixed demo email and is otherwise inert.

### Causal depth

Confirmed the underlying need (ephemeral hosting) is addressed by making seeding idempotent and re-run-safe on every start, not just on first deploy — the actual failure mode being guarded against is a redeploy wiping the database mid-evaluation, not just initial setup.

## Commit boundary

One commit contains the management command, its tests, the Compose wiring, this spec, and the TODO entry.
