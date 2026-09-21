"""Calendar-safe monthly half-open ranges."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

MONTH_PATTERN = re.compile(r"^(?P<year>\d{4})-(?P<month>0[1-9]|1[0-2])$")


@dataclass(frozen=True)
class MonthWindow:
    label: str
    previous_start: date
    selected_start: date
    next_start: date


def _shift_month(year: int, month: int, offset: int) -> date:
    absolute_month = year * 12 + (month - 1) + offset
    shifted_year, zero_based_month = divmod(absolute_month, 12)
    return date(shifted_year, zero_based_month + 1, 1)


def parse_month(value: str) -> MonthWindow:
    match = MONTH_PATTERN.fullmatch(value)
    if match is None:
        raise ValueError("Month must use YYYY-MM format.")

    year = int(match.group("year"))
    month = int(match.group("month"))
    try:
        selected_start = date(year, month, 1)
        previous_start = _shift_month(year, month, -1)
        next_start = _shift_month(year, month, 1)
    except ValueError as exc:
        raise ValueError("Month is outside the supported calendar range.") from exc

    return MonthWindow(
        label=value,
        previous_start=previous_start,
        selected_start=selected_start,
        next_start=next_start,
    )
