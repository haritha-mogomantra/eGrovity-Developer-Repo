# ===========================================================
# performance/models.py 
# ===========================================================
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
from datetime import timedelta
from masters.models import MasterType
from datetime import date


# -----------------------------------------------------------
# Helper functions
# -----------------------------------------------------------
def current_week_number():
    """Return the current ISO week number."""
    return timezone.now().isocalendar()[1]


def current_year():
    """Return the current ISO year."""
    return timezone.now().isocalendar()[0]


def get_week_range(year, week):
    """Return Monday–Sunday date range for a given ISO year + week."""
    start = date.fromisocalendar(year, week, 1)  # Monday
    end = start + timedelta(days=6)              # Sunday
    return start, end


def get_latest_completed_week():
    """
    Returns (year, week_number) for the latest COMPLETED ISO week.
    Current ongoing week is excluded.
    """
    today = date.today()
    year, week, _ = today.isocalendar()

    # If week > 1 → previous week same year
    if week > 1:
        return year, week - 1

    # Week == 1 → go to last ISO week of previous year
    last_week_prev_year = date(year - 1, 12, 28).isocalendar()[1]
    return year - 1, last_week_prev_year


def is_latest_completed_week(year, week):
    """
    Check whether given year/week is the latest completed week.
    """
    latest_year, latest_week = get_latest_completed_week()
    return int(year) == latest_year and int(week) == latest_week



