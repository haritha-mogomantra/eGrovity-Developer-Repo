# ==============================================================================
# FILE: employee_lifecycle/serializers.py
# ==============================================================================

from rest_framework import serializers
from .models import EmployeeDepartmentHistory


class EmployeeLifecycleSerializer(serializers.ModelSerializer):
    # Human-readable fields
    employee = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    designation = serializers.SerializerMethodField()
    action_by = serializers.SerializerMethodField()
    movement_type = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeDepartmentHistory
        fields = "__all__"

    # -------------------------------------------------
    # FIELD FORMATTERS (READ-ONLY)
    # -------------------------------------------------

    def get_employee(self, obj):
        if not obj.employee:
            return "-"
        return obj.employee.full_name or obj.employee.username

    def get_department(self, obj):
        return obj.department.name if obj.department else "-"

    def get_role(self, obj):
        return obj.role.name if obj.role else "-"

    def get_designation(self, obj):
        return obj.designation if obj.designation else "-"

    def get_action_by(self, obj):
        if not obj.action_by:
            return "-"
        return obj.action_by.get_username()

    def get_movement_type(self, obj):
        # Converts enum value → display label
        return obj.get_movement_type_display()
