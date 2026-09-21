"""Summary query validation and public formatting."""

from decimal import Decimal

from rest_framework import serializers

from .money import AmountField
from .periods import MonthWindow, parse_month


class MonthField(serializers.CharField):
    def to_internal_value(self, data) -> MonthWindow:
        value = super().to_internal_value(data)
        try:
            return parse_month(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


class PercentageField(serializers.Field):
    def to_representation(self, value: Decimal) -> str:
        return f"{value:.2f}"


class SummaryQuerySerializer(serializers.Serializer):
    month = MonthField()


class CategorySpendSerializer(serializers.Serializer):
    category = serializers.CharField()
    amount = AmountField(source="amount_minor")


class InsightSerializer(serializers.Serializer):
    type = serializers.CharField()
    category = serializers.CharField()
    current_amount = AmountField(source="current_amount_minor")
    previous_amount = AmountField(source="previous_amount_minor")
    percentage = PercentageField(allow_null=True)
    message = serializers.CharField()


class MonthlySummarySerializer(serializers.Serializer):
    month = serializers.CharField()
    total = AmountField(source="total_minor")
    previous_month_total = AmountField(source="previous_month_total_minor")
    month_over_month_percentage = PercentageField(allow_null=True)
    spend_by_category = CategorySpendSerializer(many=True)
    insights = InsightSerializer(many=True)
