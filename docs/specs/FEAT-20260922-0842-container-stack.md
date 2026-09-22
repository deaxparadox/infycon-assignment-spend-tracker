# FEAT-20260922-0842 — Portable container stack

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`
- **ADR:** `docs/adr/0002-portable-container-runtime.md`

## Need

Provide a production-style Docker and Compose path that works on Linux and on Windows with Docker Desktop Linux containers without relying on host UID/GID mapping or writable host bind mounts.

## Verified current state

- No Dockerfile, `.dockerignore`, Compose file, root Compose environment example, or container startup helper exists.
- `config.settings.base` already validates required production environment values at startup.
- `SQLITE_PATH` accepts an absolute container path.
- `NEXT_PUBLIC_API_URL` is required and is consumed by browser-side code, so it must contain a host-reachable public URL at frontend build time.
- The frontend currently uses the full `next start` installation rather than standalone output.
- The backend currently has no production HTTP server dependency.

## Dependency change

Add `gunicorn==26.2.0` to `backend/pyproject.toml` and `backend/requirements.lock`. PyPI metadata identifies it as a production-stable WSGI server supporting Python 3.12; Django exposes the required WSGI application in `config.wsgi`.

No frontend dependency is added.

## Backend image

Create `backend/Dockerfile` and `backend/.dockerignore`.

- Base the image on `python:3.12.2-slim-bookworm`.
- Install only the pinned lock-file dependencies without pip's cache.
- Copy application source and migrations into the image.
- Create a fixed internal application user and an application-owned `/var/lib/spend-tracker` directory.
- Run from `backend/src` as the non-root user.
- Expose port 8000.
- Start `config.wsgi:application` with Gunicorn bound to `0.0.0.0:8000` and access/error logs written to standard output/error.
- Do not run migrations implicitly in the API process.

The Docker ignore file will exclude virtual environments, caches, SQLite files, coverage output, local environment files, documentation, and other files not needed by the image.

## Frontend image

Set `output: "standalone"` in `frontend/next.config.ts`, then create `frontend/Dockerfile` and `frontend/.dockerignore`.

- Base build and runtime stages on `node:22.18.0-bookworm-slim`.
- Install dependencies with `npm ci` from the lock file.
- Require `NEXT_PUBLIC_API_URL` as a build argument and environment value before building.
- Copy the standalone server, `.next/static`, and `public` assets into a minimal runtime stage.
- Run as the image's existing non-root `node` user.
- Bind the generated server to `0.0.0.0:3000` and expose port 3000.

## Compose topology

Create root `compose.yaml` with:

- a one-shot `migrate` service using the backend image and named database volume;
- a `backend` service that waits for successful migrations, uses the same volume, exposes host port 8000, and has an unauthenticated HTTP health check implemented with Python's standard library;
- a `frontend` service that builds with the public API URL, waits for a healthy backend, exposes host port 3000, and has a Node-based HTTP health check; and
- one named SQLite data volume mounted at `/var/lib/spend-tracker`.

Application services use `init: true` and an explicit restart policy. No service receives a host-derived `user`, and no source directory is bind-mounted.

## Configuration

Create a root `.env.example` containing the values interpolated by Compose. `compose.yaml` will use required-value interpolation for secrets and origins rather than silent defaults. It will pass:

- the base Django settings module;
- Django secret, hosts, and frontend origin;
- the fixed internal SQLite path;
- access/refresh lifetimes;
- refresh, CSRF, and session cookie settings;
- HTTPS redirect and HSTS settings; and
- the frontend's public API URL build argument/runtime value.

The example is safe for localhost HTTP and clearly marked as unsuitable for an internet-facing deployment without changes.

## Documentation

Update the root README with:

- Docker Desktop Linux-container and Docker Engine prerequisites;
- copying `.env.example` to `.env` and replacing the development secret;
- build/start, logs, stop, and destructive volume-reset commands;
- Windows/Linux portability and named-volume rationale;
- rebuild behavior when `NEXT_PUBLIC_API_URL` changes;
- SQLite single-replica limitation; and
- production TLS, secure cookie, backup, and PostgreSQL considerations.

## Verification boundary

Per the user's direct instruction, do not build either image, run Compose, execute container health checks, or run automated tests for this item. Perform only source inspection and diff hygiene, and state clearly that the container definitions remain unexecuted.

## Recursive checks

### Lateral spread

Search all configuration documentation and runtime entry points for non-container paths, implicit settings, host-only URLs, root execution, writable bind mounts, and duplicated startup behavior. Confirm all Compose services use the same backend environment contract where applicable.

### Causal depth

Confirm the design addresses both causes behind the request: runnable container artifacts and Windows/Linux filesystem portability. Check build-time browser configuration, startup ordering, migration failure propagation, SQLite persistence, process signal handling, and non-root write access on paper even though execution is intentionally omitted.

## Commit boundary

One coherent commit will contain the dependency metadata, backend/frontend image definitions, Compose configuration, environment example, Next.js standalone setting, README Docker documentation, spec completion, and in-place TODO completion.

## Implementation results

- Used `docker init` independently for the detected Python and Node applications, then adapted its scaffolds to the approved monorepo design and removed the generated per-service Compose and README files.
- Added exact Python 3.12.2 and Node 22.18.0 multi-stage/runtime definitions with fixed non-root users, allowlisted build contexts, exec-form startup commands, and no writable host bind mounts.
- Added and locked Gunicorn 26.2.0 without installing it locally, set Next.js standalone output, and copied only the standalone runtime and public/static assets into the frontend runtime image.
- Added a root Compose environment contract and topology with a one-shot migration service, successful-completion and health dependencies, standard-library health checks, explicit fail-fast configuration interpolation, and a Docker-managed SQLite volume.
- Documented Windows/Linux operation, lifecycle commands, public build-time frontend configuration, destructive volume reset behavior, SQLite scaling limits, and production security requirements.
- Per direct instruction, no dependency install, automated test, image build, Compose parse/build/start, health check, or container smoke test was executed. The new definitions remain execution-unverified.

## Recursive check results

### Lateral spread

Searched application settings, runtime entry points, environment examples, Compose configuration, Dockerfiles, and README commands. Development-only `runserver` and local SQLite paths remain confined to the non-container development instructions. Container runtime paths consistently use `config.settings.base`, `/var/lib/spend-tracker/db.sqlite3`, Gunicorn, the named volume, and the public `NEXT_PUBLIC_API_URL`. No Compose host-user mapping, writable source bind mount, duplicated migration startup, or internal backend hostname is used as the browser API origin.

### Causal depth

The artifacts address both the requested runnable packaging and the underlying Windows/Linux permission concern: immutable Linux images run as internal non-root users while Docker owns mutable database storage. Source review also covered frontend build-time URL embedding, migration failure propagation, backend readiness ordering, persistent SQLite placement, empty-volume ownership inherited from the image mountpoint, and signal forwarding through exec-form commands plus Compose `init`. No additional contributing requirement was found in the inspected container scope; runtime behavior was intentionally not validated.
