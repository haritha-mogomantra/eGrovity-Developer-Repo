# ==============================================================================
# FILE: masters/urls.py
# ==============================================================================
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MasterViewSet, EmployeeRoleAssignmentViewSet

router = DefaultRouter()
router.register(r'', MasterViewSet, basename='master')
router.register(
    r'employee-role-assignments',
    EmployeeRoleAssignmentViewSet,
    basename='employee-role-assignment'
)

app_name = 'masters'

urlpatterns = [
    path('', include(router.urls)),
]
