"""Authenticated monthly summary endpoint."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.query_params import validate_query_shape

from .summary import build_monthly_summary
from .summary_serializers import MonthlySummarySerializer, SummaryQuerySerializer


class SummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request) -> Response:
        validate_query_shape(request.query_params, allowed={"month"})
        query_serializer = SummaryQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        summary = build_monthly_summary(
            owner=request.user,
            window=query_serializer.validated_data["month"],
        )
        return Response(MonthlySummarySerializer(summary).data)
