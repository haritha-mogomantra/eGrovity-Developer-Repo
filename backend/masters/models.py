# ==============================================================================
# FILE: masters/models.py
# ==============================================================================

from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.db.models import Q

class MasterType(models.TextChoices):
    """Enum for allowed master types"""
    ROLE = 'ROLE', _('Role')
    DEPARTMENT = 'DEPARTMENT', _('Department')
    DESIGNATION = 'DESIGNATION', _('Designation')
    PROJECT = 'PROJECT', _('Project')
    METRIC = 'METRIC', _('Metric')

class MasterStatus(models.TextChoices):
    """Enum for master status"""
    ACTIVE = 'Active', _('Active')
    INACTIVE = 'Inactive', _('Inactive')

class Master(models.Model):
    """
    Generic master data model for all master types.
    Single source of truth for roles, departments, projects, metrics.
    """
    id = models.AutoField(primary_key=True)
    master_type = models.CharField(
        max_length=20,
        choices=MasterType.choices,
        db_index=True,
        help_text="Type of master data"
    )
    name = models.CharField(
        max_length=100,
        help_text="Name of the master entry"
    )
    description = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Optional description"
    )
    code = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Short code (for departments, etc.)"
    )
    status = models.CharField(
        max_length=10,
        choices=MasterStatus.choices,
        default=MasterStatus.ACTIVE,
        db_index=True,
        help_text="Active or Inactive status"
    )
    
    # Extensible metadata field for future requirements
    metadata = models.JSONField(
        blank=True,
        null=True,
        help_text="Additional flexible properties"
    )
    
    # For hierarchical masters (e.g., sub-departments)
    parent = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name='children'
    )
    
    # Display order for UI sorting
    display_order = models.IntegerField(
        default=0,
        help_text="Order for display in UI"
    )
    
    # System masters cannot be deleted
    is_system = models.BooleanField(
        default=False,
        help_text="System-level master, protected from deletion"
    )
    
    # Audit fields
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='masters_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='masters_updated'
    )
    updated_at = models.DateTimeField(auto_now=True)

    # =========================
    # Department lifecycle (ONLY for DEPARTMENT type)
    # =========================
    is_default = models.BooleanField(
        default=False,
        help_text="Marks the default/fallback department"
    )

    deactivated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When department was deactivated"
    )

    deactivated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="departments_deactivated",
        help_text="Who deactivated the department"
    )

    deactivation_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Reason for department deactivation"
    )


    class Meta:
        db_table = 'masters'
        ordering = ['master_type', 'display_order', 'name']
        indexes = [
            models.Index(fields=['master_type', 'status']),
            models.Index(fields=['name']),
            models.Index(fields=['code']),
        ]
        verbose_name = 'Master'
        verbose_name_plural = 'Masters'

    def __str__(self):
        return f"{self.master_type}: {self.name}"

    def clean(self):
        """Custom validation"""
        # Trim whitespace
        if self.name:
            self.name = self.name.strip()
        
        if self.code:
            self.code = self.code.strip().upper()
        
        # Check for case-insensitive duplicates
        if self.name:
            duplicate = Master.objects.filter(
                master_type=self.master_type,
                name__iexact=self.name,
                status=MasterStatus.ACTIVE
            ).exclude(pk=self.pk).exists()
            
            if duplicate:
                raise ValidationError({
                    'name': _(f'A master with this name already exists for type {self.master_type}')
                })
        
        # Check for duplicate codes within same master type
        if self.code and self.master_type == MasterType.DEPARTMENT:
            duplicate_code = Master.objects.filter(
                master_type=self.master_type,
                code__iexact=self.code
            ).exclude(pk=self.pk).exists()
            
            if duplicate_code:
                raise ValidationError({
                    'code': _('A department with this code already exists')
                })
    
        
        # Validate parent has same type
        if self.parent and self.parent.master_type != self.master_type:
            raise ValidationError({
                'parent': _('Parent must be of the same master type')
            })
        
        # =========================
        # Department-specific rules
        # =========================
        if self.master_type == MasterType.DEPARTMENT:
            # Default department cannot be inactive
            if self.is_default and self.status == MasterStatus.INACTIVE:
                raise ValidationError({
                    'is_default': _('Default department cannot be deactivated')
                })

            # Deactivation reason mandatory when inactivating
            if self.status == MasterStatus.INACTIVE and not self.deactivation_reason:
                raise ValidationError({
                    'deactivation_reason': _('Deactivation reason is required')
                })
            
            # Enforce single default department (MySQL-safe)
            if self.is_default:
                existing_default = Master.objects.filter(
                    master_type=MasterType.DEPARTMENT,
                    is_default=True
                ).exclude(pk=self.pk)

                if existing_default.exists():
                    raise ValidationError({
                        'is_default': _('Only one default department is allowed')
                    })
        
        if self.master_type == MasterType.DEPARTMENT and self.status == MasterStatus.ACTIVE:
            self.deactivated_at = None
            self.deactivated_by = None
            self.deactivation_reason = None

        # =========================
        # Role metadata validation
        # =========================
        if self.master_type == MasterType.ROLE and self.metadata:
            scope = self.metadata.get("scope")
            level = self.metadata.get("level")

            if scope not in ("GLOBAL", "DEPARTMENT"):
                raise ValidationError({
                    'metadata': _('ROLE metadata.scope must be GLOBAL or DEPARTMENT')
                })

            if not isinstance(level, int) or level < 1:
                raise ValidationError({
                    'metadata': _('ROLE metadata.level must be a positive integer')
                })
            
        if self.master_type != MasterType.DEPARTMENT and self.is_default:
            raise ValidationError({
                'is_default': _('is_default is only valid for departments')
            })
        

        if self.master_type != MasterType.DEPARTMENT:
            if any([self.deactivated_at, self.deactivated_by, self.deactivation_reason]):
                raise ValidationError(
                    _('Deactivation fields are only applicable to departments')
                )
            
        if self.is_default and self.status != MasterStatus.ACTIVE:
            raise ValidationError({
                'status': _('Default department must always be ACTIVE')
            })


    def save(self, *args, **kwargs):
        """
        Override save to run validation except for
        status-only updates (soft delete / status change).
        """

        update_fields = kwargs.get("update_fields")

        # ✅ Skip full_clean for soft delete / status-only update
        if (
            update_fields
            and set(update_fields).issubset({"status", "updated_by", "updated_at"})
            and self.master_type != MasterType.DEPARTMENT
        ):
            super().save(*args, **kwargs)
            return

        # Normal create / update → validate
        self.full_clean()
        super().save(*args, **kwargs)