# -----------------------------------------------------------
# PERFORMANCE EVALUATION MODEL
# -----------------------------------------------------------
class PerformanceEvaluation(models.Model):
    """
    Stores weekly performance data for each employee.
    One record per employee per week per evaluation_type.
    """

    # -------------------------------------------------------
    # Relations
    # -------------------------------------------------------
    employee = models.ForeignKey(
        "employee.Employee",
        on_delete=models.CASCADE,
        related_name="performance_evaluations",
        help_text="Employee whose performance is being evaluated.",
    )
    evaluator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_evaluations",
        help_text="Admin, Manager, or Client who gave the evaluation.",
    )
    department = models.ForeignKey(
        "masters.Master",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="department_performances",
        limit_choices_to={"master_type": MasterType.DEPARTMENT},
        help_text="Department under which the evaluation is recorded.",
    )

    # -------------------------------------------------------
    # Period Info
    # -------------------------------------------------------
    review_date = models.DateField(default=timezone.localdate)

    week_number = models.PositiveSmallIntegerField(default=current_week_number)
    year = models.PositiveSmallIntegerField(default=current_year)

    evaluation_period = models.CharField(
        max_length=120,
        blank=True,
        default="",
        help_text="E.g., Week 41 (07 Oct 2025 - 13 Oct 2025)",
    )

    EVALUATION_TYPE_CHOICES = [
        ("Admin", "Admin"),
        ("Manager", "Manager"),
        ("Client", "Client"),
        ("Self", "Self"),
    ]
    evaluation_type = models.CharField(
        max_length=20,
        choices=EVALUATION_TYPE_CHOICES,
        default="Manager",
        help_text="Who conducted the evaluation.",
    )

    # -------------------------------------------------------
    # Computed Fields
    # -------------------------------------------------------
    total_score = models.PositiveIntegerField(default=0, help_text="Sum of all metrics (max 1500).")
    average_score = models.FloatField(default=0.0, help_text="Average score scaled to 100.")
    rank = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Ranking within department/week.")
    remarks = models.TextField(blank=True, null=True)

    # -------------------------------------------------------
    # Audit Fields
    # -------------------------------------------------------
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # -------------------------------------------------------
    # Meta Configuration
    # -------------------------------------------------------
    class Meta:
        ordering = ["-review_date", "-created_at"]
        verbose_name = "Performance Evaluation"
        verbose_name_plural = "Performance Evaluations"

        indexes = [
            models.Index(fields=["employee"]),
            models.Index(fields=["department"]),
            models.Index(fields=["week_number", "year"]),
            models.Index(fields=["evaluation_type"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["employee", "week_number", "year", "evaluation_type"],
                name="unique_employee_week_year_evaluation"
            )
        ]

    # -------------------------------------------------------
    # Validation
    # -------------------------------------------------------
    def clean(self):
        if self.department and self.employee and self.department != self.employee.department:
            raise ValidationError({
                "department": "Evaluation department must match employee department."
            })

    # -------------------------------------------------------
    # Score Calculation
    # -------------------------------------------------------
    def calculate_total_score(self):
        """Calculate total & average using dynamic Masters measurements only."""

        scores = list(
            self.dynamic_metrics.all().values_list("score", flat=True)
        )

        total = sum(int(x or 0) for x in scores)

        self.total_score = total

        metric_count = len(scores)
        max_score = metric_count * 100

        self.average_score = (
            round((total / max_score) * 100, 2) if max_score else 0.0
        )

        return total

    # -------------------------------------------------------
    # Auto-Ranking Helper (Used by Signals)
    # -------------------------------------------------------
    def auto_rank_trigger(self):
        """
        Dense Ranking:
        - Same score = same rank
        - Next different score = next rank
        - Ranking is GLOBAL (not department-wise)
        """
        evaluations = PerformanceEvaluation.objects.filter(
            week_number=self.week_number,
            year=self.year,
            evaluation_type=self.evaluation_type,
        ).select_related("employee__user").order_by(
            "-total_score",
            "employee__user__first_name",
            "employee__user__last_name"
        )

        last_score = None
        current_rank = 0

        for eval_obj in evaluations:
            if eval_obj.total_score != last_score:
                current_rank += 1
                last_score = eval_obj.total_score

            if eval_obj.rank != current_rank:
                PerformanceEvaluation.objects.filter(pk=eval_obj.pk).update(rank=current_rank)


    # -------------------------------------------------------
    # Helpers
    # -------------------------------------------------------
    def get_metric_summary(self):
        """
        Fully Masters-driven dynamic metrics.
        Backend makes ZERO assumptions about metric names.
        """

        metrics = []

        for metric in self.dynamic_metrics.select_related("measurement"):
            metrics.append({
                "id": metric.measurement.id,
                "name": metric.measurement.name,
                "code": getattr(metric.measurement, "code", None),
                "score": metric.score,
                "comment": metric.comment,
            })

        return {
            "metrics": metrics,
            "total_score": self.total_score,
            "average_score": self.average_score,
            "rank": self.rank,
        }

    def department_rank(self):
        """Return department rank position (1-based) for this employee, robustly using PKs."""
        qs = PerformanceEvaluation.objects.filter(
            department=self.department,
            week_number=self.week_number,
            year=self.year,
            evaluation_type=self.evaluation_type,
        ).order_by("-total_score", "employee__user__emp_id")
        ordered_pks = [o.pk for o in qs]
        try:
            return ordered_pks.index(self.pk) + 1
        except ValueError:
            return None

    def overall_rank(self):
        """Return overall organization-wide rank (1-based) for this employee for the week/year/evaluation_type)."""
        qs = PerformanceEvaluation.objects.filter(
            week_number=self.week_number,
            year=self.year,
            evaluation_type=self.evaluation_type,
        ).order_by("-total_score", "employee__user__emp_id")
        ordered_pks = [o.pk for o in qs]
        try:
            return ordered_pks.index(self.pk) + 1
        except ValueError:
            return None


    # -------------------------------------------------------
    # Save Override
    # -------------------------------------------------------
    def save(self, *args, **kwargs):
        """
        DO NOT override week_number or year.
        Frontend sends them dynamically.
        Only calculate total score and evaluation_period.
        """

        # Department fallback
        if not self.department and getattr(self.employee, "department", None):
            self.department = self.employee.department

        # Calculate scores
        self.full_clean() 
        self.calculate_total_score()

        # Generate evaluation period using selected week/year
        try:
            start, end = get_week_range(self.year, self.week_number)
            self.evaluation_period = (
                f"Week {self.week_number} "
                f"({start.strftime('%d %b')} - {end.strftime('%d %b %Y')})"
            )
        except Exception:
            pass

        super().save(*args, **kwargs)

    # -------------------------------------------------------
    # String Representation
    # -------------------------------------------------------
    def __str__(self):
        emp_name = (
            f"{self.employee.user.first_name} {self.employee.user.last_name}".strip()
            if self.employee and hasattr(self.employee, "user")
            else "Unknown Employee"
        )
        return f"{emp_name} - {self.evaluation_type} ({self.average_score}%)"


class PerformanceMetric(models.Model):
    """
    Dynamic measurements driven by Masters → MEASUREMENT
    Does NOT affect existing hardcoded metrics
    """

    evaluation = models.ForeignKey(
        PerformanceEvaluation,
        on_delete=models.CASCADE,
        related_name="dynamic_metrics"
    )

    measurement = models.ForeignKey(
        "masters.Master",
        on_delete=models.PROTECT,
        limit_choices_to={"master_type": MasterType.MEASUREMENT}
    )

    score = models.PositiveSmallIntegerField(default=0)
    comment = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ("evaluation", "measurement")

    def clean(self):
        if self.score < 0 or self.score > 100:
            raise ValidationError({"score": "Score must be between 0 and 100"})
