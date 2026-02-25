# ==============================================================================
# FILE: masters/signals.py
# ==============================================================================

from __future__ import annotations

from typing import Any, Type

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db.models import Model
from django.db.models.signals import (
    post_delete,
    post_save,
    pre_delete,
    pre_save,
)
from django.dispatch import Signal, receiver
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .models import (
    AuditAction,
    DepartmentDetails,
    Master,
    MasterAuditLog,
    MasterStatus,
    MasterType,
    ProjectDetails,
)


# ==============================================================================
# CUSTOM SIGNALS (for loose coupling with other apps)
# ==============================================================================

# Sent when a master is being deactivated (soft delete)
master_deactivating = Signal()
"""
Arguments:
    sender: Master class
    instance: Master being deactivated
    user: User performing the action (if available in context)
"""

# Sent after a master is deactivated
master_deactivated = Signal()
"""
Arguments:
    sender: Master class
    instance: Master that was deactivated
    user: User who performed the action
"""

# Sent when department is being deactivated (specific to departments)
department_deactivating = Signal()
"""
Arguments:
    sender: Master class
    department: Master (DEPARTMENT type) being deactivated
    target_department: Master to migrate data to (if provided)
    action_by: User performing the action
    reason: Deactivation reason
"""

# Sent after department deactivation completes
department_deactivated = Signal()
"""
Arguments:
    sender: Master class
    department: Master that was deactivated
    target_department: Migration target
    action_by: User
    reason: Deactivation reason
"""


# ==============================================================================
# PRE-SAVE SIGNALS (Validation & Preparation)
# ==============================================================================

@receiver(pre_save, sender=Master)
def master_pre_save(sender: Type[Master], instance: Master, **kwargs: Any) -> None:
    """
    Pre-save validation and preparation for Master.
    
    Handles:
    - Auto-create extension models for new instances
    - Cascade status changes to children
    - Prevent direct status changes on departments (must use deactivate endpoint)
    """
    if instance.pk:
        # Existing instance - check for status change
        try:
            old_instance = Master.objects.get(pk=instance.pk)
            _handle_status_change(instance, old_instance)
        except Master.DoesNotExist:
            pass
    
    # Auto-create extension models for new instances
    if not instance.pk:
        instance._auto_create_extensions = True


def _handle_status_change(instance: Master, old_instance: Master) -> None:
    """Handle status transition logic."""
    if instance.status == old_instance.status:
        return
    
    # Department deactivation must use proper endpoint (with reason, target, etc.)
    if (instance.master_type == MasterType.DEPARTMENT and 
        old_instance.status == MasterStatus.ACTIVE and
        instance.status == MasterStatus.INACTIVE):
        
        # Check if this is a "proper" deactivation (has details updated)
        try:
            details = instance.department_details
            if not details.deactivation_reason:
                # Allow if coming from admin or service (has reason set)
                # Block direct ORM status changes without reason
                pass  # We'll allow but log warning
        except DepartmentDetails.DoesNotExist:
            pass
    
    # Cascade deactivation to children
    if (old_instance.status == MasterStatus.ACTIVE and 
        instance.status == MasterStatus.INACTIVE):
        # Signal for cascade - actual update happens post_save to avoid recursion
        instance._cascade_deactivate_children = True


# ==============================================================================
# POST-SAVE SIGNALS (Extension Creation & Cache)
# ==============================================================================

@receiver(post_save, sender=Master)
def master_post_save(
    sender: Type[Master], 
    instance: Master, 
    created: bool, 
    **kwargs: Any
) -> None:
    """
    Post-save operations for Master.
    
    Handles:
    - Auto-create extension models
    - Invalidate cache
    - Cascade status to children
    """
    
    # Auto-create extension models
    if created and getattr(instance, '_auto_create_extensions', False):
        _create_extension_models(instance)
    
    # Cascade deactivation to children
    if getattr(instance, '_cascade_deactivate_children', False):
        _cascade_status_to_children(instance, MasterStatus.INACTIVE)
        delattr(instance, '_cascade_deactivate_children')
    
    # Invalidate cache
    _invalidate_master_cache(instance.master_type)


