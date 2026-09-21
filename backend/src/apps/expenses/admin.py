from django.contrib import admin

from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("owner", "amount_minor", "category", "expense_date")
    list_filter = ("category", "expense_date")
    search_fields = ("owner__email", "category", "note")
