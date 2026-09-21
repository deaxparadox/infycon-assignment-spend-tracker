import pytest

from apps.expenses.money import format_minor_amount, parse_amount_to_minor


@pytest.mark.parametrize(
    ("amount", "minor"),
    [
        ("125", 12_500),
        ("125.5", 12_550),
        ("125.50", 12_550),
        ("0.01", 1),
    ],
)
def test_parse_amount_converts_once_without_rounding(amount: str, minor: int) -> None:
    assert parse_amount_to_minor(amount) == minor


@pytest.mark.parametrize(
    ("minor", "amount"),
    [(1, "0.01"), (100, "1.00"), (12_550, "125.50")],
)
def test_format_minor_amount_has_exactly_two_places(minor: int, amount: str) -> None:
    assert format_minor_amount(minor) == amount
