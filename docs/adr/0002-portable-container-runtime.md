# ADR 0002 — Portable container runtime

- **Status:** Accepted
- **Date:** 2026-09-22
- **Decision owner:** Repository owner
- **Related item:** `FEAT-20260922-0842`

## Context

The application needs a Compose-based runtime that behaves consistently on Linux and on Windows through Docker Desktop's Linux-container environment. Mapping a container process to the current host UID/GID is Linux-specific, is awkward in Windows shells, and is unnecessary when containers do not write into bind-mounted host source directories.

The current backend persists SQLite at a configurable path and fails early when production configuration is absent. The current frontend reads `NEXT_PUBLIC_API_URL` at build time and uses dynamic Next.js routes. There are no Docker definitions or production WSGI server dependency yet.

## Decision

1. Build immutable Linux images from the official `python:3.12.2-slim-bookworm` and `node:22.18.0-bookworm-slim` images.
2. Run each application as a fixed non-root user inside its image. Compose will not set a host-derived `user` value.
3. Do not bind-mount source code or database files. Persist SQLite in a Docker-managed named volume mounted at an application-owned directory.
4. Add Gunicorn 26.2.0 as the backend's pinned production WSGI server. It runs inside a Linux image, so its POSIX runtime does not reduce Windows-host portability.
5. Build the frontend as a multi-stage Next.js standalone image and copy only its traced runtime, static files, and public assets into the final stage.
6. Run database migrations as a one-shot Compose service. Start the API only after migrations complete successfully, and start the frontend only after the API health check succeeds.
7. Require Compose configuration through root environment interpolation. Keep the public browser API origin as a frontend build argument; never substitute the internal Compose hostname because browser requests originate outside the Compose network.
8. Treat the supplied Compose settings as a local assessment/deployment-shaped stack over HTTP. An internet-facing deployment still requires TLS termination, secure cookie flags, appropriate host/origin values, backups, and a production database decision.

## Consequences

- The same Compose file can run through Docker Engine on Linux or Linux containers in Docker Desktop without host UID/GID scripting.
- Docker owns the SQLite volume and its Linux permissions. Host users manage it with Docker volume commands rather than editing the database file directly.
- Images are smaller and do not contain development dependencies in the frontend runtime stage.
- SQLite remains suitable for one API replica. Horizontal scaling would require moving persistence to PostgreSQL or another server database.
- `NEXT_PUBLIC_API_URL` changes require rebuilding the frontend image.
- Gunicorn becomes a new pinned runtime dependency and must remain in both project metadata and the lock file.

## Rejected alternatives

- **Host UID/GID interpolation:** not portable to Windows and unnecessary without writable bind mounts.
- **Bind-mounted SQLite file:** exposes host filesystem permission and file-sharing differences and is slower on Docker Desktop.
- **Running containers as root:** simpler initially but grants avoidable privileges inside the container.
- **Django development server:** not an appropriate deployment runtime.
- **Static Next.js export:** would give up server-rendered App Router behavior that the current application uses.
