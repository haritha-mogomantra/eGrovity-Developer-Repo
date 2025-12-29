# ==============================================================================
# FILE: masters/signals.py
# ==============================================================================

from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.core.exceptions import ValidationError
from .models import Master

@receiver(pre_delete, sender=Master)
def prevent_system_master_deletion(sender, instance, **kwargs):
    """Prevent deletion of system masters"""
    if instance.is_system:
        raise ValidationError("System masters cannot be deleted")