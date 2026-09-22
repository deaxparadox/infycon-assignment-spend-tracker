# ISS-20260922-1420 — Every API call failed in a real browser (detached fetch)

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`
- **Related:** `docs/specs/ISS-20260922-1345-client-env-inlining.md`

## Problem

After the env-inlining fix in ISS-20260922-1345, a Canary browser-automation session driving the actual running stack (`http://localhost:3020`) found that login still failed: the form showed "Unable to sign in. Please try again." and no request to `/auth/*` was ever sent. This had not been caught by curl-based smoke testing or by the frontend's automated test suite, both of which had passed.

## Verified cause

`frontend/src/lib/api/client.ts`:

```ts
this.fetchImplementation = options.fetchImplementation ?? fetch;
```

This captures a reference to the global `fetch` function, detached from its receiver. The class later invokes it as a method: `this.fetchImplementation(url, init)`. Browsers implement `fetch` as receiver-branded to `window` (an illegal-invocation check), so calling it through `this.fetchImplementation(...)` — where `this` is the `ApiClient` instance, not `window` — throws `TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation`. Every API call the app makes (CSRF bootstrap, login, refresh, expenses, summary) goes through this path, so the entire app was non-functional in a real browser.

Confirmed via a Canary session reproducing the exact error with `page.evaluate`, and by independently verifying the backend, CORS, and `NEXT_PUBLIC_API_URL` baking were all correct — a plain, non-detached `fetch()` call to the same backend from the same page succeeded.

This bug was invisible to the existing automated tests because every test in `client.test.ts` explicitly injects its own `fetchImplementation` mock; none exercised the `?? fetch` default-fallback branch, and jsdom's `fetch`/`Response` are not receiver-branded the way real browsers are, so even a jsdom-based reproduction would not have failed.

## Fix

Bind the fallback to `globalThis` so it stays callable regardless of the receiver it's invoked through:

```ts
this.fetchImplementation = options.fetchImplementation ?? fetch.bind(globalThis);
```

Added a regression test in `frontend/src/lib/api/client.test.ts` that stubs `globalThis.fetch` with a function asserting `this === globalThis` (simulating a browser's receiver-branding check) and constructs an `ApiClient` with no `fetchImplementation` override, forcing it through the default-fallback branch. Verified the test fails with the exact "Illegal invocation" error against the pre-fix code and passes against the fix.

## Recursive checks

### Lateral spread

`grep -rn "process\.env\|\bfetch\b" frontend/src/lib/api/client.ts` shows `fetch` is referenced in exactly this one place as a bare identifier; no other code path captures a detached browser-branded API the same way.

### Causal depth

Verified the mechanism end-to-end, not just the symptom: reproduced the failure and the fix with a real browser (Canary session, not jsdom), added a regression test that reproduces the same receiver-branding failure mode without needing a real browser, confirmed the test fails on the old code and passes on the new code, ran the full frontend check suite (lint, typecheck, 54 tests), rebuilt the Docker image, and re-ran a full Canary session against the rebuilt, running Compose stack.

## Acceptance criteria

- Login, summary, expense listing/filtering, and logout all work end-to-end against the running Docker Compose stack in a real browser.
- No "Illegal invocation" errors anywhere in the browser console during the flow.
- A regression test exists that fails on the pre-fix code and passes on the fix, independent of jsdom's non-receiver-branded `fetch`.
- Full frontend check suite passes.

## Verification (Canary sessions)

- **First session** (pre-fix): `/home/lap-68/.canary/sessions/spend-tracker-core-flow-muc822mb-fe0de2/report.html` — reproduced the root cause; login blocked, summary/expenses/filter/create untestable, logout redirect also broken as a secondary symptom.
- **Second session** (post-fix, rebuilt image): `/home/lap-68/.canary/sessions/spend-tracker-core-flow-recheck-muc8a5t1-619935/report.html` — login succeeds (`200`), summary renders real data matching the seeded expenses, expenses list and category filter work and update the URL, logout redirects to `/login`, and a subsequent direct navigation to `/summary` correctly redirects to `/login?next=%2Fsummary` instead of getting stuck on an error screen. No new issues found; the only console entry was an expected `401` on the post-logout auth check.

## Commit boundary

One commit contains the `client.ts` fix, the `client.test.ts` regression test, this spec, and the TODO entry.
