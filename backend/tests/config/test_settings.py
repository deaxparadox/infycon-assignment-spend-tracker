import pytest
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from config.settings.base import (
    boolean_env,
    csv_env,
    database_config_from_url,
    positive_int_env,
    required_env,
)


def test_trusts_the_reverse_proxy_forwarded_proto_header():
    assert settings.SECURE_PROXY_SSL_HEADER == ("HTTP_X_FORWARDED_PROTO", "https")


def test_database_config_from_url_parses_a_neon_style_dsn():
    config = database_config_from_url(
        "postgresql://neondb_owner:p%40ss@ep-example-pooler.aws.neon.tech/neondb"
        "?sslmode=require&channel_binding=require"
    )

    assert config == {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "neondb",
        "USER": "neondb_owner",
        "PASSWORD": "p@ss",
        "HOST": "ep-example-pooler.aws.neon.tech",
        "PORT": 5432,
        "OPTIONS": {"sslmode": "require", "channel_binding": "require"},
    }


def test_database_config_from_url_defaults_the_port():
    config = database_config_from_url("postgresql://user:pass@db.example.com/mydb")

    assert config["PORT"] == 5432
    assert config["OPTIONS"] == {}


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
