# ==============================================================================
# FILE: masters/services.py
# ==============================================================================

from __future__ import annotations

from typing import Any, Dict, Optional, TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .models import AuditAction, DepartmentDetails, Master, MasterStatus, MasterType
from .utils import log_master_change

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser


# ==============================================================================
# EXCEPTIONS
# ==============================================================================

class DepartmentDeactivationError(ValidationError):
    """Specific error for department deactivation failures."""
    pass


# ==============================================================================
# DEPARTMENT SERVICE
# ==============================================================================

class DepartmentService:
    """
    Handles department-level business operations.
    
    This service manages:
    - Department deactivation workflow
    - Data migration between departments
    - Validation of department business rules
    
    Note: Employee lifecycle operations (moving employees, role changes)
    are handled via signals or external services to maintain loose coupling.
    """

    @transaction.atomic
    def deactivate_department(
        self,
        department: Master,
        target_department: Master,
        action_by: AbstractUser,
        reason: str
    ) -> Dict[str, Any]:
        """
        Deactivate a department and migrate associated data.
        
        Args:
            department: The department to deactivate
            target_department: The department to migrate data to
            action_by: User performing the action
            reason: Reason for deactivation
            
        Returns:
            Dictionary with deactivation summary
            
        Raises:
            DepartmentDeactivationError: If validation fails or rules violated
        """
        
        # --------------------------------------------------
        # VALIDATION
        # --------------------------------------------------
        self._validate_deactivation(department, target_department, reason)
        
        # --------------------------------------------------
        # PRE-DEACTIVATION HOOK
        # --------------------------------------------------
        # Signal or callback for employee lifecycle (decoupled)
        migration_summary = self._handle_data_migration(
            source=department,
            target=target_department,
            action_by=action_by,
            reason=reason
        )
        
        # --------------------------------------------------
        # PERFORM DEACTIVATION
        # --------------------------------------------------
        old_data = self._capture_state(department)
        
        # Update Master status
        department.status = MasterStatus.INACTIVE
        department.updated_by = action_by
        department.save(update_fields=['status', 'updated_by', 'updated_at'])
        
        # Update DepartmentDetails extension
        details, _ = DepartmentDetails.objects.get_or_create(master=department)
        details.deactivated_at = timezone.now()
        details.deactivated_by = action_by
        details.deactivation_reason = reason
        details.save(update_fields=['deactivated_at', 'deactivated_by', 'deactivation_reason'])
        
        # --------------------------------------------------
        # AUDIT LOGGING
        # --------------------------------------------------
        new_data = {
            'status': department.status,
            'deactivated_at': details.deactivated_at.isoformat() if details.deactivated_at else None,
            'deactivated_by': action_by.id,
            'reason': reason,
        }
        
        log_master_change(
            master=department,
            action=AuditAction.STATUS_CHANGE.value,
            user=action_by,
            request=None,
            old_data=old_data,
            new_data=new_data
        )
        
        # --------------------------------------------------
        # RETURN SUMMARY
        # --------------------------------------------------
        return {
            'department_id': department.id,
            'department_name': department.name,
            'target_department_id': target_department.id,
            'target_department_name': target_department.name,
            'deactivated_at': details.deactivated_at.isoformat() if details.deactivated_at else None,
            'reason': reason,
            'data_migration': migration_summary,
        }

    def _validate_deactivation(
        self,
        department: Master,
        target_department: Master,
        reason: str
    ) -> None:
        """
        Validate department deactivation business rules.
        
        Raises:
            DepartmentDeactivationError: If any rule is violated
        """
        errors = {}
        
        # Type validation
        if department.master_type != MasterType.DEPARTMENT:
            errors['department'] = _('Only departments can be deactivated.')
        
        if target_department.master_type != MasterType.DEPARTMENT:
            errors['target_department'] = _('Target must be a department.')
        
        # Status validation
        if department.status == MasterStatus.INACTIVE:
            errors['department'] = _('Department is already inactive.')
        
        if target_department.status != MasterStatus.ACTIVE:
            errors['target_department'] = _('Target department must be active.')
        
        # Self-reference check
        if target_department.id == department.id:
            errors['target_department'] = _('Cannot migrate to the same department.')
        
        # Default department check
        try:
            if department.department_details.is_default:
                errors['department'] = _('Default department cannot be deactivated.')
        except DepartmentDetails.DoesNotExist:
            pass  # No details = not default
        
        # Reason validation
        if not reason or not reason.strip():
            errors['reason'] = _('Deactivation reason is required.')
        elif len(reason.strip()) < 10:
            errors['reason'] = _('Reason must be at least 10 characters.')
        
        # Active children check
        if department.children.filter(status=MasterStatus.ACTIVE).exists():
            errors['department'] = _('Cannot deactivate department with active sub-departments.')
        
        if errors:
            raise DepartmentDeactivationError(errors)

    def _capture_state(self, department: Master) -> Dict[str, Any]:
        """Capture current state for audit logging."""
        state = {
            'status': department.status,
        }
        
        try:
            state['is_default'] = department.department_details.is_default
        except DepartmentDetails.DoesNotExist:
            state['is_default'] = False
        
        return state

    def _handle_data_migration(
        self,
        source: Master,
        target: Master,
        action_by: AbstractUser,
        reason: str
    ) -> Dict[str, Any]:
        """
        Handle data migration from source to target department.
        
        This is a hook point for:
        - Moving employees (via signals or external service)
        - Reassigning projects
        - Updating references
        
        Returns:
            Summary of migration operations
        """
        # Placeholder for migration logic
        # In a decoupled architecture, this could:
        # 1. Emit a signal for other apps to handle
        # 2. Call a configured callback
        # 3. Return empty summary if no migration needed
        
        from employee.models import Employee
        from employee_lifecycle.models import EmployeeDepartmentHistory

        now = timezone.now()

        employees = Employee.objects.filter(
            department=source,
            status="Active"
        )

        moved_count = employees.count()

        for emp in employees:

            # Close existing active lifecycle record
            EmployeeDepartmentHistory.objects.filter(
                employee=emp,
                department=source,
                left_at__isnull=True
            ).update(left_at=now)

            # Move employee to target department
            emp.department = target
            emp.updated_by = action_by
            emp.save(update_fields=["department", "updated_by"])

            # Create new lifecycle entry
            EmployeeDepartmentHistory.objects.create(
                employee=emp,
                department=target,
                movement_type="DEPT_DEACTIVATION",
                joined_at=now,
                reason=reason,
                action_by=action_by
            )

        return {
            "employees_moved": moved_count,
            "projects_reassigned": 0,
            "roles_adjusted": 0,
        }
        
        # Example: Emit signal for employee_lifecycle to pick up
        # from .signals import department_deactivating
        # department_deactivating.send(
        #     sender=self.__class__,
        #     source_department=source,
        #     target_department=target,
        #     action_by=action_by,
        #     reason=reason
        # )
        
        return summary

    def can_deactivate(self, department: Master) -> tuple[bool, Optional[str]]:
        """
        Check if department can be deactivated without performing action.
        
        Returns:
            Tuple of (can_deactivate, error_message)
        """
        try:
            # Quick checks without target department
            if department.master_type != MasterType.DEPARTMENT:
                return False, _('Only departments can be deactivated.')
            
            if department.status == MasterStatus.INACTIVE:
                return False, _('Department is already inactive.')
            
            try:
                if department.department_details.is_default:
                    return False, _('Default department cannot be deactivated.')
            except DepartmentDetails.DoesNotExist:
                pass
            
            if department.children.filter(status=MasterStatus.ACTIVE).exists():
                return False, _('Department has active sub-departments.')
            
            return True, None
            
        except Exception as e:
            return False, str(e)


# ==============================================================================
# SIGNALS (Optional - for loose coupling)
# ==============================================================================

# from django.dispatch import Signal

# # Sent when department deactivation starts (before transaction commits)
# department_deactivating = Signal()
# """
# Arguments: sender, source_department, target_department, action_by, reason
# """

# # Sent when department deactivation completes (after transaction commits)
# department_deactivated = Signal()
# """
# Arguments: sender, department, target_department, action_by, reason, summary
# """