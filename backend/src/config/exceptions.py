"""REST API exception normalization."""

from __future__ import annotations

from typing import Any

from rest_framework.response import Response
from rest_framework.status import HTTP_500_INTERNAL_SERVER_ERROR
from rest_framework.views import exception_handler


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = exception_handler(exc, context)
    if response is None:
        return Response(
            {
                "error": {
                    "code": "server_error",
                    "message": "An unexpected error occurred.",
                }
            },
            status=HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = response.data
    fields: dict[str, Any] | None = None
    message = "The request could not be completed."

    if isinstance(detail, dict):
        if set(detail) == {"detail"}:
            message = str(detail["detail"])
        else:
            fields = detail
            message = "The request contains invalid values."
    elif isinstance(detail, list):
        message = " ".join(str(item) for item in detail)
    else:
        message = str(detail)

    code = getattr(exc, "default_code", "api_error")
    error: dict[str, Any] = {"code": str(code), "message": message}
    if fields is not None:
        error["fields"] = fields

    response.data = {"error": error}
    return response
