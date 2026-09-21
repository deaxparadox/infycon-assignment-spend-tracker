"""Monthly summary and insight business rules."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .periods import MonthWindow
from .selectors import category_totals_for_period

PERCENT_QUANTUM = Decimal("0.01")
INSIGHT_THRESHOLD = Decimal("20.00")


@dataclass(frozen=True)
class CategorySpend:
    category: str
    amount_minor: int


@dataclass(frozen=True)
class SpendingInsight:
    type: str
    category: str
    current_amount_minor: int
    previous_amount_minor: int
    percentage: Decimal | None
    message: str


@dataclass(frozen=True)
class MonthlySummary:
    month: str
    total_minor: int
    previous_month_total_minor: int
    month_over_month_percentage: Decimal | None
    spend_by_category: list[CategorySpend]
    insights: list[SpendingInsight]


def percentage_change(current_minor: int, previous_minor: int) -> Decimal | None:
    if previous_minor == 0:
        return None
    percentage = Decimal((current_minor - previous_minor) * 100) / Decimal(previous_minor)
    return percentage.quantize(PERCENT_QUANTUM, rounding=ROUND_HALF_UP)


def build_monthly_summary(*, owner, window: MonthWindow) -> MonthlySummary:
    current_totals = category_totals_for_period(
        owner=owner,
        start_date=window.selected_start,
        end_date=window.next_start,
    )
    previous_totals = category_totals_for_period(
        owner=owner,
        start_date=window.previous_start,
        end_date=window.selected_start,
    )

    total_minor = sum(current_totals.values())
    previous_total_minor = sum(previous_totals.values())
    spend_by_category = [
        CategorySpend(category=category, amount_minor=amount_minor)
        for category, amount_minor in sorted(
            current_totals.items(),
            key=lambda item: (-item[1], item[0]),
        )
    ]

    insights: list[SpendingInsight] = []
    for category in sorted(current_totals.keys() | previous_totals.keys()):
        current_minor = current_totals.get(category, 0)
        previous_minor = previous_totals.get(category, 0)
        category_percentage = percentage_change(current_minor, previous_minor)
        if previous_minor == 0 and current_minor > 0:
            insights.append(
                SpendingInsight(
                    type="new_category_spend",
                    category=category,
                    current_amount_minor=current_minor,
                    previous_amount_minor=0,
                    percentage=None,
                    message=f"New spending in {category} this month.",
                )
            )
        elif category_percentage is not None and category_percentage > INSIGHT_THRESHOLD:
            insights.append(
                SpendingInsight(
                    type="category_increase",
                    category=category,
                    current_amount_minor=current_minor,
                    previous_amount_minor=previous_minor,
                    percentage=category_percentage,
                    message=(
                        f"{category} spending increased by {category_percentage:.2f}% "
                        "compared with the previous month."
                    ),
                )
            )

    return MonthlySummary(
        month=window.label,
        total_minor=total_minor,
        previous_month_total_minor=previous_total_minor,
        month_over_month_percentage=percentage_change(total_minor, previous_total_minor),
        spend_by_category=spend_by_category,
        insights=insights,
    )
