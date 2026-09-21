"""Expense write use cases."""

from .models import Expense


def create_expense(*, owner, validated_data: dict) -> Expense:
    return Expense.objects.create(owner=owner, **validated_data)
