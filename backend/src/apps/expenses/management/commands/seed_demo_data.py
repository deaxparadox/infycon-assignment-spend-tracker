"""Idempotently seed a demo account with sample expenses for evaluation deployments.

Intended to run on every server start (e.g. a Render pre-deploy/start command,
or the Compose migrate step) so a demo login is always available even on
platforms that discard the database on every redeploy. Registering a separate
account works exactly the same as before; this only ever touches the one
fixed demo email.
"""

from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.timezone import localdate

from apps.expenses.models import Expense

DEMO_EMAIL = "demo@example.com"
DEFAULT_DEMO_PASSWORD = "CorrectHorseBattery9!"  # noqa: S105 (public demo credential, not a secret)


def _month_start(year: int, month: int) -> tuple[int, int]:
    month_index = month - 1
    return year + month_index // 12, month_index % 12 + 1


class Command(BaseCommand):
    help = "Create the demo account and sample expenses if they do not already exist."

    def handle(self, *args, **options) -> None:
        User = get_user_model()
        password = os.environ.get("DEMO_ACCOUNT_PASSWORD", DEFAULT_DEMO_PASSWORD)

        user = User.objects.filter(email__iexact=DEMO_EMAIL).first()
        if user is None:
            user = User.objects.create_user(email=DEMO_EMAIL, password=password)
            self.stdout.write(self.style.SUCCESS(f"Created demo account {DEMO_EMAIL}"))
        else:
            self.stdout.write(f"Demo account {DEMO_EMAIL} already exists, leaving it as-is")

        if Expense.objects.filter(owner=user).exists():
            self.stdout.write("Demo expenses already exist, skipping")
            return

        today = localdate()
        this_year, this_month = today.year, today.month
        last_year, last_month = _month_start(this_year, this_month - 1)

        with transaction.atomic():
            Expense.objects.bulk_create(
                [
                    # Previous month: a food baseline to compare against.
                    Expense(
                        owner=user,
                        amount_minor=4500,
                        category="food",
                        note="Groceries",
                        expense_date=f"{last_year:04d}-{last_month:02d}-05",
                    ),
                    Expense(
                        owner=user,
                        amount_minor=5500,
                        category="food",
                        note="Dinner out",
                        expense_date=f"{last_year:04d}-{last_month:02d}-20",
                    ),
                    # This month: food up 30% (>20% triggers a category_increase insight).
                    Expense(
                        owner=user,
                        amount_minor=7000,
                        category="food",
                        note="Groceries",
                        expense_date=f"{this_year:04d}-{this_month:02d}-03",
                    ),
                    Expense(
                        owner=user,
                        amount_minor=6000,
                        category="food",
                        note="Dinner out",
                        expense_date=f"{this_year:04d}-{this_month:02d}-15",
                    ),
                    # This month: a category with no prior spend (new_category_spend insight).
                    Expense(
                        owner=user,
                        amount_minor=6000,
                        category="transport",
                        note="Fuel",
                        expense_date=f"{this_year:04d}-{this_month:02d}-10",
                    ),
                ]
            )
        self.stdout.write(self.style.SUCCESS(f"Seeded demo expenses for {DEMO_EMAIL}"))
