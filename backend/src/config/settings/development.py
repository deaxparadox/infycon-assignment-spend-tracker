"""Explicit local-development settings."""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[3]

os.environ.setdefault("DJANGO_SECRET_KEY", "development-only-not-for-production")
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
os.environ.setdefault("FRONTEND_ORIGIN", "http://localhost:3000")
os.environ.setdefault("SQLITE_PATH", str(BACKEND_DIR / "db.sqlite3"))
os.environ.setdefault("ACCESS_TOKEN_MINUTES", "10")
os.environ.setdefault("REFRESH_TOKEN_DAYS", "7")
os.environ.setdefault("REFRESH_COOKIE_NAME", "refresh_token")
os.environ.setdefault("REFRESH_COOKIE_PATH", "/auth/")
os.environ.setdefault("REFRESH_COOKIE_SAMESITE", "Lax")
os.environ.setdefault("REFRESH_COOKIE_SECURE", "false")
os.environ.setdefault("DJANGO_SECURE_SSL_REDIRECT", "false")
os.environ.setdefault("DJANGO_SECURE_HSTS_SECONDS", "0")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")
os.environ.setdefault("CSRF_COOKIE_SECURE", "false")
os.environ.setdefault("CSRF_COOKIE_SAMESITE", "Lax")

from .base import *  # noqa: E402,F403

DEBUG = True
