'''# ===========================================================
# users/models.py
# ===========================================================

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models, transaction
from django.db.models import Max, Q
from django.utils import timezone
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError
from django.utils.crypto import get_random_string
from datetime import timedelta, datetime
import uuid
import os
from masters.models import Master, MasterType


# ===========================================================
# PASSWORD HISTORY MODEL
# ===========================================================
class PasswordHistory(models.Model):
    """
    Track last 5 passwords to prevent reuse.
    """
    user = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='password_history'
    )
    password_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Password History"
        verbose_name_plural = "Password Histories"
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        # Avoid accessing user attributes that might not be fully saved in unusual cases.
        try:
            uname = getattr(self.user, 'username', None) or str(self.user_id)
        except Exception:
            uname = str(self.user_id)
        return f"{uname} - {self.created_at.strftime('%Y-%m-%d')}"

    @classmethod
    def add_password(cls, user, password_hash):
        """Store password hash, keep only the latest 5."""
        # Ensure the user has a PK before associating the history
        if not user.pk:
            return
        cls.objects.create(user=user, password_hash=password_hash)
        # Keep only the latest 5 entries
        old = cls.objects.filter(user=user).order_by('-created_at')[5:]
        if old:
            cls.objects.filter(id__in=[p.id for p in old]).delete()


# ===========================================================
# USER MANAGER
# ===========================================================
class UserManager(BaseUserManager):
    """Custom user manager handling secure emp_id generation."""

    """def generate_emp_id(self):
        """Generate sequential employee ID (EMP0001, EMP0002...)."""
        with transaction.atomic():
            # This uses the stored emp_id string; ensure numeric parse is guarded.
            result = self.model.objects.select_for_update().aggregate(max_emp_id=Max('emp_id'))
            last_emp_id = result.get('max_emp_id')

            if last_emp_id and isinstance(last_emp_id, str) and last_emp_id.startswith("EMP"):
                try:
                    num = int(last_emp_id.replace("EMP", ""))
                    return f"EMP{num + 1:04d}"
                except (ValueError, AttributeError):
                    pass
            return "EMP0001"
            """

    def create_user(self, username=None, password=None, **extra_fields):
        """Create a regular user with secure defaults."""
        emp_id = extra_fields.get("emp_id")
        if not emp_id:
            raise ValidationError({"emp_id": "Employee ID is required and must be provided manually."})
        username = username or emp_id

        if not password:
            password = get_random_string(
                length=12,
                allowed_chars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
            )
            
        extra_fields.setdefault("is_active", True)

        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.temp_password = password
        user.save(using=self._db)


        try:
            log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs")
            os.makedirs(log_dir, exist_ok=True)
            with open(os.path.join(log_dir, "user_creation.log"), "a") as f:
                f.write(f"[{datetime.now()}] Created user {username} ({emp_id})\n")
        except Exception:
            # Do not break user creation if logging fails
            pass

        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("force_password_change", False)

        if not email:
            raise ValueError("Superuser must have an email.")
        if not password:
            raise ValueError("Superuser must have a password.")

        return self.create_user(email=email, password=password, **extra_fields)


# ===========================================================
# USER MODEL
# ===========================================================
class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model for EPTS (Employee Performance Tracking System).
    Aligned with frontend forms and APIs.
    """

    # ---------- CORE ----------
    emp_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Employee ID entered manually by Admin (e.g., EMP0001)"
    )
    username = models.CharField(max_length=150, unique=True, db_index=True)
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)

    temp_password = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        help_text="Stores auto-generated temporary password for testing/logging."
    )

    # ---------- CONTACT ----------
    phone = models.CharField(
        max_length=15,
        null=True,
        blank=True,
        validators=[RegexValidator(r"^\+?\d{7,15}$", "Enter a valid phone number.")],
    )

    department = models.ForeignKey(
        Master,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
        limit_choices_to={"master_type": MasterType.DEPARTMENT},
    )

    designation = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        db_index=True,
        help_text="Employee designation entered manually (e.g. Senior Data Analyst)"
    )

    joining_date = models.DateField(default=timezone.now)

    # ---------- EMAIL VERIFICATION ----------
    is_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=100, null=True, blank=True)
    verification_token_created = models.DateTimeField(null=True, blank=True)

    # ---------- SECURITY ----------
    failed_login_attempts = models.PositiveIntegerField(default=0)
    account_locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)
    force_password_change = models.BooleanField(default=False)

    # ---------- DJANGO FLAGS ----------
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    # ---------- AUDIT ----------
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ---------- MANAGER ----------
    objects = UserManager()

    USERNAME_FIELD = "emp_id"
    REQUIRED_FIELDS = ["email", "username"]

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["emp_id"]
        indexes = [
            models.Index(fields=["username", "email", "emp_id"])
        ]

    def __str__(self):
        # Keep __str__ lightweight and safe (avoid accessing FKs that may be problematic)
        try:
            full = self.get_full_name()
            return f"{full} ({self.emp_id})" if full else f"{self.username} ({self.emp_id})"
        except Exception:
            return f"{self.username or self.emp_id}"

    # ======================================================
    # BASIC METHODS
    # ======================================================
    def get_full_name(self):
        try:
            name = f"{self.first_name} {self.last_name}".strip()
            return name if name else self.username
        except Exception:
            return self.username

    def get_short_name(self):
        return self.first_name or self.username

    # ======================================================
    # VALIDATION
    # ======================================================
    def clean(self):
        """
        Model-level validation.
        Avoid deep FK traversal when PK not yet assigned.
        """
        super().clean()

    def save(self, *args, **kwargs):
        """
        Save with safe validation: if object has a PK, run full_clean.
        If creating (no PK yet), run only light validation to avoid relationship access that requires PK.
        """

        # Light validation: we can still check certain constraints without forcing FK resolution
        # For create (no PK) call full_clean but tolerant: wrap in try/except to avoid FK lookups
        if self.pk:
            # On update, run full validation
            self.full_clean()
        else:
            # On create, run basic clean() but guard against FK problems
            try:
                # call clean() - it's guarded to avoid deep FK traversal if pk is missing
                self.clean()
            except ValidationError:
                # re-raise ValidationError so invalid data is not saved
                raise
            except Exception as e:
                raise e

        super().save(*args, **kwargs)

    # ======================================================
    # ACCOUNT STATUS & ROLE HELPERS
    # ======================================================
    @property
    def status(self):
        if self.account_locked:
            return "Locked"
        return "Active" if self.is_active else "Inactive"

    # ======================================================
    # ACCOUNT LOCKOUT & LOGIN ATTEMPTS
    # ======================================================
    def lock_account(self):
        self.account_locked = True
        self.is_active = False
        self.locked_at = timezone.now()
        self.save(update_fields=["account_locked", "is_active", "locked_at"])

    def unlock_account(self):
        self.account_locked = False
        self.is_active = True
        self.failed_login_attempts = 0
        self.locked_at = None
        self.save(update_fields=["account_locked", "is_active", "failed_login_attempts", "locked_at"])

    def increment_failed_attempts(self):
        # Auto-unlock if lock period expired
        if self.account_locked and self.locked_at:
            if timezone.now() >= self.locked_at + timedelta(hours=2):
                self.unlock_account()
                return
        if self.account_locked:
            return
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= 5:
            self.lock_account()
        else:
            self.save(update_fields=["failed_login_attempts"])

    def reset_login_attempts(self):
        if self.failed_login_attempts > 0 or self.account_locked:
            self.failed_login_attempts = 0
            self.account_locked = False
            self.locked_at = None
            self.save(update_fields=["failed_login_attempts", "account_locked", "locked_at"])

    # ======================================================
    # PASSWORD MANAGEMENT
    # ======================================================
    def set_password(self, raw_password):
        from django.contrib.auth.hashers import check_password, make_password

        # If user exists in DB, check last 5 password hashes
        if self.pk:
            recent_passwords = PasswordHistory.objects.filter(user=self).order_by('-created_at')[:5]
            for old_pw in recent_passwords:
                try:
                    if check_password(raw_password, old_pw.password_hash):
                        raise ValidationError("Cannot reuse any of your last 5 passwords.")
                except Exception:
                    # ignore broken history rows rather than block password set
                    continue

        super().set_password(raw_password)

        # Store in password history only after user has a PK
        if self.pk:
            try:
                PasswordHistory.add_password(self, make_password(raw_password))
            except Exception:
                # don't fail password set if history fails
                pass

    def mark_password_changed(self):
        self.force_password_change = False
        self.save(update_fields=['force_password_change'])

    # ======================================================
    # EMAIL VERIFICATION
    # ======================================================
    def generate_verification_token(self):
        self.verification_token = str(uuid.uuid4())
        self.verification_token_created = timezone.now()
        # Save token fields without triggering deep validation
        self.save(update_fields=['verification_token', 'verification_token_created'])
        return self.verification_token

    def verify_email(self, token):
        # Validate token
        if not self.verification_token or self.verification_token != token:
            return False
        if not self.verification_token_created:
            return False
        if timezone.now() > self.verification_token_created + timedelta(hours=24):
            return False
        self.is_verified = True
        self.verification_token = None
        self.verification_token_created = None
        self.save(update_fields=['is_verified', 'verification_token', 'verification_token_created'])
        return True



# ===========================================================
# STRONG PASSWORD GENERATOR (Industry-Standard Rules)
# ===========================================================

import string
import random
import re

DICTIONARY_WORDS = [
    "password", "welcome", "qwerty", "admin", "user",
    "test", "employee", "manager", "login"
]


def generate_strong_password(length=12, user_info=None):
    """
    Generate a strong password that meets:
    - At least 12 characters
    - 1 uppercase, 1 lowercase, 1 digit, 1 special char
    - No dictionary words
    - No repeating sequences (AAA, abcabc, 123123)
    - No user-related details like name, username, emp_id
    """
    if user_info is None:
        user_info = []

    upper = string.ascii_uppercase
    lower = string.ascii_lowercase
    digits = string.digits
    special = "!@#$%^&*()_-+=<>?/{}[]|"

    while True:
        # Base structure ensures minimum requirements
        password = [
            random.choice(upper),
            random.choice(lower),
            random.choice(digits),
            random.choice(special),
        ]

        # Fill remaining characters randomly
        all_chars = upper + lower + digits + special
        password += random.choices(all_chars, k=length - 4)
        random.shuffle(password)
        password = "".join(password)

        # -----------------------------
        # RULE 1: No dictionary words
        # -----------------------------
        if any(word in password.lower() for word in DICTIONARY_WORDS):
            continue

        # ----------------------------------------
        # RULE 2: No user personal info inside pwd
        # ----------------------------------------
        if any(str(info).lower() in password.lower() for info in user_info if info):
            continue

        # -------------------------------
        # RULE 3: No repeating sequences
        # -------------------------------
        if re.search(r"(.)\1\1", password):  # AAA, !!!, 111
            continue

        if re.search(r"(.{2,})\1", password):  # abcabc, 123123
            continue

        return password
'''

