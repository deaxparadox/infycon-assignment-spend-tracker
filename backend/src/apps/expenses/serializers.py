"""Expense request validation and public representations."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from .categories import normalize_category
from .models import Expense
from .money import AmountField


class StrictCharField(serializers.CharField):
    default_error_messages = {
        **serializers.CharField.default_error_messages,
        "not_string": "Must be a string.",
    }

    def to_internal_value(self, data) -> str:
        if not isinstance(data, str):
            self.fail("not_string")
        return super().to_internal_value(data)


class ExpenseSerializer(serializers.ModelSerializer):
    amount = AmountField(source="amount_minor")
    category = StrictCharField(trim_whitespace=False)
    note = StrictCharField(required=False, allow_blank=True, max_length=500, default="")
    date = serializers.DateField(source="expense_date")

    class Meta:
        model = Expense
        fields = (
            "id",
            "amount",
            "category",
            "note",
            "date",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_category(self, value: str) -> str:
        normalized = normalize_category(value)
        if not normalized:
            raise serializers.ValidationError("Category cannot be blank.")
        if len(normalized) > 100:
            raise serializers.ValidationError("Category cannot exceed 100 characters.")
        return normalized


class ExpenseQuerySerializer(serializers.Serializer):
    category = StrictCharField(required=False, trim_whitespace=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=100, default=20)
    offset = serializers.IntegerField(required=False, min_value=0, default=0)

    def validate_category(self, value: str) -> str:
        normalized = normalize_category(value)
        if not normalized:
            raise serializers.ValidationError("Category cannot be blank.")
        if len(normalized) > 100:
            raise serializers.ValidationError("Category cannot exceed 100 characters.")
        return normalized

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError(
                {"end_date": ["End date must be on or after start date."]}
            )
        return attrs
