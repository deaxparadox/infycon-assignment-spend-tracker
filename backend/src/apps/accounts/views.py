"""HTTP boundary for authentication."""

from django.conf import settings
from django.middleware.csrf import get_token, rotate_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from config.exceptions import api_exception_handler

from .cookies import delete_refresh_cookie, set_refresh_cookie
from .serializers import LoginSerializer, RegistrationSerializer, UserSerializer
from .services import (
    blacklist_refresh_token,
    create_user,
    issue_token_pair,
    rotate_refresh_token,
)


class PublicAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]


class CsrfView(PublicAPIView):
    def get(self, request) -> Response:
        return Response({"csrfToken": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(PublicAPIView):
    def post(self, request) -> Response:
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = create_user(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        return Response(
            {"user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_protect, name="dispatch")
class LoginView(PublicAPIView):
    def post(self, request) -> Response:
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        tokens = issue_token_pair(user)
        rotate_token(request)
        response = Response(
            {
                "access": tokens.access,
                "csrfToken": get_token(request),
                "user": UserSerializer(user).data,
            }
        )
        set_refresh_cookie(response, tokens.refresh)
        return response


@method_decorator(csrf_protect, name="dispatch")
class RefreshView(PublicAPIView):
    def post(self, request) -> Response:
        raw_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw_token:
            error = AuthenticationFailed("A valid refresh session is required.")
            response = api_exception_handler(error, {"request": request, "view": self})
            delete_refresh_cookie(response)
            return response

        try:
            tokens = rotate_refresh_token(raw_token)
        except AuthenticationFailed as exc:
            response = api_exception_handler(exc, {"request": request, "view": self})
            delete_refresh_cookie(response)
            return response

        response = Response({"access": tokens.access})
        set_refresh_cookie(response, tokens.refresh)
        return response


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(PublicAPIView):
    def post(self, request) -> Response:
        raw_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw_token:
            blacklist_refresh_token(raw_token)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        delete_refresh_cookie(response)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request) -> Response:
        return Response({"user": UserSerializer(request.user).data})
