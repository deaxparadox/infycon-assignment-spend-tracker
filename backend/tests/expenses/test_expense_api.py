from __future__ import annotations

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from apps.expenses.models import Expense
from apps.expenses.money import MAX_AMOUNT_MINOR

pytestmark = pytest.mark.django_db


def authenticated_client(email: str = "person@example.com") -> tuple[APIClient, object]:
    user = get_user_model().objects.create_user(email, "valid-test-password")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def valid_payload(**overrides):
    payload = {
        "amount": "125.50",
        "category": "Food",
        "note": "Lunch",
        "date": "2026-09-21",
    }
    payload.update(overrides)
    return payload


def create_expense(owner, *, amount_minor=100, category="food", expense_date=date(2026, 9, 21)):
    return Expense.objects.create(
        owner=owner,
        amount_minor=amount_minor,
        category=category,
        expense_date=expense_date,
    )


def test_create_persists_minor_units_and_serializes_fixed_places() -> None:
    client, user = authenticated_client()

    response = client.post("/expenses", valid_payload(amount="125.5"), format="json")

    assert response.status_code == 201
    expense = Expense.objects.get()
    assert expense.owner == user
    assert expense.amount_minor == 12_550
    assert response.data["amount"] == "125.50"
    assert response.data["date"] == "2026-09-21"
    assert "amount_minor" not in response.data
    assert "owner" not in response.data


@pytest.mark.parametrize(
    "amount",
    [
        "0",
        "-1.00",
        "1e2",
        "not-money",
        "1.001",
        "90071992547409.92",
        12.50,
    ],
)
def test_create_rejects_invalid_amounts(amount) -> None:
    client, _ = authenticated_client()

    response = client.post("/expenses", valid_payload(amount=amount), format="json")

    assert response.status_code == 400
    assert "amount" in response.data["error"]["fields"]
    assert not Expense.objects.exists()


def test_create_accepts_documented_maximum_amount() -> None:
    client, _ = authenticated_client()

    response = client.post(
        "/expenses",
        valid_payload(amount="90071992547409.91"),
        format="json",
    )

    assert response.status_code == 201
    assert Expense.objects.get().amount_minor == MAX_AMOUNT_MINOR


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"category": "   "}, "category"),
        ({"category": "x" * 101}, "category"),
        ({"category": 42}, "category"),
        ({"note": "x" * 501}, "note"),
        ({"note": 42}, "note"),
        ({"date": "2026-02-30"}, "date"),
    ],
)
def test_create_rejects_invalid_public_fields(overrides, field: str) -> None:
    client, _ = authenticated_client()

    response = client.post("/expenses", valid_payload(**overrides), format="json")

    assert response.status_code == 400
    assert field in response.data["error"]["fields"]


def test_create_canonicalizes_category_and_never_accepts_client_owner() -> None:
    client, user = authenticated_client()
    other_user = get_user_model().objects.create_user("other@example.com", "password")

    response = client.post(
        "/expenses",
        valid_payload(category="  Home   Office  ", owner=other_user.id),
        format="json",
    )

    assert response.status_code == 201
    expense = Expense.objects.get()
    assert expense.category == "home office"
    assert expense.owner == user
    assert response.data["category"] == "home office"


def test_list_filters_category_and_inclusive_date_range() -> None:
    client, user = authenticated_client()
    boundary_start = create_expense(
        user,
        category="home office",
        expense_date=date(2026, 9, 1),
    )
    boundary_end = create_expense(
        user,
        category="home office",
        expense_date=date(2026, 9, 30),
    )
    create_expense(user, category="travel", expense_date=date(2026, 9, 15))
    create_expense(user, category="home office", expense_date=date(2026, 8, 31))
    create_expense(user, category="home office", expense_date=date(2026, 10, 1))

    response = client.get(
        "/expenses",
        {
            "category": " Home   Office ",
            "start_date": "2026-09-01",
            "end_date": "2026-09-30",
        },
    )

    assert response.status_code == 200
    assert response.data["count"] == 2
    assert [item["id"] for item in response.data["results"]] == [
        boundary_end.id,
        boundary_start.id,
    ]


def test_each_date_bound_works_independently() -> None:
    client, user = authenticated_client()
    older = create_expense(user, expense_date=date(2026, 8, 31))
    middle = create_expense(user, expense_date=date(2026, 9, 15))
    newer = create_expense(user, expense_date=date(2026, 10, 1))

    from_start = client.get("/expenses", {"start_date": "2026-09-15"})
    through_end = client.get("/expenses", {"end_date": "2026-09-15"})

    assert [item["id"] for item in from_start.data["results"]] == [newer.id, middle.id]
    assert [item["id"] for item in through_end.data["results"]] == [middle.id, older.id]


@pytest.mark.parametrize(
    "query",
    [
        "start_date=bad-date",
        "start_date=2026-10-01&end_date=2026-09-01",
        "limit=0",
        "limit=101",
        "limit=abc",
        "offset=-1",
        "category=food&category=travel",
        "unknown=value",
    ],
)
def test_list_rejects_invalid_or_repeated_query_parameters(query: str) -> None:
    client, _ = authenticated_client()

    response = client.get(f"/expenses?{query}")

    assert response.status_code == 400
    assert response.data["error"]["fields"]


def test_list_has_stable_ordering_and_validated_pagination_metadata() -> None:
    client, user = authenticated_client()
    expenses = [create_expense(user) for _ in range(4)]
    same_time = timezone.now()
    Expense.objects.filter(id__in=[expense.id for expense in expenses]).update(created_at=same_time)

    response = client.get("/expenses", {"limit": "2", "offset": "1"})

    assert response.status_code == 200
    assert response.data["count"] == 4
    assert response.data["limit"] == 2
    assert response.data["offset"] == 1
    assert [item["id"] for item in response.data["results"]] == [
        expenses[2].id,
        expenses[1].id,
    ]


def test_expenses_require_authentication() -> None:
    client = APIClient()

    list_response = client.get("/expenses")
    create_response = client.post("/expenses", valid_payload(), format="json")

    assert list_response.status_code == 401
    assert create_response.status_code == 401


def test_list_never_exposes_another_users_expenses() -> None:
    client, user = authenticated_client()
    other_user = get_user_model().objects.create_user("other@example.com", "password")
    own_expense = create_expense(user)
    create_expense(other_user, amount_minor=999_999, category="private")

    response = client.get("/expenses")

    assert response.data["count"] == 1
    assert [item["id"] for item in response.data["results"]] == [own_expense.id]


def test_database_rejects_non_positive_minor_amount_independently() -> None:
    _, user = authenticated_client()

    with pytest.raises(IntegrityError), transaction.atomic():
        create_expense(user, amount_minor=0)


def test_database_rejects_amount_above_exact_integer_limit() -> None:
    _, user = authenticated_client()

    with pytest.raises(IntegrityError), transaction.atomic():
        create_expense(user, amount_minor=MAX_AMOUNT_MINOR + 1)


def test_model_save_uses_shared_category_canonicalization() -> None:
    _, user = authenticated_client()

    expense = create_expense(user, category="  Home   Office ")

    assert expense.category == "home office"
