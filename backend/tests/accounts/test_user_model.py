from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError


@pytest.mark.django_db
def test_create_user_normalizes_email_and_hashes_password() -> None:
    user = get_user_model().objects.create_user(
        email="  Person@Example.COM ",
        password="valid-test-password",
    )

    assert user.email == "person@example.com"
    assert user.check_password("valid-test-password")
    assert not user.is_staff
    assert not user.is_superuser


@pytest.mark.django_db
def test_create_superuser_sets_required_flags() -> None:
    user = get_user_model().objects.create_superuser(
        email="admin@example.com",
        password="valid-test-password",
    )

    assert user.is_staff
    assert user.is_superuser


@pytest.mark.django_db
def test_create_user_requires_email() -> None:
    with pytest.raises(ValueError, match="email address is required"):
        get_user_model().objects.create_user(email="", password="password")


@pytest.mark.django_db(transaction=True)
def test_email_is_unique_case_insensitively() -> None:
    user_model = get_user_model()
    user_model.objects.create_user("person@example.com", "password")

    with pytest.raises((IntegrityError, ValidationError)):
        user_model.objects.create_user("PERSON@example.com", "password")
