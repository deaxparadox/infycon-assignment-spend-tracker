from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from apps.expenses.management.commands.seed_demo_data import DEMO_EMAIL
from apps.expenses.models import Expense

pytestmark = pytest.mark.django_db


def test_seed_creates_demo_account_and_expenses() -> None:
    call_command("seed_demo_data")

    user = get_user_model().objects.get(email__iexact=DEMO_EMAIL)
    expenses = Expense.objects.filter(owner=user)
    assert expenses.count() == 5
    assert user.check_password("CorrectHorseBattery9!")


def test_seed_is_idempotent_and_never_touches_other_accounts() -> None:
    call_command("seed_demo_data")
    other_user = get_user_model().objects.create_user("person@example.com", "password")
    Expense.objects.create(
        owner=other_user,
        amount_minor=100,
        category="food",
        expense_date="2026-01-01",
    )

    call_command("seed_demo_data")

    demo_user = get_user_model().objects.get(email__iexact=DEMO_EMAIL)
    assert Expense.objects.filter(owner=demo_user).count() == 5
    assert Expense.objects.filter(owner=other_user).count() == 1


def test_seed_does_not_reset_a_changed_demo_password() -> None:
    call_command("seed_demo_data")
    user = get_user_model().objects.get(email__iexact=DEMO_EMAIL)
    user.set_password("something-else-entirely")
    user.save(update_fields=["password"])

    call_command("seed_demo_data")

    user.refresh_from_db()
    assert user.check_password("something-else-entirely")
