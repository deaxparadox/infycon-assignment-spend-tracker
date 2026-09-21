from rest_framework.exceptions import ValidationError

from config.exceptions import api_exception_handler


def test_validation_errors_use_shared_envelope() -> None:
    response = api_exception_handler(
        ValidationError({"email": ["This field is required."]}),
        {},
    )

    assert response is not None
    assert response.status_code == 400
    assert response.data == {
        "error": {
            "code": "invalid",
            "message": "The request contains invalid values.",
            "fields": {"email": ["This field is required."]},
        }
    }
