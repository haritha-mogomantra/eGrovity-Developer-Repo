from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.db import transaction
import logging

from .models import Employee
from masters.models import Master, MasterType

logger = logging.getLogger(__name__)

# ===========================================================
# Helper — Update Department Employee Count
# ===========================================================
def update_department_count(department):
    if not department:
        return

    try:
        count = Employee.objects.filter(
            department=department,
            status="Active"
        ).count()

        Master.objects.filter(
            id=department.id,
            master_type=MasterType.DEPARTMENT
        ).update(
            metadata={
                **(department.metadata or {}),
                "employee_count": count
            }
        )
    except Exception as e:
        logger.warning(f"[DeptSync] Failed to update count: {e}")

# ===========================================================
# PRE-SAVE — Track Department Change
# ===========================================================
@receiver(pre_save, sender=Employee)
def track_department_change(sender, instance, **kwargs):
    if not instance.pk:
        instance._old_department_id = None
        return

    try:
        old = Employee.objects.get(pk=instance.pk)
        instance._old_department_id = old.department_id
    except Employee.DoesNotExist:
        instance._old_department_id = None

# ===========================================================
# POST-SAVE — Handle Create / Move
# ===========================================================
@receiver(post_save, sender=Employee)
def handle_employee_save(sender, instance, created, **kwargs):

    def _update():
        if created:
            update_department_count(instance.department)
            return

        old_id = getattr(instance, "_old_department_id", None)
        new_id = instance.department_id

        if old_id != new_id:
            if old_id:
                old_dept = Master.objects.filter(
                    id=old_id,
                    master_type=MasterType.DEPARTMENT
                ).first()
                update_department_count(old_dept)

            if new_id:
                update_department_count(instance.department)

    transaction.on_commit(_update)

# ===========================================================
# POST-DELETE — Handle Removal
# ===========================================================
@receiver(post_delete, sender=Employee)
def handle_employee_delete(sender, instance, **kwargs):
    transaction.on_commit(lambda: update_department_count(instance.department))
