import pytest
from django.core.exceptions import ImproperlyConfigured

from config.settings.base import boolean_env, csv_env, positive_int_env, required_env


def test_required_env_rejects_missing_value(monkeypatch):
    monkeypatch.delenv("REQUIRED_TEST_VALUE", raising=False)

    with pytest.raises(ImproperlyConfigured, match="REQUIRED_TEST_VALUE is missing"):
        required_env("REQUIRED_TEST_VALUE")


def test_csv_env_rejects_empty_entry(monkeypatch):
    monkeypatch.setenv("CSV_TEST_VALUE", "api.example.com,")

    with pytest.raises(ImproperlyConfigured, match="contains an empty value"):
        csv_env("CSV_TEST_VALUE")


def test_boolean_env_rejects_ambiguous_value(monkeypatch):
    monkeypatch.setenv("BOOLEAN_TEST_VALUE", "yes")

    with pytest.raises(ImproperlyConfigured, match="must be true or false"):
        boolean_env("BOOLEAN_TEST_VALUE")


@pytest.mark.parametrize("value", ["0", "-1", "ten"])
def test_positive_int_env_rejects_invalid_value(monkeypatch, value):
    monkeypatch.setenv("INTEGER_TEST_VALUE", value)

    with pytest.raises(ImproperlyConfigured):
        positive_int_env("INTEGER_TEST_VALUE")
