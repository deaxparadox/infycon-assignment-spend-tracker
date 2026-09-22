# ISS-20260922-1345 — Client bundle never received NEXT_PUBLIC_API_URL

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`
- **Related:** `docs/specs/ISS-20260922-1215-container-stack-first-run.md`

## Problem

After the `.dockerignore` fix in ISS-20260922-1215, `docker compose up --build` produced a running stack, but the browser threw `Uncaught Error: NEXT_PUBLIC_API_URL is required.` on every route that calls the API client (observed on `/summary`), even though `.env`/Compose supplied the value and the backend was reachable and healthy.

## Verified cause

`frontend/src/lib/config.ts` read the value indirectly:

```ts
export function getApiBaseUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const value = environment.NEXT_PUBLIC_API_URL?.trim();
```

Next.js inlines `NEXT_PUBLIC_*` values into client bundles only where the literal expression `process.env.NEXT_PUBLIC_API_URL` appears in the source. Here the code reads `process.env` into a variable and then does `environment.NEXT_PUBLIC_API_URL`, which never textually matches that pattern, so nothing gets inlined. In the browser the bundler's `process.env` shim has no such key, so the lookup is always `undefined` regardless of what value Docker, Compose, or a plain `next build` receives.

Confirmed by inspecting the built client chunks: `grep` found the literal string `NEXT_PUBLIC_API_URL` (the property name, left over from the throw message and the property access) but never the configured URL value itself. This is a source-level bug, not a Docker or Compose defect — it would reproduce identically with `next build && next start` outside any container.

## Fix

Changed the function to take the specific env value as its default parameter, which is the pattern Next.js's inliner recognizes:

```ts
export function getApiBaseUrl(
  rawValue: string | undefined = process.env.NEXT_PUBLIC_API_URL,
): string {
  const value = rawValue?.trim();
```

Updated `frontend/src/lib/config.test.ts` to pass a string (or `undefined`) instead of a fake environment object, matching the new signature. No caller changes were needed; `client.ts` already calls `getApiBaseUrl()` with no arguments.

## Recursive checks

### Lateral spread

`grep -rn "process\.env" frontend/src` found only this one occurrence, so no other indirect env reads exist in the frontend to fix.

### Causal depth

Verified the mechanism, not just the symptom: rebuilt locally and confirmed `.next/static/chunks` now contains the literal configured URL (`http://localhost:8000` in a local build, `http://localhost:8020` in the Compose image built from the real `.env`). Ran `npm run lint`, `npm run typecheck`, and the full `npm run test` suite (53 tests) after the change, then rebuilt the Docker image via `docker compose build frontend`, brought the full stack up with `docker compose up -d`, and confirmed `GET /summary` returns `200` and `GET /auth/csrf` returns `200` before tearing the stack down.

## Acceptance criteria

- The client bundle contains the literal configured `NEXT_PUBLIC_API_URL` value, not just the variable name.
- `getApiBaseUrl` still throws a clear error when the value is missing or invalid.
- Full frontend check suite (lint, typecheck, test) passes.
- `docker compose up --build` serves a working `/summary` page against the configured backend without a client-side "NEXT_PUBLIC_API_URL is required" error.

## Commit boundary

One commit contains the `config.ts`/`config.test.ts` fix, this spec, and the TODO entry.