# ==============================================================================
# FILE: users/models.py
# ==============================================================================

from __future__ import annotations

import logging
import uuid
from datetime import timedelta
from typing import TYPE_CHECKING, List, Optional

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models, transaction
from django.db.models import Max, Q
from django.utils import timezone
from django.utils.crypto import get_random_string
from django.utils.translation import gettext_lazy as _

from masters.models import Master, MasterStatus, MasterType

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser


logger = logging.getLogger(__name__)


# ==============================================================================
# PASSWORD HISTORY
# ==============================================================================

class PasswordHistory(models.Model):
    """
    Track last N passwords to prevent reuse.
    """
    
    MAX_HISTORY = 5  # Configurable
    
    user = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='password_history'
    )
    password_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = _('Password History')
        verbose_name_plural = _('Password Histories')
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} - {self.created_at:%Y-%m-%d}"

    @classmethod
    def add_password(cls, user: 'User', raw_password: str) -> None:
        """
        Store password hash, keep only the latest MAX_HISTORY entries.
        
        Raises:
            ValidationError: If password was recently used
        """
        if not user.pk:
            return
        
        new_hash = make_password(raw_password)
        
        # Check against recent passwords
        recent = cls.objects.filter(user=user).order_by('-created_at')[:cls.MAX_HISTORY]
        for old in recent:
            if check_password(raw_password, old.password_hash):
                raise ValidationError(_("Cannot reuse any of your last %(count)d passwords.") % {'count': cls.MAX_HISTORY})
        
        # Store new password
        cls.objects.create(user=user, password_hash=new_hash)
        
        # Cleanup old entries
        cls._cleanup_old(user)

    @classmethod
    def _cleanup_old(cls, user: 'User') -> None:
        """Remove entries beyond MAX_HISTORY."""
        old_ids = cls.objects.filter(
            user=user
        ).order_by('-created_at').values_list('id', flat=True)[cls.MAX_HISTORY:]
        
        if old_ids:
            cls.objects.filter(id__in=list(old_ids)).delete()


