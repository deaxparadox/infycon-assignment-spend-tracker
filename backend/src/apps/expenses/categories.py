"""Canonical category handling shared by writes, filters, and summaries."""


def normalize_category(value: str) -> str:
    return " ".join(value.split()).lower()
