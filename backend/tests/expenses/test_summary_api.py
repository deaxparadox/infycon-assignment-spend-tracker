from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.expenses.models import Expense
from apps.expenses.periods import parse_month
from apps.expenses.selectors import category_totals_for_period
from apps.expenses.summary import build_monthly_summary, percentage_change

pytestmark = pytest.mark.django_db


def authenticated_client() -> tuple[APIClient, object]:
    user = get_user_model().objects.create_user("person@example.com", "password")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def add_expense(owner, amount_minor: int, category: str, expense_date: date) -> Expense:
    return Expense.objects.create(
        owner=owner,
        amount_minor=amount_minor,
        category=category,
        expense_date=expense_date,
    )


@pytest.mark.parametrize(
    "query",
    [
        "",
        "month=2026-1",
        "month=2026-13",
        "month=not-a-month",
        "month=0000-01",
        "month=9999-12",
        "month=2026-09&month=2026-10",
        "month=2026-09&unknown=value",
    ],
)
def test_summary_rejects_missing_malformed_or_repeated_month(query: str) -> None:
    client, _ = authenticated_client()

    response = client.get(f"/summary?{query}" if query else "/summary")

    assert response.status_code == 400
    assert response.data["error"]["fields"]


def test_empty_months_return_explicit_zero_semantics() -> None:
    client, _ = authenticated_client()

    response = client.get("/summary", {"month": "2026-09"})

    assert response.status_code == 200
    assert response.data == {
        "month": "2026-09",
        "total": "0.00",
        "previous_month_total": "0.00",
        "month_over_month_percentage": None,
        "spend_by_category": [],
        "insights": [],
    }


def test_summary_aggregates_rows_and_orders_categories_deterministically() -> None:
    client, user = authenticated_client()
    add_expense(user, 500, "food", date(2026, 9, 1))
    add_expense(user, 750, "food", date(2026, 9, 15))
    add_expense(user, 1_250, "bills", date(2026, 9, 30))
    add_expense(user, 300, "books", date(2026, 9, 10))
    add_expense(user, 1_000, "food", date(2026, 8, 31))

    response = client.get("/summary", {"month": "2026-09"})

    assert response.status_code == 200
    assert response.data["total"] == "28.00"
    assert response.data["previous_month_total"] == "10.00"
    assert response.data["month_over_month_percentage"] == "180.00"
    assert response.data["spend_by_category"] == [
        {"category": "bills", "amount": "12.50"},
        {"category": "food", "amount": "12.50"},
        {"category": "books", "amount": "3.00"},
    ]


def test_summary_is_fully_isolated_by_user() -> None:
    client, user = authenticated_client()
    other = get_user_model().objects.create_user("other@example.com", "password")
    add_expense(user, 100, "food", date(2026, 9, 1))
    add_expense(other, 999_999, "private", date(2026, 9, 1))
    add_expense(other, 888_888, "private", date(2026, 8, 1))

    response = client.get("/summary", {"month": "2026-09"})

    assert response.data["total"] == "1.00"
    assert response.data["previous_month_total"] == "0.00"
    assert response.data["spend_by_category"] == [{"category": "food", "amount": "1.00"}]


@pytest.mark.parametrize(
    ("month", "previous_day", "first_day", "last_day", "next_day"),
    [
        (
            "2026-01",
            date(2025, 12, 31),
            date(2026, 1, 1),
            date(2026, 1, 31),
            date(2026, 2, 1),
        ),
        (
            "2024-02",
            date(2024, 1, 31),
            date(2024, 2, 1),
            date(2024, 2, 29),
            date(2024, 3, 1),
        ),
        (
            "2026-05",
            date(2026, 4, 30),
            date(2026, 5, 1),
            date(2026, 5, 31),
            date(2026, 6, 1),
        ),
    ],
)
def test_summary_uses_half_open_calendar_boundaries(
    month: str,
    previous_day: date,
    first_day: date,
    last_day: date,
    next_day: date,
) -> None:
    client, user = authenticated_client()
    add_expense(user, 100, "boundary", previous_day)
    add_expense(user, 200, "boundary", first_day)
    add_expense(user, 300, "boundary", last_day)
    add_expense(user, 400, "boundary", next_day)

    response = client.get("/summary", {"month": month})

    assert response.data["previous_month_total"] == "1.00"
    assert response.data["total"] == "5.00"


@pytest.mark.parametrize(
    ("current_minor", "previous_minor", "expected"),
    [
        (150, 100, Decimal("50.00")),
        (50, 100, Decimal("-50.00")),
        (100, 100, Decimal("0.00")),
        (801, 800, Decimal("0.13")),
        (799, 800, Decimal("-0.13")),
        (100, 0, None),
    ],
)
def test_percentage_change_uses_round_half_up(
    current_minor: int,
    previous_minor: int,
    expected: Decimal | None,
) -> None:
    assert percentage_change(current_minor, previous_minor) == expected


def test_insights_apply_strict_threshold_zero_baseline_and_ordering() -> None:
    client, user = authenticated_client()
    previous = date(2026, 8, 10)
    current = date(2026, 9, 10)
    for category, previous_amount, current_amount in [
        ("alpha", 10_000, 12_001),
        ("beta", 10_000, 12_000),
        ("delta", 10_000, 0),
        ("epsilon", 10_000, 9_000),
        ("gamma", 0, 500),
    ]:
        if previous_amount:
            add_expense(user, previous_amount, category, previous)
        if current_amount:
            add_expense(user, current_amount, category, current)

    response = client.get("/summary", {"month": "2026-09"})

    assert response.data["insights"] == [
        {
            "type": "category_increase",
            "category": "alpha",
            "current_amount": "120.01",
            "previous_amount": "100.00",
            "percentage": "20.01",
            "message": "alpha spending increased by 20.01% compared with the previous month.",
        },
        {
            "type": "new_category_spend",
            "category": "gamma",
            "current_amount": "5.00",
            "previous_amount": "0.00",
            "percentage": None,
            "message": "New spending in gamma this month.",
        },
    ]


def test_selector_returns_integer_minor_unit_map() -> None:
    _, user = authenticated_client()
    add_expense(user, 125, "food", date(2026, 9, 1))
    add_expense(user, 375, "food", date(2026, 9, 2))

    totals = category_totals_for_period(
        owner=user,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 10, 1),
    )

    assert totals == {"food": 500}
    assert all(isinstance(value, int) for value in totals.values())


def test_summary_uses_two_grouped_database_queries(django_assert_num_queries) -> None:
    _, user = authenticated_client()
    add_expense(user, 100, "food", date(2026, 9, 1))
    add_expense(user, 100, "food", date(2026, 8, 1))

    with django_assert_num_queries(2):
        summary = build_monthly_summary(owner=user, window=parse_month("2026-09"))

    assert summary.total_minor == 100


def test_summary_requires_authentication() -> None:
    response = APIClient().get("/summary", {"month": "2026-09"})

    assert response.status_code == 401
