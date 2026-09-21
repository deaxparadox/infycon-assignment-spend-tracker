"""Authenticated expense collection endpoint."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.query_params import validate_query_shape

from .selectors import expenses_for_user
from .serializers import ExpenseQuerySerializer, ExpenseSerializer
from .services import create_expense

ALLOWED_QUERY_PARAMETERS = {"category", "start_date", "end_date", "limit", "offset"}


class ExpenseListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request) -> Response:
        serializer = ExpenseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = create_expense(owner=request.user, validated_data=serializer.validated_data)
        return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)

    def get(self, request) -> Response:
        validate_query_shape(request.query_params, allowed=ALLOWED_QUERY_PARAMETERS)
        query_serializer = ExpenseQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        filters = query_serializer.validated_data

        queryset = expenses_for_user(owner=request.user, filters=filters)
        count = queryset.count()
        limit = filters["limit"]
        offset = filters["offset"]
        page = queryset[offset : offset + limit]

        return Response(
            {
                "count": count,
                "limit": limit,
                "offset": offset,
                "results": ExpenseSerializer(page, many=True).data,
            }
        )
