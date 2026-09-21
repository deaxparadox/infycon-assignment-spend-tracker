"""Exact conversion at the public money boundary."""

from __future__ import annotations

import re

from rest_framework import serializers

MAX_AMOUNT_MINOR = 9_007_199_254_740_991
AMOUNT_PATTERN = re.compile(r"^(?P<major>\d+)(?:\.(?P<fraction>\d{1,2}))?$")


def parse_amount_to_minor(value: str) -> int:
    match = AMOUNT_PATTERN.fullmatch(value)
    if match is None:
        raise serializers.ValidationError(
            "Enter a positive decimal string with at most two fractional digits."
        )

    fraction = (match.group("fraction") or "").ljust(2, "0")
    amount_minor = int(match.group("major")) * 100 + int(fraction or "0")
    if amount_minor <= 0:
        raise serializers.ValidationError("Amount must be greater than zero.")
    if amount_minor > MAX_AMOUNT_MINOR:
        raise serializers.ValidationError("Amount is too large.")
    return amount_minor


def format_minor_amount(amount_minor: int) -> str:
    major, fraction = divmod(amount_minor, 100)
    return f"{major}.{fraction:02d}"


class AmountField(serializers.Field):
    default_error_messages = {"not_string": "Amount must be provided as a decimal string."}

    def to_internal_value(self, data) -> int:
        if not isinstance(data, str):
            self.fail("not_string")
        return parse_amount_to_minor(data)

    def to_representation(self, value: int) -> str:
        return format_minor_amount(value)
