# ISS-20260922-1745 — First real Render deploy failed: unable to open database file

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`
- **Related:** `docs/specs/FEAT-20260922-1700-self-migrating-backend-entrypoint.md`

## Problem

First actual `docker compose`-free deploy attempt to Render: the image built and pushed successfully, but the container failed on startup with `django.db.utils.OperationalError: sqlite3.OperationalError: unable to open database file` during `python manage.py migrate`, before `entrypoint.sh` ever reached `seed_demo_data` or Gunicorn.

## Verified cause

`entrypoint.sh` never ensured the configured `SQLITE_PATH`'s parent directory existed and was writable before running `migrate`. Two distinct failure modes both surface as this same generic sqlite3 error:

1. The configured path's parent directory doesn't exist yet.
2. The parent directory exists in the image (e.g. `/var/lib/spend-tracker`, created at build time and `chown`ed to the `app` user) but Render's runtime doesn't guarantee it preserves that exact baked-in UID — checked directly inside the built image: `/var/lib/spend-tracker` and `/app/src` are both `drwxr-xr-x` owned by `app` (uid 10001) specifically, writable only by that exact UID, while `/tmp` is `drwxrwxrwt` (sticky bit, world-writable) owned by `root` — writable by any UID regardless of platform-specific runtime remapping.

Without console access on Render's free tier, there's no way to inspect which of the two actually occurred on the live deploy, so the fix addresses both.

## Fix

1. `entrypoint.sh` now creates the configured database's parent directory before migrating:
   ```sh
   if [ "$SQLITE_PATH" != ":memory:" ]; then
       mkdir -p "$(dirname "$SQLITE_PATH")"
   fi
   ```
2. Changed the README's recommended Render `SQLITE_PATH` from `/app/src/db.sqlite3` to `/tmp/spend-tracker/db.sqlite3` — sidesteps the UID-mismatch failure mode entirely, independent of whatever Render's actual runtime behavior turns out to be.

## Recursive checks

### Lateral spread

Checked whether any other path in the app is written by the API process outside of what's already covered (static files are served by WhiteNoise/CDN patterns per the Vercel research, not applicable here; no other file writes exist in this Django app besides the SQLite file itself).

### Causal depth

Verified the mechanism directly rather than only patching the symptom: built the image and, as the `app` user, inspected the actual permissions of every writable-directory candidate (`docker run --entrypoint sh ... -c "id; ls -ld /tmp /var/lib/spend-tracker /app/src"`). Reproduced both failure modes locally with `docker run`: a genuinely unwritable path (`/data/...`, root-owned) now fails fast with a clear `mkdir: Permission denied` instead of the previous cryptic `sqlite3.OperationalError`, and a nested, not-yet-existing path under `/tmp` now succeeds through migrate, seed, and Gunicorn startup.

## Acceptance criteria

- `entrypoint.sh` creates the SQLite parent directory before migrating, for any configured `SQLITE_PATH` except `:memory:`.
- The documented Render `SQLITE_PATH` value is writable regardless of the exact UID the platform runs the container as.
- Full backend suite passes (95/95); no Django code changed, so no regression risk there.

## Commit boundary

One commit contains the `entrypoint.sh` fix, the README recommendation change, this spec, and the TODO entry.
