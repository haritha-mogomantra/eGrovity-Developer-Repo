# ==============================================================================
# FILE: employee_lifecycle/views.py
# ==============================================================================

"""
employee_lifecycle views

IMPORTANT:
- This app does NOT expose write APIs.
- It only serves lifecycle history and reports.
- All department deactivation APIs live in `masters`.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.exceptions import NotFound
from rest_framework.generics import ListAPIView
from rest_framework.filters import OrderingFilter

from django_filters.rest_framework import DjangoFilterBackend

from masters.models import Master, MasterType
from .models import EmployeeDepartmentHistory
from .serializers import EmployeeLifecycleSerializer
from .services import LifecycleService


# ==============================================================================
# DEPARTMENT DEACTIVATION PREVIEW (READ-ONLY)
# ==============================================================================

class DepartmentSummaryView(APIView):
    """
    Read-only API.

    Used ONLY for previewing impact before department deactivation.
    No data mutation happens here.
    """

    # ✅ Admin-only (matches Masters deactivation permission)
    permission_classes = [IsAdminUser]

    def get(self, request, department_id):
        department = Master.objects.filter(
            id=department_id,
            master_type=MasterType.DEPARTMENT
        ).first()

        if not department:
            raise NotFound("Department not found")

        service = LifecycleService()
        summary = service.get_department_summary(department)

        return Response(summary)


# ==============================================================================
# EMPLOYEE LIFECYCLE HISTORY (READ-ONLY)
# ==============================================================================

class EmployeeLifecycleHistoryView(ListAPIView):
    """
    Read-only employee lifecycle history.

    Used for audit logs, reports, and analytics.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = EmployeeLifecycleSerializer

    queryset = EmployeeDepartmentHistory.objects.all().order_by("-joined_at")

    filter_backends = [
        DjangoFilterBackend,
        OrderingFilter
    ]

    filterset_fields = [
        "employee",
        "department",
        "movement_type"
    ]

    ordering_fields = [
        "joined_at",
        "left_at"
    ]