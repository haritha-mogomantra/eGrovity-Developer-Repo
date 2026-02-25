# ==============================================================================
# FILE: employee_lifecycle/urls.py
# ==============================================================================

from django.urls import path
from .views import (
    DepartmentSummaryView,
    EmployeeLifecycleHistoryView,
    MasterDeactivationView,
)

urlpatterns = [
    # ----------------------------------------------------------
    # READ-ONLY PREVIEW ENDPOINTS
    # ----------------------------------------------------------

    path(
        "departments/<int:department_id>/summary/",
        DepartmentSummaryView.as_view(),
        name="department-lifecycle-summary",
    ),

    # ----------------------------------------------------------
    # READ-ONLY LIFECYCLE HISTORY / AUDIT
    # ----------------------------------------------------------

    path(
        "history/",
        EmployeeLifecycleHistoryView.as_view(),
        name="employee-lifecycle-history",
    ),

    path(
        "<int:pk>/deactivate/",
        MasterDeactivationView.as_view(),
        name="master-deactivate"
    ),
]