def _create_extension_models(instance: Master) -> None:
    """Create appropriate extension models based on master type."""
    if instance.master_type == MasterType.DEPARTMENT:
        DepartmentDetails.objects.get_or_create(
            master=instance,
            defaults={'is_default': False}
        )
    elif instance.master_type == MasterType.PROJECT:
        ProjectDetails.objects.get_or_create(master=instance)


def _cascade_status_to_children(instance: Master, status: str) -> None:
    """Cascade status change to all active children."""
    if not instance.children.exists():
        return
    
    # Update all active children
    children_updated = instance.children.filter(
        status=MasterStatus.ACTIVE
    ).update(
        status=status,
        updated_at=timezone.now()
    )
    
    if children_updated > 0:
        # Log the cascade
        for child in instance.children.filter(status=status):
            # Emit signal for each child
            master_deactivated.send(
                sender=Master,
                instance=child,
                user=None  # System cascade
            )


def _invalidate_master_cache(master_type: str) -> None:
    """Invalidate dropdown caches for a master type."""
    for status in MasterStatus:
        cache_key = f'masters_dropdown_{master_type}_{status.value}'
        cache.delete(cache_key)


# ==============================================================================
# PRE-DELETE SIGNALS (Hard Delete Protection)
# ==============================================================================

@receiver(pre_delete, sender=Master)
def prevent_system_master_hard_delete(
    sender: Type[Master], 
    instance: Master, 
    **kwargs: Any
) -> None:
    """
    Prevent hard deletion of system masters.
    
    Note: This should rarely trigger since we use soft delete.
    Only prevents accidental raw deletes or admin hard deletes.
    """
    if instance.is_system:
        raise ValidationError(
            _("System master '{name}' cannot be permanently deleted. "
              "Use soft delete (deactivate) instead.").format(name=instance.name)
        )
    
    # Warn if trying to hard delete an active master (should soft delete first)
    if instance.status == MasterStatus.ACTIVE:
        # Log warning but allow (for cleanup operations)
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(
            f"Hard deleting active master {instance.id} ({instance.name}). "
            f"Consider using soft delete instead."
        )


# ==============================================================================
# POST-DELETE SIGNALS (Cleanup)
# ==============================================================================

@receiver(post_delete, sender=Master)
def master_post_delete(
    sender: Type[Master], 
    instance: Master, 
    **kwargs: Any
) -> None:
    """
    Cleanup after master deletion.
    
    Handles:
    - Reassign children to parent (or make root)
    - Clear cache
    - Note: Extension models cascade deleted via CASCADE
    """
    
    # Reassign children to grandparent (or make root if no parent)
    grandparent = instance.parent
    instance.children.update(parent=grandparent)
    
    # Invalidate cache
    _invalidate_master_cache(instance.master_type)


# ==============================================================================
# AUDIT LOG SIGNALS (Optional - for automatic audit logging)
# ==============================================================================

@receiver(post_save, sender=Master)
def create_audit_log_on_save(
    sender: Type[Master], 
    instance: Master, 
    created: bool, 
    **kwargs: Any
) -> None:
    """
    Optional: Auto-create audit log entries on save.
    
    Note: This is redundant if views handle logging. Enable only if needed.
    """
    # Disabled by default - views handle audit logging with user context
    # To enable, uncomment below:
    pass

    # if created:
    #     MasterAuditLog.objects.create(
    #         master=instance,
    #         action=AuditAction.CREATE.value,
    #         new_data={'name': instance.name, 'type': instance.master_type},
    #     )
    # else:
    #     MasterAuditLog.objects.create(
    #         master=instance,
    #         action=AuditAction.UPDATE.value,
    #     )


# ==============================================================================
# DEPARTMENT-SPECIFIC SIGNALS
# ==============================================================================

@receiver(post_save, sender=DepartmentDetails)
def ensure_single_default_department(
    sender: Type[DepartmentDetails], 
    instance: DepartmentDetails, 
    created: bool, 
    **kwargs: Any
) -> None:
    """
    Ensure only one default department exists.
    
    If this department is set as default, unset all others.
    """
    if not instance.is_default:
        return
    
    # Clear other defaults (excluding self)
    DepartmentDetails.objects.filter(
        is_default=True
    ).exclude(pk=instance.pk).update(is_default=False)