class MasterAuditLog(models.Model):
    """
    Audit trail for all master changes
    """
    ACTION_CHOICES = [
        ('CREATE', 'Created'),
        ('UPDATE', 'Updated'),
        ('DELETE', 'Deleted'),
        ('STATUS_CHANGE', 'Status Changed'),
    ]
    
    master = models.ForeignKey(
        Master,
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    old_data = models.JSONField(blank=True, null=True)
    new_data = models.JSONField(blank=True, null=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )
    changed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = 'master_audit_logs'
        ordering = ['-changed_at']
        indexes = [
            models.Index(fields=['master', '-changed_at']),
        ]

    def __str__(self):
        return f"{self.action} - {self.master} - {self.changed_at}"
    


# =====================================================
# PROJECT EXTENSION (PROJECT-SPECIFIC DATA)
# =====================================================

class ProjectDetails(models.Model):
    project = models.OneToOneField(
        Master,
        on_delete=models.CASCADE,
        related_name="project_details",
        limit_choices_to={"master_type": MasterType.PROJECT}
    )

    department = models.ForeignKey(
        Master,
        on_delete=models.PROTECT,
        related_name="projects_by_department",
        limit_choices_to={"master_type": MasterType.DEPARTMENT}
    )

    managers = models.ManyToManyField(
        "employee.Employee",
        blank=True,
        related_name="managed_projects"
    )

    class Meta:
        db_table = "project_details"

    def __str__(self):
        return f"ProjectDetails({self.project.name})"
