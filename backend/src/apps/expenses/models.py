from django.conf import settings
from django.db import models

from .categories import normalize_category
from .money import MAX_AMOUNT_MINOR


class Expense(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expenses",
    )
    amount_minor = models.BigIntegerField()
    category = models.CharField(max_length=100)
    note = models.CharField(max_length=500, blank=True, default="")
    expense_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-expense_date", "-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["owner", "expense_date"],
                name="expense_owner_date_idx",
            ),
            models.Index(
                fields=["owner", "category", "expense_date"],
                name="expense_owner_cat_date_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount_minor__gt=0),
                name="expense_amount_minor_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(amount_minor__lte=MAX_AMOUNT_MINOR),
                name="expense_amount_minor_js_safe",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.category}: {self.amount_minor}"

    def save(self, *args, **kwargs) -> None:
        self.category = normalize_category(self.category)
        super().save(*args, **kwargs)
