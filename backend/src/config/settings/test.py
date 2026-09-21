"""Deterministic settings for automated tests."""

from __future__ import annotations

import os

os.environ.setdefault(
    "DJANGO_SECRET_KEY",
    "test-only-secret-key-with-more-than-fifty-characters-1234567890",
)
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", "testserver,localhost")
os.environ.setdefault("FRONTEND_ORIGIN", "http://localhost:3000")
os.environ.setdefault("SQLITE_PATH", ":memory:")
os.environ.setdefault("REFRESH_COOKIE_SECURE", "false")
os.environ.setdefault("DJANGO_SECURE_SSL_REDIRECT", "false")
os.environ.setdefault("DJANGO_SECURE_HSTS_SECONDS", "0")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")
os.environ.setdefault("CSRF_COOKIE_SECURE", "false")

from .base import *  # noqa: E402,F403

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