# ==============================================================================
# USER MANAGER
# ==============================================================================

class UserManager(BaseUserManager):
    """Custom user manager with secure user creation."""

    def _validate_emp_id(self, emp_id: Optional[str]) -> str:
        """Validate and return emp_id."""
        if not emp_id:
            raise ValidationError({"emp_id": _("Employee ID is required.")})
        
        emp_id = str(emp_id).strip().upper()
        if not emp_id.startswith('EMP'):
            raise ValidationError({"emp_id": _("Employee ID must start with EMP (e.g., EMP0001).")})
        
        if self.model.objects.filter(emp_id=emp_id).exists():
            raise ValidationError({"emp_id": _("Employee ID already exists.")})
        
        return emp_id

    def create_user(
        self,
        emp_id: str,
        email: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        **extra_fields
    ) -> 'User':
        """Create a regular user with secure defaults."""
        
        # Validate required fields
        emp_id = self._validate_emp_id(emp_id)
        username = username or emp_id
        
        if not email:
            raise ValidationError({"email": _("Email is required.")})
        
        email = self.normalize_email(email)
        
        # Generate secure password if not provided
        if not password:
            password = self._generate_temp_password()
            extra_fields['force_password_change'] = True
        
        extra_fields.setdefault("is_active", True)
        
        user = self.model(
            emp_id=emp_id,
            username=username,
            email=email,
            **extra_fields
        )
        user.set_password(password)
        user.save(using=self._db)
        
        logger.info(f"Created user {username} ({emp_id})")
        
        return user

    def create_superuser(
        self,
        emp_id: str,
        email: str,
        password: str,
        **extra_fields
    ) -> 'User':
        """Create and save a superuser."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("force_password_change", False)

        if not password:
            raise ValidationError({"password": _("Superuser must have a password.")})

        return self.create_user(emp_id=emp_id, email=email, password=password, **extra_fields)

    def _generate_temp_password(self) -> str:
        """Generate secure temporary password."""
        return get_random_string(
            length=12,
            allowed_chars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
        )

    def active(self) -> models.QuerySet:
        """Filter active users."""
        return self.filter(is_active=True, account_locked=False)

    def by_department(self, department: Master) -> models.QuerySet:
        """Filter by department."""
        return self.filter(department=department)


# ==============================================================================
# USER MODEL
# ==============================================================================

class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model with Master app integration.
    
    Departments, designations, and roles are linked to Master data.
    """

    # ---------- CORE ----------
    emp_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text=_("Employee ID (e.g., EMP0001)")
    )
    username = models.CharField(
        max_length=150,
        unique=True,
        db_index=True
    )
    email = models.EmailField(
        unique=True,
        db_index=True
    )
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)

    # ---------- MASTER DEPENDENCIES ----------
    department = models.ForeignKey(
        Master,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
        limit_choices_to={
            "master_type": MasterType.DEPARTMENT,
            "status": MasterStatus.ACTIVE
        },
        verbose_name=_("Department"),
        help_text=_("Department from Master data")
    )

    designation = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        db_index=True,
        verbose_name=_("Designation"),
        help_text=_("Employee designation (manual entry)")
    )

    role = models.ForeignKey(
        Master,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="role_users",
        limit_choices_to={
            "master_type": MasterType.ROLE,
            "status": MasterStatus.ACTIVE
        },
        verbose_name=_("Role"),
        help_text=_("Role from Master data")
    )

    # ---------- CONTACT ----------
    phone = models.CharField(
        max_length=15,
        blank=True,
        validators=[RegexValidator(
            r"^\+?\d{7,15}$",
            _("Enter a valid phone number.")
        )],
    )

    joining_date = models.DateField(default=timezone.now)

    # ---------- EMAIL VERIFICATION ----------
    is_email_verified = models.BooleanField(
        default=False,
        verbose_name=_("Email Verified")
    )
    verification_token = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )
    verification_token_created = models.DateTimeField(
        blank=True,
        null=True
    )

    # ---------- SECURITY ----------
    failed_login_attempts = models.PositiveIntegerField(default=0)
    account_locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(blank=True, null=True)
    temp_password = models.CharField(
        max_length=128,
        null=True,
        blank=True
    )
    force_password_change = models.BooleanField(
        default=False,
        help_text=_("User must change password on next login")
    )

    # ---------- DJANGO FLAGS ----------
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    # ---------- AUDIT ----------
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ---------- MANAGER ----------
    objects = UserManager()

    USERNAME_FIELD = "emp_id"
    REQUIRED_FIELDS = ["email", "username"]

    class Meta:
        verbose_name = _("User")
        verbose_name_plural = _("Users")
        ordering = ["emp_id"]
        indexes = [
            models.Index(fields=["username", "email"]),
            models.Index(fields=["department", "is_active"]),
            models.Index(fields=["designation", "is_active"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=Q(joining_date__lte=timezone.now().date()),
                name="joining_date_not_future"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.get_full_name()} ({self.emp_id})"

    def get_absolute_url(self) -> str:
        """Return admin change URL."""
        from django.urls import reverse
        return reverse('admin:users_user_change', args=[self.pk])

    def get_full_name(self) -> str:
        """Return full name or username."""
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.username

    def get_short_name(self) -> str:
        """Return first name or username."""
        return self.first_name or self.username

    def clean(self) -> None:
        """Model-level validation."""
        super().clean()
        
        # Validate department is active
        if self.department and self.department.status != MasterStatus.ACTIVE:
            raise ValidationError({
                "department": _("Selected department is not active.")
            })

    def save(self, *args, **kwargs) -> None:
        """Save with validation."""
        self.full_clean()
        super().save(*args, **kwargs)

    # ======================================================
    # ACCOUNT STATUS
    # ======================================================

    @property
    def is_account_active(self) -> bool:
        """Check if account is fully active (not locked, not deactivated)."""
        return self.is_active and not self.account_locked

    @property
    def account_status(self) -> str:
        """Return human-readable account status."""
        if self.account_locked:
            return _("Locked")
        return _("Active") if self.is_active else _("Inactive")

    # ======================================================
    # LOCKOUT MANAGEMENT
    # ======================================================

    MAX_FAILED_ATTEMPTS = 5
    LOCK_DURATION_HOURS = 2

    def lock_account(self) -> None:
        """Lock account due to failed attempts."""
        self.account_locked = True
        self.is_active = False
        self.locked_at = timezone.now()
        self.save(update_fields=["account_locked", "is_active", "locked_at"])
        logger.warning(f"Account locked for user {self.emp_id}")

    def unlock_account(self) -> None:
        """Unlock account."""
        was_locked = self.account_locked
        
        self.account_locked = False
        self.failed_login_attempts = 0
        self.locked_at = None
        
        # Only reactivate if not manually deactivated
        if not self.is_active and was_locked:
            self.is_active = True
            
        self.save(update_fields=[
            "account_locked", "is_active", "failed_login_attempts", "locked_at"
        ])
        
        if was_locked:
            logger.info(f"Account unlocked for user {self.emp_id}")

    def check_lock_status(self) -> bool:
        """Check if lock has expired and auto-unlock if needed."""
        if not self.account_locked:
            return False
            
        if self.locked_at and timezone.now() >= self.locked_at + timedelta(hours=self.LOCK_DURATION_HOURS):
            self.unlock_account()
            return True
            
        return False

    def increment_failed_login(self) -> None:
        """Record failed login attempt."""
        # Check for auto-unlock first
        if self.check_lock_status():
            return
            
        if self.account_locked:
            return
            
        self.failed_login_attempts += 1
        
        if self.failed_login_attempts >= self.MAX_FAILED_ATTEMPTS:
            self.lock_account()
        else:
            self.save(update_fields=["failed_login_attempts"])

    def reset_login_attempts(self) -> None:
        """Reset after successful login."""
        if self.failed_login_attempts > 0 or self.account_locked:
            self.unlock_account()

    # ======================================================
    # PASSWORD MANAGEMENT
    # ======================================================

    def set_password(self, raw_password: str) -> None:
        """
        Set password with history check.
        
        Raises:
            ValidationError: If password was recently used
        """
        # Check against history (raises ValidationError if reused)
        PasswordHistory.add_password(self, raw_password)
        
        # Set password using parent
        super().set_password(raw_password)

    def mark_password_changed(self) -> None:
        """Clear force_password_change flag."""
        if self.force_password_change:
            self.force_password_change = False
            self.save(update_fields=['force_password_change'])

    # ======================================================
    # EMAIL VERIFICATION
    # ======================================================

    TOKEN_EXPIRY_HOURS = 24

    def generate_verification_token(self) -> str:
        """Generate and store email verification token."""
        self.verification_token = str(uuid.uuid4())
        self.verification_token_created = timezone.now()
        self.save(update_fields=['verification_token', 'verification_token_created'])
        return self.verification_token

    def verify_email(self, token: str) -> bool:
        """
        Verify email with token.
        
        Returns:
            bool: True if verified successfully
        """
        if not self.verification_token or self.verification_token != token:
            return False
            
        if not self.verification_token_created:
            return False
            
        expiry = self.verification_token_created + timedelta(hours=self.TOKEN_EXPIRY_HOURS)
        if timezone.now() > expiry:
            return False
            
        self.is_email_verified = True
        self.verification_token = None
        self.verification_token_created = None
        self.save(update_fields=[
            'is_email_verified', 'verification_token', 'verification_token_created'
        ])
        
        return True

    # ======================================================
    # MASTER DATA HELPERS
    # ======================================================

    def get_department_name(self) -> Optional[str]:
        """Get department name from Master."""
        return self.department.name if self.department else None

    def get_designation_name(self) -> Optional[str]:
        """Get designation name from Master."""
        return self.designation.name if self.designation else None

    def get_role_name(self) -> Optional[str]:
        """Get role name from Master."""
        return self.role.name if self.role else None
    





# ==============================================================================
# STRONG PASSWORD GENERATOR
# ==============================================================================

import string
import random
import re


def generate_strong_password(length: int = 12, user_info=None) -> str:
    """
    Generate strong password:
    - Uppercase
    - Lowercase
    - Digit
    - Special char
    - No triple repeating chars
    """

    if user_info is None:
        user_info = []

    upper = string.ascii_uppercase
    lower = string.ascii_lowercase
    digits = string.digits
    special = "!@#$%^&*()_-+=<>?/{}[]|"

    while True:
        password = [
            random.choice(upper),
            random.choice(lower),
            random.choice(digits),
            random.choice(special),
        ]

        all_chars = upper + lower + digits + special
        password += random.choices(all_chars, k=length - 4)
        random.shuffle(password)

        password = "".join(password)

        if re.search(r"(.)\1\1", password):
            continue

        return password
