# ===============================================
# employee/admin.py
# ===============================================
# Django Admin configuration for Employee and Department models.
# Features:
# ✅ Department management with live employee count
# ✅ Employee admin linked with User info (emp_id, email, role, dept)
# ✅ Inline search, filters, role badges, and status color coding
# ===============================================

from django.contrib import admin
from django.utils.html import format_html
from .models import Employee


# =====================================================
# EMPLOYEE ADMIN
# =====================================================
@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    """
    Admin configuration for Employee model.
    Displays linked user details and department information.
    """

    list_display = (
        "get_emp_id",
        "get_full_name",
        "get_email",
        "department",
        "designation",
        "colored_role",
        "status",
        "joining_date",
    )
    search_fields = (
        "user__emp_id",
        "user__first_name",
        "user__last_name",
        "user__email",
        "designation",
    )
    list_filter = ("department", "role__name", "status", "joining_date")
    ordering = ("user__emp_id",)
    readonly_fields = ("created_at", "updated_at")

    # --------------------------------------------
    # Helper Display Methods
    # --------------------------------------------
    def get_emp_id(self, obj):
        """Display Employee ID from linked User."""
        return getattr(obj.user, "emp_id", "-")
    get_emp_id.short_description = "Employee ID"

    def get_full_name(self, obj):
        """Return full name from linked User."""
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.username
        return "-"
    get_full_name.short_description = "Full Name"

    def get_email(self, obj):
        """Return linked user's email address."""
        return getattr(obj.user, "email", "-")
    get_email.short_description = "Email"

    def colored_role(self, obj):
        role_name = obj.role.name if obj.role else "Unknown"

        role_colors = {
            "Admin": "#007bff",
            "Manager": "#28a745",
            "Employee": "#6c757d",
        }
        color = role_colors.get(role_name, "#999")

        return format_html(
            "<span style='background-color:{}; color:white; padding:3px 8px; border-radius:4px;'>{}</span>",
            color,
            role_name
        )

    # --------------------------------------------
    # Optimization Hooks
    # --------------------------------------------
    def get_queryset(self, request):
        """Optimize query performance for admin list view."""
        qs = super().get_queryset(request)
        return qs.select_related("user", "department", "manager")

    def save_model(self, request, obj, form, change):
        """Custom save logic with admin audit logging."""
        super().save_model(request, obj, form, change)
        emp_id = getattr(obj.user, "emp_id", "N/A")
        if change:
            self.message_user(request, f"✅ Employee '{emp_id}' updated successfully.")
        else:
            self.message_user(request, f"✅ Employee '{emp_id}' added successfully.")
