# ==============================================================================
# FILE: masters/models.py
# ==============================================================================

from __future__ import annotations

from typing import Optional, Any
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.db.models import Q


class MasterType(models.TextChoices):
    ROLE = 'ROLE', _('Role')
    DEPARTMENT = 'DEPARTMENT', _('Department')
    PROJECT = 'PROJECT', _('Project')
    MEASUREMENT = 'MEASUREMENT', _('Measurement')


class MasterStatus(models.TextChoices):
    """Enumeration of master record statuses."""
    ACTIVE = 'Active', _('Active')
    INACTIVE = 'Inactive', _('Inactive')


class Master(models.Model):
    """
    Generic master data model serving as single source of truth.
    
    Supports hierarchical structures and extensible metadata for
    roles, departments, projects, and measurements.
    """
    
    # Core fields
    master_type = models.CharField(
        max_length=20,
        choices=MasterType.choices,
        db_index=True,
        help_text=_("Category of master data")
    )
    name = models.CharField(
        max_length=100,
        help_text=_("Display name of the master entry")
    )
    code = models.CharField(max_length=20, blank=True, default='')
    description = models.TextField(
        blank=True,
        help_text=_("Detailed description")
    )
    status = models.CharField(
        max_length=10,
        choices=MasterStatus.choices,
        default=MasterStatus.ACTIVE,
        db_index=True,
        help_text=_("Current status of the record")
    )
    
    # Hierarchy
    parent = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name='children',
        help_text=_("Parent entry for hierarchical structures")
    )
    
    # Configuration
    display_order = models.PositiveSmallIntegerField(
        default=0,
        help_text=_("Sort order for UI display")
    )
    is_system = models.BooleanField(
        default=False,
        help_text=_("System record - protected from deletion")
    )
    metadata = models.JSONField(
        blank=True,
        null=True,
        help_text=_("Flexible JSON storage for type-specific attributes")
    )
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_created'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_updated'
    )

    class Meta:
        db_table = 'masters'
        ordering = ['master_type', 'display_order', 'name']
        verbose_name = _('Master')
        verbose_name_plural = _('Masters')
        constraints = [
            models.UniqueConstraint(
                fields=['master_type', 'name'],
                name='unique_master_name_per_type',
                condition=Q(status=MasterStatus.ACTIVE)
            ),
            models.UniqueConstraint(
                fields=['master_type', 'code'],
                name='unique_master_code_per_type',
                condition=~Q(code='')
            ),
        ]
        indexes = [
            models.Index(fields=['master_type', 'status']),
            models.Index(fields=['parent', 'master_type']),
        ]

    def __str__(self) -> str:
        return f"{self.get_master_type_display()}: {self.name}"

    def get_absolute_url(self) -> str:
        """Return admin change URL."""
        return reverse('admin:masters_master_change', args=[self.pk])

    def clean(self) -> None:
        """Validate model data before saving."""
        super().clean()
        
        # Normalize text fields
        self.name = self.name.strip() if self.name else ''
        if self.code:
            self.code = self.code.strip().upper()
        
        # Validate parent type matches
        if self.parent and self.parent.master_type != self.master_type:
            raise ValidationError({
                'parent': _('Parent must be of the same master type.')
            })
    
    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save instance with full validation."""
        self.full_clean()
        super().save(*args, **kwargs)

# ==============================================================================
# DEPARTMENT EXTENSION
# ==============================================================================

class DepartmentDetails(models.Model):
    """
    Extended attributes specific to DEPARTMENT master type.
    """

    master = models.OneToOneField(
        Master,
        on_delete=models.CASCADE,
        related_name='department_details',
        limit_choices_to={'master_type': MasterType.DEPARTMENT},
    )

    is_default = models.BooleanField(
        default=False,
        help_text=_("Whether this is the default department")
    )

    deactivated_at = models.DateTimeField(
        null=True,
        blank=True
    )

    deactivated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='deactivated_departments'
    )

    deactivation_reason = models.TextField(
        blank=True
    )

    class Meta:
        db_table = 'department_details'
        verbose_name = _('Department Detail')
        verbose_name_plural = _('Department Details')

    def __str__(self):
        return f"Details for {self.master.name}"


# ==============================================================================
# PROJECT EXTENSION
# ==============================================================================

class ProjectDetails(models.Model):
    """
    Extended attributes specific to PROJECT master type.
    """
    
    master = models.OneToOneField(
        Master,
        on_delete=models.CASCADE,
        related_name='project_details',
        limit_choices_to={'master_type': MasterType.PROJECT},
        help_text=_("Linked master record")
    )
    department = models.ForeignKey(
        Master,
        on_delete=models.PROTECT,
        related_name='department_projects',
        limit_choices_to={'master_type': MasterType.DEPARTMENT},
        help_text=_("Owning department")
    )
    # REMOVED: managers M2M to employee.Employee (isolated per requirements)
    
    class Meta:
        db_table = 'project_details'
        verbose_name = _('Project Detail')
        verbose_name_plural = _('Project Details')

    def __str__(self) -> str:
        return f"Details for {self.master.name}"


# ==============================================================================
# AUDIT LOG
# ==============================================================================

class AuditAction(models.TextChoices):
    """Enumeration of audit log actions."""
    CREATE = 'CREATE', _('Created')
    UPDATE = 'UPDATE', _('Updated')
    DELETE = 'DELETE', _('Deleted')
    STATUS_CHANGE = 'STATUS_CHANGE', _('Status Changed')


class MasterAuditLog(models.Model):
    """
    Immutable audit trail for all master data modifications.
    """
    
    master = models.ForeignKey(
        Master,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        help_text=_("Affected master record")
    )
    action = models.CharField(
        max_length=20,
        choices=AuditAction.choices,
        help_text=_("Type of change performed")
    )
    old_data = models.JSONField(
        blank=True,
        null=True,
        help_text=_("Previous state snapshot")
    )
    new_data = models.JSONField(
        blank=True,
        null=True,
        help_text=_("New state snapshot")
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text=_("User who made the change")
    )
    changed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        help_text=_("Client IP address")
    )
    user_agent = models.CharField(
        max_length=255,
        blank=True,
        help_text=_("Client browser/agent")
    )

    class Meta:
        db_table = 'master_audit_logs'
        ordering = ['-changed_at']
        verbose_name = _('Master Audit Log')
        verbose_name_plural = _('Master Audit Logs')
        indexes = [
            models.Index(fields=['master', '-changed_at']),
            models.Index(fields=['action', '-changed_at']),
        ]

    def __str__(self) -> str:
        return f"{self.action} - {self.master} - {self.changed_at}"