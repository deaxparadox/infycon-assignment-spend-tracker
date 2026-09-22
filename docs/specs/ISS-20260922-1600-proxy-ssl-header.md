# ISS-20260922-1600 — Missing reverse-proxy SSL header would loop-redirect on Render

- **Status:** Implemented
- **Working branch:** `main`
- **Base branch:** `main`

## Problem

Found while preparing the Render deployment, before it was actually attempted: `config.settings.base` reads `DJANGO_SECURE_SSL_REDIRECT` and applies Django's `SecurityMiddleware` SSL redirect, but never sets `SECURE_PROXY_SSL_HEADER`. Render (like effectively every PaaS reverse proxy — Heroku, Railway, Fly, etc.) terminates TLS at its edge and forwards the request to the container over plain HTTP, setting `X-Forwarded-Proto: https` so the app can tell the original scheme was HTTPS.

Without `SECURE_PROXY_SSL_HEADER`, Django's `request.is_secure()` only looks at the actual (proxy-to-container) connection, which is plain HTTP, so it decides every request is insecure and issues an HTTPS redirect — on every single request, including the one it just redirected to, forever. Turning on `DJANGO_SECURE_SSL_REDIRECT=true` on Render, exactly as the README already instructs for any internet-facing deployment, would have made the backend permanently unreachable behind an infinite redirect loop, with no console access on Render's free tier to diagnose it after the fact.

## Fix

Added to `backend/src/config/settings/base.py`, immediately after `SECURE_SSL_REDIRECT`:

```python
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
```

This is inert wherever no reverse proxy sets that header (e.g. local Compose, where `DJANGO_SECURE_SSL_REDIRECT` is `false` anyway) and only takes effect once a trusted proxy is actually in front of the app — which `config.settings.base` (used by WSGI/ASGI, never local `manage.py` commands) always assumes.

Added `test_trusts_the_reverse_proxy_forwarded_proto_header` to `backend/tests/config/test_settings.py` asserting the setting's exact value.

## Recursive checks

### Lateral spread

Checked for any other place `is_secure()`/proxy trust matters (session/CSRF/refresh cookie `Secure` flags) — those are separate, already-correct boolean env flags (`SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `REFRESH_COOKIE_SECURE`) that don't depend on `is_secure()`; only the SSL *redirect* behavior was affected.

### Causal depth

Confirmed this is specifically a reverse-proxy TLS-termination issue, not a general HTTPS misconfiguration — verified by tracing how Django's `SecurityMiddleware` determines `is_secure()` and confirming Render's documented proxy behavior (TLS terminated at the edge, forwarded as HTTP with `X-Forwarded-Proto`).

## Acceptance criteria

- `django.conf.settings.SECURE_PROXY_SSL_HEADER` equals `("HTTP_X_FORWARDED_PROTO", "https")`.
- Full backend test suite passes (95/95).
- Behavior behind a proxy that sets `X-Forwarded-Proto: https` no longer redirects; local Compose/dev, which never sets that header and runs with `DJANGO_SECURE_SSL_REDIRECT=false`, is unaffected.

## Commit boundary

One commit contains the settings fix, the test, this spec, and the TODO entry.
