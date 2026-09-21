"""User-scoped expense read queries."""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet, Sum

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


def category_totals_for_period(*, owner, start_date, end_date) -> dict[str, int]:
    rows = (
        Expense.objects.filter(
            owner=owner,
            expense_date__gte=start_date,
            expense_date__lt=end_date,
        )
        .order_by()
        .values("category")
        .annotate(total_minor=Sum("amount_minor"))
    )
    return {row["category"]: int(row["total_minor"]) for row in rows}
