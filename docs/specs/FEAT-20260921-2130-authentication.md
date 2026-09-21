# FEAT-20260921-2130 — Authentication

- **Status:** Approved
- **Working branch:** `main`
- **Base branch:** `main`
- **Depends on:** `FEAT-20260921-2129`
- **ADR:** `docs/adr/0001-django-nextjs-jwt-architecture.md`

## Need

Authentication is baseline scope. Expense and summary data must be private to an email-identified user. The agreed browser session design keeps a short-lived access JWT in memory and a rotating refresh JWT in an HTTP-only cookie.

## Verified design constraints

- Django supplies the custom email user and password hashing.
- DRF authentication alone identifies a user; permissions must separately require authentication.
- Simple JWT's standard refresh endpoint expects a token in JSON and therefore does not directly satisfy the approved cookie transport.
- Cookie-authenticated refresh/logout actions require explicit cross-site request protection.

## API contract

| Method | Path | Access | Success |
|---|---|---|---|
| `GET` | `/auth/csrf` | Public | Set/return CSRF bootstrap data without secrets |
| `POST` | `/auth/register` | Public | Create a user; return safe user data |
| `POST` | `/auth/login` | Public | Return access JWT and safe user data; set refresh cookie |
| `POST` | `/auth/refresh` | Refresh cookie | Rotate refresh token; return new access JWT; replace cookie |
| `POST` | `/auth/logout` | Refresh cookie when present | Blacklist token and clear cookie; idempotent success |
| `GET` | `/auth/me` | Bearer access JWT | Return safe authenticated user data |

Registration accepts email, password, and password confirmation. It applies Django password validators and never returns or logs either password.

Login errors do not reveal whether an email exists. Authentication failures return `401` with the shared error envelope and an appropriate `WWW-Authenticate` header.

## Token and cookie policy

- Initial access lifetime: 10 minutes.
- Initial refresh lifetime: 7 days.
- Refresh rotation: enabled.
- Blacklist after rotation: enabled.
- Refresh token transport: HTTP-only cookie only; never response JSON.
- Access token transport: response JSON and `Authorization: Bearer` request header.
- Cookie path: `/auth/`.
- `Secure`: required outside explicit local development.
- `SameSite`: explicit and compatible with the configured frontend/backend topology.
- CORS credentials: allowed only for the configured frontend origin.
- CSRF/origin validation: required for cookie-authenticated unsafe auth operations.

Required cookie settings must be internally consistent. For example, a production cross-site `SameSite=None` cookie without `Secure=true` must fail configuration validation.

## Service boundaries

- Serializers validate registration and login bodies.
- Services create users and issue/rotate/blacklist tokens.
- Views own cookie creation/deletion and HTTP status mapping.
- DRF permissions require authenticated access by default, with explicit public exceptions for bootstrap/register/login/refresh.
- Raw tokens, passwords, and cookie contents never enter application logs.

## Failure behavior

- Duplicate email: field validation error without database traceback.
- Weak password: field validation errors from Django validators.
- Invalid credentials: generic authentication error.
- Missing/expired/blacklisted refresh token: `401`, clear unusable cookie when appropriate.
- Missing/expired/invalid access token: `401`.
- Authenticated but unauthorized action: `403`.
- Logout with no cookie: idempotent `204` and cookie deletion instruction.

## Tests

- Email normalization and case-insensitive duplicate rejection.
- Weak-password and mismatched-confirmation rejection.
- Valid registration and safe response fields.
- Valid login sets the correct cookie flags and excludes refresh token from JSON.
- Invalid login does not disclose account existence.
- `/auth/me` requires and accepts a valid access token.
- Refresh rotates tokens, replaces the cookie, and blacklists the previous token.
- Reusing a rotated or logged-out refresh token fails.
- Logout clears the cookie and is idempotent.
- Missing/invalid CSRF or untrusted origin fails where required.
- Cookie settings differ explicitly between local tests and secure production configuration.

## Recursive checks

### Lateral spread

Review every API route for an explicit permission policy, every response/log path for token leakage, every cookie write/delete site for matching attributes, and every user lookup for normalized email behavior.

### Causal depth

Confirm authentication covers identity, authorization, cross-user isolation prerequisites, page reload restoration, token expiry, concurrent refresh, logout invalidation, and safe failure responses. Successful login alone does not complete this item.

## Commit boundary

One authentication commit will include backend endpoints, token/cookie configuration, migrations required by the blacklist app, tests, and the in-place completion of this TODO item. Frontend session state remains in its later item.
