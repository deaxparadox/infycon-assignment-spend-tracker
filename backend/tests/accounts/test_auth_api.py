from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

pytestmark = pytest.mark.django_db

TRUSTED_ORIGIN = "http://localhost:3000"
VALID_PASSWORD = "correct-horse-battery-staple-42"


def csrf_client() -> tuple[APIClient, str]:
    client = APIClient(enforce_csrf_checks=True)
    response = client.get("/auth/csrf")
    assert response.status_code == 200
    return client, response.data["csrfToken"]


def post_with_csrf(
    client: APIClient,
    path: str,
    data: dict[str, Any] | None,
    csrf_token: str,
    *,
    origin: str = TRUSTED_ORIGIN,
):
    return client.post(
        path,
        data or {},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token,
        HTTP_ORIGIN=origin,
    )


def create_user(email: str = "person@example.com", password: str = VALID_PASSWORD):
    return get_user_model().objects.create_user(email=email, password=password)


def login(client: APIClient, csrf_token: str, *, email: str = "person@example.com"):
    return post_with_csrf(
        client,
        "/auth/login",
        {"email": email, "password": VALID_PASSWORD},
        csrf_token,
    )


def test_register_creates_normalized_user_and_returns_safe_fields() -> None:
    client, csrf_token = csrf_client()

    response = post_with_csrf(
        client,
        "/auth/register",
        {
            "email": "Person@Example.COM",
            "password": VALID_PASSWORD,
            "password_confirmation": VALID_PASSWORD,
        },
        csrf_token,
    )

    assert response.status_code == 201
    assert response.data["user"] == {
        "id": get_user_model().objects.get().id,
        "email": "person@example.com",
    }
    assert "password" not in response.data["user"]


@pytest.mark.parametrize(
    ("password", "confirmation", "field"),
    [
        ("short", "short", "password"),
        (VALID_PASSWORD, "different-password", "password_confirmation"),
    ],
)
def test_register_rejects_weak_or_mismatched_passwords(
    password: str,
    confirmation: str,
    field: str,
) -> None:
    client, csrf_token = csrf_client()

    response = post_with_csrf(
        client,
        "/auth/register",
        {
            "email": "person@example.com",
            "password": password,
            "password_confirmation": confirmation,
        },
        csrf_token,
    )

    assert response.status_code == 400
    assert field in response.data["error"]["fields"]
    assert not get_user_model().objects.exists()


def test_register_rejects_case_insensitive_duplicate() -> None:
    create_user()
    client, csrf_token = csrf_client()

    response = post_with_csrf(
        client,
        "/auth/register",
        {
            "email": "PERSON@example.com",
            "password": VALID_PASSWORD,
            "password_confirmation": VALID_PASSWORD,
        },
        csrf_token,
    )

    assert response.status_code == 400
    assert "email" in response.data["error"]["fields"]
    assert get_user_model().objects.count() == 1


def test_login_normalizes_email_and_sets_http_only_refresh_cookie() -> None:
    create_user()
    client, csrf_token = csrf_client()

    response = login(client, csrf_token, email="PERSON@EXAMPLE.COM")

    assert response.status_code == 200
    assert set(response.data) == {"access", "csrfToken", "user"}
    assert "refresh" not in response.data
    assert response.data["user"]["email"] == "person@example.com"
    cookie = response.cookies[settings.REFRESH_COOKIE_NAME]
    assert cookie["httponly"] is True
    assert cookie["path"] == settings.REFRESH_COOKIE_PATH
    assert cookie["samesite"] == settings.REFRESH_COOKIE_SAMESITE
    assert bool(cookie["secure"]) is settings.REFRESH_COOKIE_SECURE


def test_invalid_login_does_not_disclose_whether_email_exists() -> None:
    create_user()
    client, csrf_token = csrf_client()

    wrong_password = post_with_csrf(
        client,
        "/auth/login",
        {"email": "person@example.com", "password": "wrong-password"},
        csrf_token,
    )
    missing_user = post_with_csrf(
        client,
        "/auth/login",
        {"email": "missing@example.com", "password": "wrong-password"},
        csrf_token,
    )

    assert wrong_password.status_code == missing_user.status_code == 401
    assert wrong_password.data == missing_user.data
    assert wrong_password["WWW-Authenticate"].startswith("Bearer")


def test_me_requires_and_accepts_bearer_access_token() -> None:
    create_user()
    client, csrf_token = csrf_client()
    unauthenticated = client.get("/auth/me")
    login_response = login(client, csrf_token)

    authenticated = client.get(
        "/auth/me",
        HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}",
    )

    assert unauthenticated.status_code == 401
    assert unauthenticated["WWW-Authenticate"].startswith("Bearer")
    assert authenticated.status_code == 200
    assert authenticated.data["user"]["email"] == "person@example.com"


