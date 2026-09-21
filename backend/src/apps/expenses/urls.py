from django.urls import path

from .views import ExpenseListCreateView

app_name = "expenses"

urlpatterns = [path("", ExpenseListCreateView.as_view(), name="list-create")]
