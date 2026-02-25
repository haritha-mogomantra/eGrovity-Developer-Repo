# ===========================================================
# employee/models.py
# ===========================================================
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
import os
from masters.models import Master, MasterType
from masters.models import MasterStatus


# Use the AUTH_USER_MODEL string to avoid import-time circular issues
User = settings.AUTH_USER_MODEL

# ===========================================================
# Employee Model
# ===========================================================
class Employee(models.Model):
    """Represents employee records linked to the User model."""

    STATUS_CHOICES = [
        ("Active", "Active"),
        ("Inactive", "Inactive"),
        ("On Leave", "On Leave"),
    ]

    # -----------------------------------------------------------
    # Core Relationships
    # -----------------------------------------------------------
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="employee_profile",
        help_text="Linked Django User account."
    )
    department = models.ForeignKey(
        Master,
        on_delete=models.PROTECT,
        related_name="employees",
        limit_choices_to={"master_type": MasterType.DEPARTMENT},
        help_text="Department (Master-based)"
    )
    role = models.ForeignKey(
        Master,
        on_delete=models.PROTECT,
        related_name="employees_by_role",
        limit_choices_to={"master_type": MasterType.ROLE},
        help_text="Role (Master-based)"
    )
    manager = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="team_members",
        help_text="Reporting manager for this employee."
    )

    # -----------------------------------------------------------
    # Professional Fields
    # -----------------------------------------------------------
    designation = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        db_index=True,
        help_text="Employee designation (manual entry)"
    )
    joining_date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Active")

    # -----------------------------------------------------------
    # Personal Information
    # -----------------------------------------------------------
    contact_number = models.CharField(max_length=15, blank=True, null=True)
    gender = models.CharField(max_length=10, blank=True, null=True)
    dob = models.DateField(blank=True, null=True, help_text="Date of birth (DD-MM-YYYY)")
    profile_picture = models.ImageField(
        upload_to="profile_pics/%Y/%m/%d",
        blank=True,
        null=True,
        help_text="Profile picture (JPG/PNG)"
    )

    # -----------------------------------------------------------
    # Address Information
    # -----------------------------------------------------------
    address_line1 = models.CharField(max_length=255, blank=True, null=True)
    address_line2 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    pincode = models.CharField(max_length=12, blank=True, null=True)

    # -----------------------------------------------------------
    # System Flags
    # -----------------------------------------------------------
    location = models.CharField(max_length=100, blank=True, null=True)
    is_deleted = models.BooleanField(default=False, help_text="Soft delete flag for employee.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # -----------------------------------------------------------
    # Meta Configuration
    # -----------------------------------------------------------
    class Meta:
        ordering = ["id"]
        verbose_name = "Employee"
        verbose_name_plural = "Employees"
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["department"]),
            models.Index(fields=["is_deleted"]),
        ]

    # -----------------------------------------------------------
    # Utility Properties
    # -----------------------------------------------------------
    @property
    def emp_id(self):
        """Return the emp_id stored on the related User (if available)."""
        return getattr(self.user, "emp_id", None)

    def __str__(self):
        full_name = f"{self.user.first_name} {self.user.last_name}".strip()
        return f"{self.emp_id or '-'} - {full_name or self.user.username}"

    def get_full_name(self):
        """Return user's full name or username fallback."""
        return f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username


    @property
    def manager_display_name(self):
        """
        Convenient property returning manager display name or the reporting_manager_name fallback.
        Useful in serializers/templates where manager may be null.
        """
        if self.manager and hasattr(self.manager, "user"):
            return f"{self.manager.user.first_name} {self.manager.user.last_name}".strip()
        return "Not Assigned"


    @property
    def team_size(self):
        """Return number of direct reports for this employee (fast DB query)."""
        return Employee.objects.filter(manager=self, is_deleted=False).count()

    # -----------------------------------------------------------
    # Validation
    # -----------------------------------------------------------
    def clean(self):
        """
        Model-level validation. Serializer also validates, but we keep strict checks
        here as an additional safety-net for any direct model operations.
        """
        # A serializer may set this attribute when it already validated data
        # Prevent double validation if flagged.
        if hasattr(self, "_validated_from_serializer"):
            return

        if self.is_deleted:
            raise ValidationError({"employee": "❌ This employee record has been deleted. No modifications allowed."})

        if not self.user or not getattr(self.user, "email", None):
            raise ValidationError({"user": "Linked User must have a valid email."})

        # Manager cannot be self
        if self.manager and self.manager == self:
            raise ValidationError({"manager": "An employee cannot be their own manager."})

        if self.manager:
            if self.manager.is_deleted:
                raise ValidationError({"manager": "Manager cannot be deleted"})

            if self.manager.status != "Active":
                raise ValidationError({"manager": "Manager must be active"})

        # Department required for an employee
        if not self.department:
            raise ValidationError({"department": "Employee must belong to a department."})
        
        if not self.role:
            raise ValidationError({"role": "Employee must have a role assigned."})

        # Date checks
        if self.joining_date and self.joining_date > timezone.now().date():
            raise ValidationError({"joining_date": "Joining date cannot be in the future."})

        if self.dob and self.dob > timezone.now().date():
            raise ValidationError({"dob": "Date of birth cannot be in the future."})

        # Pincode numeric
        if self.pincode and not self.pincode.isdigit():
            raise ValidationError({"pincode": "Pincode must contain only digits."})

        # Profile picture extension check
        if self.profile_picture:
            ext = os.path.splitext(self.profile_picture.name)[1].lower()
            if ext not in [".jpg", ".jpeg", ".png"]:
                raise ValidationError({"profile_picture": "Only JPG and PNG images are allowed."})
            
        if self.status == "Active":

            if self.department.status != MasterStatus.ACTIVE:
                raise ValidationError({
                    "status": "Employee cannot be active in an inactive department"
                })

            if self.role.status != MasterStatus.ACTIVE:
                raise ValidationError({
                    "status": "Employee cannot be active with an inactive role"
                })

    # -----------------------------------------------------------
    # Save Override (JOIN lifecycle)
    # -----------------------------------------------------------
    def save(self, *args, **kwargs):
        if not hasattr(self, "_validated_from_serializer"):
            self.full_clean()
        super().save(*args, **kwargs)

            
    # -----------------------------------------------------------
    # Save Override
    # -----------------------------------------------------------
    def soft_delete(self, action_by=None, reason="Employee soft deleted"):
        """
        Soft delete the employee and deactivate the user account.
        Also logs lifecycle termination.
        """
        if self.is_deleted:
            raise ValidationError({"employee": "This employee is already deleted."})

        # --------------------------------------------------
        # Soft delete flags
        # --------------------------------------------------
        self.is_deleted = True
        self.status = "Inactive"

        if self.user:
            self.user.is_active = False
            self.user.save(update_fields=["is_active"])

        super().save(update_fields=["is_deleted", "status"])