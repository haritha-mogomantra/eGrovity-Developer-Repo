# reports/serializers.py
from rest_framework import serializers
from employee.models import Employee
from .models import CachedReport
from decimal import Decimal, InvalidOperation
from typing import Any, Dict
from masters.models import MasterType


# =====================================================
# MIXIN — Standardized Score Rounding
# =====================================================
class ScoreMixin:
    """Provides consistent rounding for numeric scores."""

    def round_score(self, value: Any) -> float:
        if value is None:
            return 0.0
        try:
            # Use Decimal for consistent rounding, fallback to float
            return float(Decimal(value).quantize(Decimal("0.01")))
        except (InvalidOperation, TypeError, ValueError):
            try:
                return round(float(value), 2)
            except Exception:
                return 0.0


# =====================================================
# 1. BASIC EMPLOYEE SERIALIZER (Used Across Reports)
# =====================================================
class SimpleEmployeeSerializer(serializers.ModelSerializer, ScoreMixin):
    full_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()

    def get_department_name(self, obj):
        dept = getattr(obj, "department", None)
        if dept and getattr(dept, "master_type", None) == MasterType.DEPARTMENT:
            return dept.name
        return "-"

    emp_id = serializers.CharField(source="user.emp_id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Employee
        fields = ["id", "emp_id", "full_name", "email", "department_name"]

    def get_full_name(self, obj):
        user = getattr(obj, "user", None)
        if not user:
            return "-"
        return f"{user.first_name or ''} {user.last_name or ''}".strip()


# =====================================================
# 2. WEEKLY REPORT SERIALIZER
# =====================================================
class WeeklyReportSerializer(serializers.Serializer, ScoreMixin):
    """Represents a single week's consolidated employee performance."""
    emp_id = serializers.CharField()
    employee_full_name = serializers.CharField()
    department_name = serializers.CharField(allow_null=True, default="Deactivated Department")
    manager_full_name = serializers.CharField(required=False, allow_null=True, default="-")
    total_score = serializers.FloatField()
    average_score = serializers.FloatField()
    week_number = serializers.IntegerField()
    year = serializers.IntegerField()
    rank = serializers.IntegerField(allow_null=True, required=False)
    remarks = serializers.CharField(allow_blank=True, allow_null=True, required=False)

    def validate_average_score(self, value):
        if not (0 <= value <= 100):
            raise serializers.ValidationError("average_score must be between 0 and 100.")
        return value

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        # be defensive: ensure keys exist
        rep["average_score"] = self.round_score(rep.get("average_score"))
        rep["total_score"] = self.round_score(rep.get("total_score"))
        return rep


# =====================================================
# 3. MONTHLY REPORT SERIALIZER
# =====================================================
class MonthlyReportSerializer(serializers.Serializer, ScoreMixin):
    """Aggregated monthly performance and feedback summary."""
    emp_id = serializers.CharField()
    employee_full_name = serializers.CharField()
    department = serializers.CharField(allow_null=True, default="Deactivated Department")
    manager_full_name = serializers.CharField(required=False, allow_null=True, default="-")
    month = serializers.IntegerField()
    year = serializers.IntegerField()
    avg_score = serializers.FloatField()
    best_week = serializers.IntegerField(required=False, allow_null=True)
    best_week_score = serializers.FloatField(required=False, allow_null=True)

    def validate_month(self, value):
        if not (1 <= value <= 12):
            raise serializers.ValidationError("Month must be between 1 and 12.")
        return value

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["avg_score"] = self.round_score(rep.get("avg_score", 0))
        rep["best_week_score"] = self.round_score(rep.get("best_week_score", 0))
        return rep


# =====================================================
# 4. EMPLOYEE HISTORY SERIALIZER
# =====================================================
class EmployeeHistorySerializer(serializers.Serializer, ScoreMixin):
    """Weekly trend view for an employee’s performance timeline."""
    week_number = serializers.IntegerField()
    year = serializers.IntegerField()
    average_score = serializers.FloatField()
    remarks = serializers.CharField(allow_null=True, required=False)
    rank = serializers.IntegerField(allow_null=True, required=False)
    manager_full_name = serializers.CharField(required=False, allow_null=True, default="-")
    department = serializers.CharField(required=False, allow_null=True, default="-")


    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["average_score"] = self.round_score(rep.get("average_score", 0))
        return rep


# =====================================================
# 5. MANAGER-WISE REPORT SERIALIZER
# =====================================================
class ManagerReportSerializer(serializers.Serializer, ScoreMixin):
    """Weekly report for all employees under a specific manager."""
    manager_full_name = serializers.CharField(required=False, allow_null=True, default="-")
    emp_id = serializers.CharField()
    employee_full_name = serializers.CharField()
    department = serializers.CharField(allow_null=True, default="Deactivated Department")
    total_score = serializers.FloatField()
    average_score = serializers.FloatField()
    week_number = serializers.IntegerField()
    year = serializers.IntegerField()
    rank = serializers.IntegerField(allow_null=True, required=False)
    remarks = serializers.CharField(allow_blank=True, allow_null=True, required=False)

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["average_score"] = self.round_score(rep.get("average_score", 0))
        rep["total_score"] = self.round_score(rep.get("total_score", 0))
        return rep


# =====================================================
# 6. DEPARTMENT-WISE REPORT SERIALIZER
# =====================================================
class DepartmentReportSerializer(serializers.Serializer, ScoreMixin):
    """Weekly report across all employees in a department."""
    department_name = serializers.CharField(allow_null=True, default="Deactivated Department")
    emp_id = serializers.CharField()
    employee_full_name = serializers.CharField()
    manager_full_name = serializers.CharField(required=False, allow_null=True, default="-")
    total_score = serializers.FloatField()
    average_score = serializers.FloatField()
    week_number = serializers.IntegerField()
    year = serializers.IntegerField()
    rank = serializers.IntegerField(allow_null=True, required=False)
    remarks = serializers.CharField(allow_blank=True, allow_null=True, required=False)

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["average_score"] = self.round_score(rep.get("average_score", 0))
        rep["total_score"] = self.round_score(rep.get("total_score", 0))
        return rep


# =====================================================
# 7. CACHED REPORT SERIALIZER (DB MODEL)
# =====================================================
class CachedReportSerializer(serializers.ModelSerializer):
    """Handles serialization of precomputed/cached reports."""

    generated_by_full_name = serializers.SerializerMethodField(read_only=True)
    generated_by_name = serializers.CharField(source="generated_by.username", read_only=True, default="-")
    period_display = serializers.SerializerMethodField(read_only=True)
    report_label = serializers.SerializerMethodField(read_only=True)
    export_type = serializers.ReadOnlyField()

    class Meta:
        model = CachedReport
        fields = [
            "id", "report_type", "year", "week_number", "month",
            "manager", "department", "payload", "file_path",
            "generated_at", "generated_by", "generated_by_name",
            "generated_by_full_name", "is_active", "period_display",
            "report_label", "export_type",
        ]
        read_only_fields = [
            "id", "generated_at", "generated_by_name",
            "generated_by_full_name", "period_display", "report_label", "export_type",
        ]

    def get_generated_by_full_name(self, obj):
        user = getattr(obj, "generated_by", None)
        if user:
            return f"{user.first_name or ''} {user.last_name or ''}".strip()
        return "-"

    def get_period_display(self, obj):
        """Readable period for dashboards and exports."""
        try:
            return obj.get_period_display()
        except Exception:
            return ""

    def get_report_label(self, obj):
        """Return contextual label for frontend cards."""
        try:
            return obj.report_scope
        except Exception:
            return obj.report_type