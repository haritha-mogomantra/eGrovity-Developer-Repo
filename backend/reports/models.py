# ===========================================================
# reports/models.py 
# ===========================================================
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
import os
from masters.models import MasterType

class CachedReport(models.Model):
    """
    Stores precomputed performance reports (weekly/monthly/manager/department)
    for analytics dashboards and export caching.
    """

    REPORT_TYPE_CHOICES = [
        ("weekly", "Weekly Report"),
        ("monthly", "Monthly Report"),
        ("manager", "Manager-wise Report"),
        ("department", "Department-wise Report"),
    ]

    # -----------------------------------------------------------
    # Identification Fields
    # -----------------------------------------------------------
    report_type = models.CharField(
        max_length=20,
        choices=REPORT_TYPE_CHOICES,
        help_text="Type of report (weekly, monthly, manager, department)",
    )
    year = models.PositiveSmallIntegerField(help_text="Report year (e.g., 2025)")
    week_number = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Week number (used for weekly/manager/department reports)",
    )
    month = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Month number (used for monthly reports)",
    )

    # -----------------------------------------------------------
    # Relationships
    # -----------------------------------------------------------
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="manager_reports",
        help_text="Manager reference for manager-wise reports",
    )
    department = models.ForeignKey(
        "masters.Master",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="department_reports",
        limit_choices_to={"master_type": MasterType.DEPARTMENT},
        help_text="Department reference (Master: DEPARTMENT)",
    )
    
    # -----------------------------------------------------------
    # Cached Payload
    # -----------------------------------------------------------
    payload = models.JSONField(
        help_text="Cached JSON data (aggregated summary, KPIs, and metrics)."
    )
    report_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Readable report name (auto-generated for dashboard display).",
    )

    # -----------------------------------------------------------
    # Metadata
    # -----------------------------------------------------------
    generated_at = models.DateTimeField(default=timezone.now)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cached_reports",
        help_text="User or system that generated this report.",
    )
    file_path = models.FileField(
        upload_to="reports/",
        null=True,
        blank=True,
        help_text="Path to generated PDF/Excel file (if available).",
    )
    is_active = models.BooleanField(default=True, help_text="Active or archived flag.")

    # -----------------------------------------------------------
    # Meta Configuration
    # -----------------------------------------------------------
    class Meta:
        ordering = ["-generated_at"]
        verbose_name = "Cached Report"
        verbose_name_plural = "Cached Reports"
        
        constraints = [
            # Weekly report (global)
            models.UniqueConstraint(
                fields=["report_type", "year", "week_number"],
                condition=models.Q(report_type="weekly"),
                name="unique_weekly_report",
            ),

            # Monthly report
            models.UniqueConstraint(
                fields=["report_type", "year", "month"],
                condition=models.Q(report_type="monthly"),
                name="unique_monthly_report",
            ),

            # Manager-wise weekly report
            models.UniqueConstraint(
                fields=["report_type", "year", "week_number", "manager"],
                condition=models.Q(report_type="manager"),
                name="unique_manager_weekly_report",
            ),

            # Department-wise weekly report
            models.UniqueConstraint(
                fields=["report_type", "year", "week_number", "department"],
                condition=models.Q(report_type="department"),
                name="unique_department_weekly_report",
            ),
        ]

        indexes = [
            models.Index(fields=["year"]),
            models.Index(fields=["month"]),
            models.Index(fields=["week_number"]),
            models.Index(fields=["report_type"]),
        ]

    # -----------------------------------------------------------
    # Validation
    # -----------------------------------------------------------
    def clean(self):
        """Ensure correct period fields based on report type."""
        if self.report_type in ["weekly", "manager", "department"] and self.week_number is None:
            raise ValidationError("Week number is required for weekly/manager/department reports.")
        if self.report_type == "monthly" and not self.month:
            raise ValidationError("Month is required for monthly reports.")

    # -----------------------------------------------------------
    # Save Override
    # -----------------------------------------------------------
    def save(self, *args, **kwargs):
        """Validate, timestamp, and auto-generate report name before saving."""
        self.full_clean()
        if not self.pk:
            self.generated_at = timezone.now()

        # Auto name for UI
        self.report_name = self.report_scope

        # Cleanup replaced file (if any)
        if self.pk:
            old = CachedReport.objects.filter(pk=self.pk).first()
            if old and old.file_path and old.file_path != self.file_path and os.path.isfile(old.file_path.path):
                try:
                    os.remove(old.file_path.path)
                except Exception:
                    pass

        super().save(*args, **kwargs)

    # -----------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------
    def generate_filename(self, extension="csv"):
        """Return clean, unique filename for exports."""
        base = f"{self.report_type.title()}_{self.get_period_display()}".replace(" ", "_")
        timestamp = timezone.now().strftime("%Y%m%d_%H%M")
        return f"{base}_{timestamp}.{extension}".replace("__", "_")

    def get_payload_summary(self):
        """Return summarized KPI stats for dashboards."""
        data = self.payload.get("records", [])
        if not data:
            return {"count": 0, "avg_score": 0, "top_emp": None}
        avg_score = round(sum(r.get("average_score", 0) for r in data) / len(data), 2)
        top = max(data, key=lambda r: r.get("average_score", 0), default={})
        return {"count": len(data), "avg_score": avg_score, "top_emp": top.get("employee_full_name")}

    def get_period_display(self):
        """Return readable label for dashboards and exports."""
        if self.report_type in ["weekly", "manager", "department"] and self.week_number:
            return f"Week {self.week_number}, {self.year}"
        elif self.report_type == "monthly" and self.month:
            return f"Month {self.month}, {self.year}"
        return str(self.year)

    @property
    def export_type(self):
        """Return export type (PDF/Excel) based on file name."""
        if not self.file_path:
            return "-"
        _, ext = os.path.splitext(self.file_path.name)
        return ext.replace(".", "").upper()

    @property
    def report_scope(self):
        """Detailed UI label."""
        if self.report_type == "manager" and self.manager:
            return f"Manager: {self.manager.get_full_name()} ({self.get_period_display()})"
        elif self.report_type == "department":
            dept_name = (
                self.department.name
                if self.department and self.department.master_type == MasterType.DEPARTMENT
                else "Deactivated Department"
            )
            return f"Department: {dept_name} ({self.get_period_display()})"
        return f"{self.report_type.title()} ({self.get_period_display()})"

    def soft_delete(self):
        """Soft archive."""
        self.is_active = False
        self.save(update_fields=["is_active"])

    def restore(self):
        """Reactivate archived report."""
        self.is_active = True
        self.save(update_fields=["is_active"])

    @staticmethod
    def get_latest(report_type):
        """Fetch most recent active report of a given type."""
        return CachedReport.objects.filter(
            report_type=report_type, is_active=True
        ).order_by("-generated_at").first()

    def __str__(self):
        if self.report_type == "weekly" and self.week_number:
            return f"Weekly Report — Week {self.week_number}, {self.year}"
        elif self.report_type == "monthly" and self.month:
            return f"Monthly Report — Month {self.month}, {self.year}"
        elif self.report_type == "manager" and self.manager:
            return f"Manager Report — {self.manager.get_full_name()} ({self.get_period_display()})"
        elif self.report_type == "department":
            dept_name = (
                self.department.name
                if self.department and self.department.master_type == MasterType.DEPARTMENT
                else "Deactivated Department"
            )
            return f"Department Report — {dept_name} ({self.get_period_display()})"
        return f"{self.report_type.title()} Report ({self.year})"
