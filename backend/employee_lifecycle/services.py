# ==============================================================================
# FILE: employee_lifecycle/services.py
# ==============================================================================

from django.db import transaction
from django.utils import timezone
from employee.models import Employee
from .models import EmployeeDepartmentHistory, MovementType


class LifecycleService:
    """
    Handles ONLY employee lifecycle movements.
    Does NOT deactivate departments.
    """

    @transaction.atomic
    def handle_department_deactivation(
        self,
        department,
        target_department,
        action_by,
        reason
    ):
        """
        Moves employees from a deactivated department to the default department
        and logs lifecycle history.
        """

        employees = Employee.objects.filter(
            department=department,
            is_deleted=False,
            status="Active"
        )

        now = timezone.now()
        summary = {
            "employees_moved": 0,
            "roles_downgraded": 0
        }

        for emp in employees:
            # Close current tenure
            self._close_current_tenure(
                employee=emp,
                left_at=now,
                movement_type=MovementType.DEPT_DEACTIVATION,
                reason=reason,
                action_by=action_by.user if hasattr(action_by, "user") else action_by
            )

            # NOTE:
            # RBAC is currently mirrored on employee.role.
            # In future, this must update EmployeeRoleAssignment instead.
            new_role = emp.role

            if (
                emp.role
                and emp.role.metadata
                and emp.role.metadata.get("scope") == "DEPARTMENT"
                and hasattr(emp.role, "get_fallback_role")
            ):
                fallback_role = emp.role.get_fallback_role()
                if fallback_role and fallback_role != emp.role:
                    new_role = fallback_role
                    summary["roles_downgraded"] += 1

            emp.department = target_department
            emp.role = new_role
            emp.save()

            # Open new tenure
            self._open_new_tenure(
                employee=emp,
                department=target_department,
                role=new_role,
                designation=emp.designation,
                joined_at=now,
                movement_type=MovementType.AUTO_TRANSFER,
                reason=f"Auto-transferred due to deactivation of {department.name}",
                action_by=action_by.user if hasattr(action_by, "user") else action_by
            )

            summary["employees_moved"] += 1

        return summary
    
    # ----------------------------------------------------------------------
    # READ-ONLY PREVIEW
    # ----------------------------------------------------------------------

    def get_department_summary(self, department):
        """
        Read-only summary used for frontend preview
        before department deactivation.
        """

        employee_count = Employee.objects.filter(
            department=department,
            is_deleted=False,
            status="Active"
        ).count()

        return {
            "department_id": department.id,
            "employee_count": employee_count
        }


    # ----------------------------------------------------------------------
    def _close_current_tenure(
        self,
        employee,
        left_at,
        movement_type,
        reason,
        action_by
    ):
        open_tenure = EmployeeDepartmentHistory.objects.filter(
            employee=employee,
            left_at__isnull=True
        ).first()

        if not open_tenure:
            return

        # ❌ DO NOT update existing row
        # ✅ Create a TERMINATION record AND logically close the tenure

        EmployeeDepartmentHistory.objects.create(
            employee=employee,
            department=open_tenure.department,
            role=open_tenure.role,
            designation=open_tenure.designation,
            joined_at=open_tenure.joined_at,
            left_at=left_at,
            movement_type=movement_type,
            reason=reason,
            action_by=action_by
        )

        # ✅ IMPORTANT: logically close the open tenure (system-level)
        EmployeeDepartmentHistory.objects.filter(pk=open_tenure.pk).update(
            left_at=left_at
        )


    # ----------------------------------------------------------------------

    def _open_new_tenure(
        self,
        employee,
        department,
        role,
        designation,
        joined_at,
        movement_type,
        reason,
        action_by
    ):
        EmployeeDepartmentHistory.objects.create(
            employee=employee,
            department=department,
            role=role,
            designation=designation,
            joined_at=joined_at,
            left_at=None,
            movement_type=movement_type,
            reason=reason,
            action_by=action_by
        )
