"""Environment-driven settings shared by every runtime."""

from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from django.core.exceptions import ImproperlyConfigured

SRC_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = SRC_DIR.parent


def database_config_from_url(url: str) -> dict:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed.path.lstrip("/"),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname,
        "PORT": parsed.port or 5432,
        "OPTIONS": {key: values[0] for key, values in query.items()},
    }


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ImproperlyConfigured(f"Required environment variable {name} is missing.")
    return value


def csv_env(name: str) -> list[str]:
    values = [value.strip() for value in required_env(name).split(",")]
    if not all(values):
        raise ImproperlyConfigured(f"Environment variable {name} contains an empty value.")
    return values


def boolean_env(name: str) -> bool:
    value = required_env(name).lower()
    if value not in {"true", "false"}:
        raise ImproperlyConfigured(f"Environment variable {name} must be true or false.")
    return value == "true"


def positive_int_env(name: str) -> int:
    value = required_env(name)
    try:
        parsed = int(value)
    except ValueError as exc:
        raise ImproperlyConfigured(f"Environment variable {name} must be an integer.") from exc
    if parsed <= 0:
        raise ImproperlyConfigured(f"Environment variable {name} must be greater than zero.")
    return parsed


def nonnegative_int_env(name: str) -> int:
    value = required_env(name)
    try:
        parsed = int(value)
    except ValueError as exc:
        raise ImproperlyConfigured(f"Environment variable {name} must be an integer.") from exc
    if parsed < 0:
        raise ImproperlyConfigured(f"Environment variable {name} cannot be negative.")
    return parsed


SECRET_KEY = required_env("DJANGO_SECRET_KEY")
DEBUG = False
ALLOWED_HOSTS = csv_env("DJANGO_ALLOWED_HOSTS")
FRONTEND_ORIGIN = required_env("FRONTEND_ORIGIN").rstrip("/")
SECURE_SSL_REDIRECT = boolean_env("DJANGO_SECURE_SSL_REDIRECT")
# Render, and most PaaS reverse proxies, terminate TLS and forward plain HTTP
# with this header set; without it, SECURE_SSL_REDIRECT sees every request as
# insecure and redirects it, causing an infinite redirect loop behind the proxy.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = nonnegative_int_env("DJANGO_SECURE_HSTS_SECONDS")
SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
SECURE_HSTS_PRELOAD = SECURE_HSTS_SECONDS > 0
SESSION_COOKIE_SECURE = boolean_env("SESSION_COOKIE_SECURE")
CSRF_COOKIE_SECURE = boolean_env("CSRF_COOKIE_SECURE")
CSRF_COOKIE_SAMESITE = required_env("CSRF_COOKIE_SAMESITE")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "apps.accounts.apps.AccountsConfig",
    "apps.expenses.apps.ExpensesConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

database_url = os.environ.get("DATABASE_URL", "").strip()
if database_url:
    DATABASES = {"default": database_config_from_url(database_url)}
else:
    database_name = required_env("SQLITE_PATH")
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": (
                database_name
                if database_name == ":memory:"
                else Path(database_name).expanduser().resolve()
            ),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

CORS_ALLOWED_ORIGINS = [FRONTEND_ORIGIN]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [FRONTEND_ORIGIN]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "EXCEPTION_HANDLER": "config.exceptions.api_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=positive_int_env("ACCESS_TOKEN_MINUTES")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=positive_int_env("REFRESH_TOKEN_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
}

REFRESH_COOKIE_NAME = required_env("REFRESH_COOKIE_NAME")
REFRESH_COOKIE_PATH = required_env("REFRESH_COOKIE_PATH")
REFRESH_COOKIE_SAMESITE = required_env("REFRESH_COOKIE_SAMESITE")
REFRESH_COOKIE_SECURE = boolean_env("REFRESH_COOKIE_SECURE")

for setting_name, same_site in {
    "REFRESH_COOKIE_SAMESITE": REFRESH_COOKIE_SAMESITE,
    "CSRF_COOKIE_SAMESITE": CSRF_COOKIE_SAMESITE,
}.items():
    if same_site not in {"Lax", "Strict", "None"}:
        raise ImproperlyConfigured(f"{setting_name} must be one of Lax, Strict, or None.")
if REFRESH_COOKIE_SAMESITE == "None" and not REFRESH_COOKIE_SECURE:
    raise ImproperlyConfigured(
        "REFRESH_COOKIE_SECURE must be true when REFRESH_COOKIE_SAMESITE is None."
    )
if CSRF_COOKIE_SAMESITE == "None" and not CSRF_COOKIE_SECURE:
    raise ImproperlyConfigured("CSRF_COOKIE_SECURE must be true when CSRF_COOKIE_SAMESITE is None.")
if SECURE_SSL_REDIRECT and not all(
    (REFRESH_COOKIE_SECURE, SESSION_COOKIE_SECURE, CSRF_COOKIE_SECURE)
):
    raise ImproperlyConfigured("Secure deployments must secure refresh, session, and CSRF cookies.")

CSRF_FAILURE_VIEW = "config.csrf.csrf_failure"