def test_refresh_rotates_cookie_and_rejects_reuse() -> None:
    create_user()
    client, csrf_token = csrf_client()
    login_response = login(client, csrf_token)
    old_refresh = login_response.cookies[settings.REFRESH_COOKIE_NAME].value
    rotated_csrf = login_response.data["csrfToken"]

    refresh_response = post_with_csrf(client, "/auth/refresh", None, rotated_csrf)
    new_refresh = refresh_response.cookies[settings.REFRESH_COOKIE_NAME].value

    assert refresh_response.status_code == 200
    assert set(refresh_response.data) == {"access"}
    assert new_refresh != old_refresh
    assert BlacklistedToken.objects.filter(token__jti__isnull=False).count() == 1

    client.cookies[settings.REFRESH_COOKIE_NAME] = old_refresh
    reused = post_with_csrf(client, "/auth/refresh", None, rotated_csrf)

    assert reused.status_code == 401
    assert reused.cookies[settings.REFRESH_COOKIE_NAME].value == ""


@pytest.mark.parametrize("refresh_value", [None, "not-a-token", "expired"])
def test_refresh_rejects_missing_invalid_or_expired_cookie(refresh_value: str | None) -> None:
    user = create_user()
    client, csrf_token = csrf_client()
    if refresh_value == "expired":
        token = RefreshToken.for_user(user)
        token.set_exp(lifetime=timedelta(seconds=-1))
        refresh_value = str(token)
    if refresh_value is not None:
        client.cookies[settings.REFRESH_COOKIE_NAME] = refresh_value

    response = post_with_csrf(client, "/auth/refresh", None, csrf_token)

    assert response.status_code == 401
    assert response.cookies[settings.REFRESH_COOKIE_NAME].value == ""


def test_refresh_rejects_session_for_deleted_user() -> None:
    user = create_user()
    client, csrf_token = csrf_client()
    login_response = login(client, csrf_token)
    rotated_csrf = login_response.data["csrfToken"]
    user.delete()

    response = post_with_csrf(client, "/auth/refresh", None, rotated_csrf)

    assert response.status_code == 401
    assert response.cookies[settings.REFRESH_COOKIE_NAME].value == ""


def test_logout_blacklists_refresh_and_is_idempotent_without_cookie() -> None:
    create_user()
    client, csrf_token = csrf_client()
    login_response = login(client, csrf_token)
    refresh = login_response.cookies[settings.REFRESH_COOKIE_NAME].value
    rotated_csrf = login_response.data["csrfToken"]

    logout_response = post_with_csrf(client, "/auth/logout", None, rotated_csrf)

    assert logout_response.status_code == 204
    assert logout_response.cookies[settings.REFRESH_COOKIE_NAME].value == ""
    assert BlacklistedToken.objects.count() == 1

    client.cookies.pop(settings.REFRESH_COOKIE_NAME, None)
    second_logout = post_with_csrf(client, "/auth/logout", None, rotated_csrf)
    assert second_logout.status_code == 204

    client.cookies[settings.REFRESH_COOKIE_NAME] = refresh
    rejected = post_with_csrf(client, "/auth/refresh", None, rotated_csrf)
    assert rejected.status_code == 401


def test_unsafe_auth_endpoints_reject_missing_csrf_and_untrusted_origin() -> None:
    create_user()
    no_csrf_client = APIClient(enforce_csrf_checks=True)

    missing_csrf = no_csrf_client.post(
        "/auth/login",
        {"email": "person@example.com", "password": VALID_PASSWORD},
        format="json",
        HTTP_ORIGIN=TRUSTED_ORIGIN,
    )
    client, csrf_token = csrf_client()
    untrusted_origin = post_with_csrf(
        client,
        "/auth/login",
        {"email": "person@example.com", "password": VALID_PASSWORD},
        csrf_token,
        origin="https://attacker.example",
    )

    assert missing_csrf.status_code == 403
    assert missing_csrf.json()["error"]["code"] == "csrf_failed"
    assert untrusted_origin.status_code == 403
    assert untrusted_origin.json()["error"]["code"] == "csrf_failed"


def test_cookie_authenticated_refresh_requires_csrf_header() -> None:
    create_user()
    client, csrf_token = csrf_client()
    login_response = login(client, csrf_token)

    response = client.post(
        "/auth/refresh",
        {},
        format="json",
        HTTP_ORIGIN=TRUSTED_ORIGIN,
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_failed"
    assert settings.REFRESH_COOKIE_NAME in login_response.cookies


@override_settings(REFRESH_COOKIE_SECURE=True, REFRESH_COOKIE_SAMESITE="None")
def test_secure_cookie_settings_are_applied_explicitly() -> None:
    create_user()
    client, csrf_token = csrf_client()

    response = login(client, csrf_token)

    cookie = response.cookies[settings.REFRESH_COOKIE_NAME]
    assert cookie["secure"] is True
    assert cookie["samesite"] == "None"
