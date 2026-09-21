"""JSON response for requests rejected by Django's CSRF middleware."""

from django.http import JsonResponse


def csrf_failure(request, reason="") -> JsonResponse:  # noqa: ARG001
    return JsonResponse(
        {
            "error": {
                "code": "csrf_failed",
                "message": "CSRF validation failed.",
            }
        },
        status=403,
    )
