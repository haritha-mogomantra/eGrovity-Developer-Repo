# ==============================================================================
# FILE: masters/services.py
# ==============================================================================

from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import Master, MasterType, MasterStatus
from .utils import log_master_change
from employee_lifecycle.services import LifecycleService


class DepartmentService:
    """
    Handles ONLY department-level business operations.
    This is the SINGLE place where departments are deactivated.
    """

    @transaction.atomic
    def deactivate_department(
        self,
        department: Master,
        target_department: Master,
        action_by,
        reason: str
    ) -> dict:
        """
        Deactivate a department and safely move employees.

        Rules enforced:
        - Only DEPARTMENT type allowed
        - Default department cannot be deactivated
        - A valid target department MUST be provided
        - Employees are auto-moved and lifecycle logged
        """

        # --------------------------------------------------
        # Validations
        # --------------------------------------------------
        if department.master_type != MasterType.DEPARTMENT:
            raise ValidationError("Invalid master type for deactivation")

        if department.is_default:
            raise ValidationError("Default department cannot be deactivated")

        if department.status == MasterStatus.INACTIVE:
            raise ValidationError("Department is already inactive")

        if not reason or not reason.strip():
            raise ValidationError("Deactivation reason is mandatory")

        if target_department.master_type != MasterType.DEPARTMENT:
            raise ValidationError("Target must be a department")

        if target_department.status != MasterStatus.ACTIVE:
            raise ValidationError("Target department must be active")

        if target_department.id == department.id:
            raise ValidationError("Target department must be different from source department")

        
        # --------------------------------------------------
        # Move employees (delegated to lifecycle)
        # --------------------------------------------------
        lifecycle_service = LifecycleService()
        lifecycle_summary = lifecycle_service.handle_department_deactivation(
            department=department,
            target_department=target_department,
            action_by=action_by,
            reason=reason
        )

        # --------------------------------------------------
        # Deactivate department (MASTER responsibility)
        # --------------------------------------------------
        old_data = {
            "status": department.status,
            "is_default": department.is_default,
        }

        department.status = MasterStatus.INACTIVE
        department.deactivated_at = timezone.now()
        department.deactivated_by = action_by
        department.deactivation_reason = reason
        department.updated_by = action_by
        department.save()

        # --------------------------------------------------
        # Audit log
        # --------------------------------------------------
        log_master_change(
            master=department,
            action="STATUS_CHANGE",
            user=action_by,
            request=None,
            old_data=old_data,
            new_data={
                "status": department.status,
                "deactivated_at": department.deactivated_at.isoformat(),
                "reason": reason,
            }
        )

        return {
            "department": department.name,
            "moved_to": target_department.name,
            "employees_moved": lifecycle_summary["employees_moved"],
            "roles_downgraded": lifecycle_summary["roles_downgraded"],
        }
