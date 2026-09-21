"""User-scoped expense read queries."""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from .models import Expense


def expenses_for_user(*, owner, filters: dict[str, Any]) -> QuerySet[Expense]:
    queryset = Expense.objects.filter(owner=owner)
    if category := filters.get("category"):
        queryset = queryset.filter(category=category)
    if start_date := filters.get("start_date"):
        queryset = queryset.filter(expense_date__gte=start_date)
    if end_date := filters.get("end_date"):
        queryset = queryset.filter(expense_date__lte=end_date)
    return queryset
