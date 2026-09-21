"""Consistent validation for scalar URL query parameters."""

from rest_framework import serializers


def validate_query_shape(query_params, *, allowed: set[str]) -> None:
    errors: dict[str, list[str]] = {}
    for key in query_params:
        if key not in allowed:
            errors[key] = ["This query parameter is not supported."]
        elif len(query_params.getlist(key)) != 1:
            errors[key] = ["Provide this query parameter exactly once."]
    if errors:
        raise serializers.ValidationError(errors)
