"""Authentication use cases independent of HTTP response handling."""

from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@dataclass(frozen=True)
class TokenPair:
    access: str
    refresh: str


def create_user(*, email: str, password: str):
    try:
        with transaction.atomic():
            return User.objects.create_user(email=email, password=password)
    except (IntegrityError, DjangoValidationError) as exc:
        raise serializers.ValidationError(
            {"email": ["A user with this email already exists."]}
        ) from exc


def issue_token_pair(user) -> TokenPair:
    refresh = RefreshToken.for_user(user)
    return TokenPair(access=str(refresh.access_token), refresh=str(refresh))


def rotate_refresh_token(raw_token: str) -> TokenPair:
    serializer = TokenRefreshSerializer(data={"refresh": raw_token})
    try:
        serializer.is_valid(raise_exception=True)
    except User.DoesNotExist as exc:
        raise AuthenticationFailed("The session is no longer valid.") from exc
    except TokenError as exc:
        raise InvalidToken(str(exc)) from exc

    refresh = serializer.validated_data.get("refresh")
    if refresh is None:
        raise RuntimeError("Refresh token rotation must remain enabled.")
    return TokenPair(
        access=serializer.validated_data["access"],
        refresh=refresh,
    )


def blacklist_refresh_token(raw_token: str) -> None:
    try:
        RefreshToken(raw_token).blacklist()
    except TokenError:
        return
