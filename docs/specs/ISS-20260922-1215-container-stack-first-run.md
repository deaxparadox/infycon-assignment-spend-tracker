# ISS-20260922-1215 — First container-stack execution defects

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`
- **Related:** `docs/specs/FEAT-20260922-0842-container-stack.md`

## Problem

The container stack (`compose.yaml`, backend/frontend Dockerfiles, `.dockerignore` files) was added in FEAT-20260922-0842 but, per that spec's verification boundary, was never built or run. On its first real execution (`docker compose up --build` attempted on Windows, then diagnosed on this Linux machine) two problems surfaced that had not been logged as spec work.

## Verified causes

1. **Frontend Docker build failure.** `frontend/.dockerignore` uses a deny-all-then-allowlist pattern (`*` then explicit `!` entries) that never allowlisted `vitest.setup.ts` or `vitest.config.mts`. `next build`'s TypeScript check runs over every file matched by `tsconfig.json`'s `include` (`**/*.ts`, `**/*.tsx`, `**/*.mts`), which includes the `*.test.tsx` files and `vitest.setup.ts`. `vitest.setup.ts` imports `@testing-library/jest-dom/vitest`, whose module augmentation is what makes jest-dom matchers (`toBeVisible`, `toHaveTextContent`, `toBeInTheDocument`, etc.) type-check against `vitest`'s `Assertion` type. Because the setup file was excluded from the Docker build context, that augmentation never loaded inside the image, and the `builder` stage failed at `RUN npm run build` with roughly thirty `TS2339` "property does not exist" errors across every `*.test.tsx` file. Reproduced outside Docker by temporarily removing `vitest.setup.ts` and getting an identical error list — the failure is a build-context defect, not platform-specific, and would reproduce identically on Windows.
2. **Compose file rename and port remap.** The root Compose file was renamed from `compose.yaml` to `docker-compose.yaml` and its host port bindings changed from `8000`/`3000` to `8020`/`3020` (backend/frontend respectively), to avoid local port conflicts. Both filenames are recognized by the `docker compose` CLI. The local, gitignored `.env` was updated to match (`NEXT_PUBLIC_API_URL=http://localhost:8020`, `FRONTEND_ORIGIN=http://localhost:3020`), so the stack is internally consistent. `.env.example`, `README.md`, and `docs/adr/0002-portable-container-runtime.md` document the original `8000`/`3000` defaults and were intentionally left unchanged, since those remain the shareable defaults; the rename and port remap are this contributor's local-environment override only.

## Fix

1. Added `!vitest.config.mts` and `!vitest.setup.ts` to `frontend/.dockerignore`.
2. Kept the `compose.yaml` → `docker-compose.yaml` rename and the `8020`/`3020` host port remap as committed local-environment state. No documentation changes were needed: `.env.example` still documents the shareable defaults, and the override lives only in the gitignored `.env`.

## Recursive checks

### Lateral spread

Searched for other root-level `.ts`/`.mts` files that `tsconfig.json`'s `include` would pick up but `frontend/.dockerignore` might still exclude. `next.config.ts` and `tsconfig.json` were already allowlisted; `eslint.config.mjs` is not matched by `include` and does not need to be. No other gap found.

### Causal depth

Reproduced the exact `TS2339` error set locally (outside Docker) by removing `vitest.setup.ts`, confirming the missing build-context file — not Linux, Node version, or Docker layer caching — was the cause. Confirmed the fix by running `docker build` directly on `frontend/Dockerfile` to a clean finish, then removed the test image.

## Acceptance criteria

- `docker build` on `frontend/Dockerfile` completes without TypeScript errors.
- `docker compose up --build` builds the frontend image cleanly.
- The renamed Compose file and its local port remap remain internally consistent with the gitignored `.env`, without altering the documented shareable defaults.

## Commit boundary

One commit contains the `.dockerignore` fix, the `compose.yaml` → `docker-compose.yaml` rename with its port remap, this spec, and the TODO entry.
