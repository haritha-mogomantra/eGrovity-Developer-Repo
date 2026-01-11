# ==============================================================================
# FILE: employee_lifecycle/models.py
# ==============================================================================

from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from masters.models import Master, MasterType

User = get_user_model()


class MovementType(models.TextChoices):
    JOIN = 'JOIN', 'Initial Join'
    TRANSFER = 'TRANSFER', 'Department Transfer'
    AUTO_TRANSFER = 'AUTO_TRANSFER', 'Auto Transfer (System)'
    DEPT_DEACTIVATION = 'DEPT_DEACTIVATION', 'Department Deactivated'
    PROMOTION = 'PROMOTION', 'Role Promotion'
    DEMOTION = 'DEMOTION', 'Role Demotion'
    RESIGNATION = 'RESIGNATION', 'Employee Resignation'
    TERMINATION = 'TERMINATION', 'Employment Terminated'


class EmployeeDepartmentHistory(models.Model):
    """
    Immutable employee lifecycle record.
    ONE ROW = ONE TENURE
    """

    employee = models.ForeignKey(
        'employee.Employee',
        on_delete=models.PROTECT,
        related_name='lifecycle_history'
    )

    department = models.ForeignKey(
        Master,
        on_delete=models.PROTECT,
        related_name='lifecycle_departments',
        limit_choices_to={"master_type": MasterType.DEPARTMENT}
    )

    role = models.ForeignKey(
        Master,
        on_delete=models.PROTECT,
        related_name='lifecycle_roles',
        limit_choices_to={"master_type": MasterType.ROLE}
    )

    designation = models.ForeignKey(
        Master,
        on_delete=models.PROTECT,
        related_name='lifecycle_designations',
        limit_choices_to={"master_type": MasterType.METRIC}
    )

    joined_at = models.DateTimeField()
    left_at = models.DateTimeField(null=True, blank=True)

    movement_type = models.CharField(
        max_length=30,
        choices=MovementType.choices
    )

    reason = models.TextField()

    action_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'employee_department_history'
        ordering = ['-joined_at']
        indexes = [
            models.Index(fields=['employee', 'joined_at']),
            models.Index(fields=['department']),
            models.Index(fields=['movement_type']),
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Lifecycle records are immutable")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee} | {self.department} | {self.role}"
