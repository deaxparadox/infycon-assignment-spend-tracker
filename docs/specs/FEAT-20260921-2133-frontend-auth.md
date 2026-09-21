# FEAT-20260921-2133 — Frontend authentication and routed shell

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`
- **Depends on:** `FEAT-20260921-2129`, `FEAT-20260921-2130`

## Need

The Next.js frontend needs URL-addressable registration/login pages and a protected application shell. The access token must remain memory-only while a refresh cookie restores a session after a full page load.

## Routes

- `/` redirects to `/summary`.
- `/login` provides email/password login.
- `/register` provides email/password/password-confirmation registration.
- Protected routes live under a route group that does not change their public URLs.
- Unknown paths render `not-found.tsx`.
- Route-level loading and error boundaries are explicit.

## Authentication state machine

Use a discriminated union with `loading`, `authenticated`, and `anonymous` states. Do not use a nullable token alone to distinguish startup from logged-out state.

On application startup:

1. Enter `loading`.
2. Obtain CSRF state when needed.
3. Attempt one credentialed `/auth/refresh` call.
4. On success, keep the access token only in provider memory and store safe user data in memory.
5. On a normal invalid/missing refresh response, enter `anonymous`.
6. On network or server failure, present a retryable error rather than claiming the session is anonymous.

Protected content waits for bootstrap completion. Anonymous users are sent to `/login?next=<path>`. Only local application paths are accepted as `next` destinations.

## API client

- Add `Authorization: Bearer` only when an access token is present.
- Add `credentials: include` only for cookie-relevant requests.
- Parse the shared backend error envelope into typed frontend errors.
- On an eligible protected-request `401`, coordinate one refresh promise across concurrent requests.
- Retry each original request at most once.
- Never refresh recursively when login/refresh itself returns `401`.
- Clear authentication state after terminal refresh failure.
- Support abort signals and do not convert cancellation into an authentication error.

## Forms

Registration and login use accessible labels, correct email/password autocomplete values, disabled submitting state, top-level errors, and backend field-error mapping. They do not log request bodies or tokens.

Registration succeeds without assuming an access token unless the backend contract explicitly returns one; the initial contract routes the user to login with a visible success message.

## Storage and rendering rules

- No token in local storage, session storage, IndexedDB, cookies readable by JavaScript, URLs, or logs.
- The HTTP-only refresh cookie is managed only by the backend/browser.
- Authenticated data fetching stays inside narrow Client Component boundaries because Server Components and middleware cannot read the memory-only access token.
- Route files remain composition-focused; authentication logic stays under `features/auth` and `lib/auth`.

## Tests

- Startup refresh transitions to authenticated, anonymous, and retryable-error states correctly.
- Access token never reaches browser storage APIs.
- Login and registration map field/general errors.
- Protected routes wait during bootstrap and redirect only after anonymous state is known.
- `next` accepts local paths and rejects external/protocol-relative redirects.
- Concurrent `401` responses perform one refresh.
- Requests retry at most once and do not loop.
- Failed refresh clears the authenticated state.
- Logout calls the backend, clears memory state, and routes to login.
- Root, auth, protected, loading, error, and not-found routes behave as specified.

## Recursive checks

### Lateral spread

Search every storage API, log call, URL builder, request wrapper, route guard, and error handler for token leakage or duplicated refresh logic. Review every protected route for use of the shared shell.

### Causal depth

Confirm login, registration, session restoration, expiry recovery, concurrency, network failure, logout, safe redirect, and route accessibility. A successful login form alone does not complete frontend authentication.

## Commit boundary

One frontend-auth commit will contain routed auth pages, provider/state machine, protected shell, API client refresh coordination, tests, and the in-place completion of this TODO item.

## Verification results

### Lateral spread

Source-wide searches found no production use of local storage, session storage, IndexedDB, JavaScript-readable auth cookies, token logging, or direct fetch calls outside the shared API client. All protected pages are nested under the one protected route-group layout, all programmatic `next` navigation passes through the local-path validator, and refresh coordination exists only in the API client.

### Causal depth

Tests cover authenticated, anonymous, and retryable-error startup states; memory-only token handling; backend field/general form errors; registration without token assumptions; delayed protected-route redirect; safe redirect validation; shared concurrent refresh; one retry; auth-route non-recursion; terminal refresh clearing; cancellation preservation; cookie credentials; and explicit logout. The production build verifies root, auth, protected, loading, error, and not-found route conventions.
