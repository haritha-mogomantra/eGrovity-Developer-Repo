# ==============================================================================
# FILE: masters/utils.py
# ==============================================================================

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Union

from django.db import DatabaseError, transaction
from django.http import HttpRequest

from .models import AuditAction, Master, MasterAuditLog, MasterStatus, MasterType

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser


logger = logging.getLogger(__name__)


# ==============================================================================
# IP & REQUEST UTILITIES
# ==============================================================================

def get_client_ip(request: Optional[HttpRequest]) -> Optional[str]:
    """
    Extract client IP address from request.
    
    Checks multiple headers to handle proxies and load balancers:
    - HTTP_X_FORWARDED_FOR (standard proxy header)
    - HTTP_X_REAL_IP (Nginx proxy)
    - REMOTE_ADDR (direct connection)
    
    Args:
        request: Django HTTP request object
        
    Returns:
        Client IP address or None if request is None
    """
    if request is None:
        return None
    
    # Check for forwarded IP (proxy/load balancer)
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2, ...
        # The first IP is the actual client
        ip = x_forwarded_for.split(',')[0].strip()
        if ip:
            return ip
    
    # Check alternative proxy header
    x_real_ip = request.META.get('HTTP_X_REAL_IP')
    if x_real_ip:
        return x_real_ip.strip()
    
    # Direct connection
    ip = request.META.get('REMOTE_ADDR')
    if ip:
        return ip
    
    return None


def get_user_agent(request: Optional[HttpRequest], max_length: int = 255) -> str:
    """
    Extract user agent string from request.
    
    Args:
        request: Django HTTP request object
        max_length: Maximum length to return (truncate if longer)
        
    Returns:
        User agent string or empty string
    """
    if request is None:
        return ''
    
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    return user_agent[:max_length] if user_agent else ''


# ==============================================================================
# AUDIT LOGGING
# ==============================================================================

def validate_audit_action(action: Union[str, AuditAction]) -> str:
    """
    Validate and normalize audit action.
    
    Args:
        action: Action string or AuditAction enum
        
    Returns:
        Validated action string
        
    Raises:
        ValueError: If action is not valid
    """
    if isinstance(action, AuditAction):
        return action.value
    
    action = str(action).upper()
    valid_actions = [a.value for a in AuditAction]
    
    if action not in valid_actions:
        raise ValueError(
            f"Invalid audit action '{action}'. "
            f"Must be one of: {', '.join(valid_actions)}"
        )
    
    return action


def serialize_for_audit(instance: Master) -> Dict[str, Any]:
    """
    Serialize a Master instance for audit logging.
    
    Captures relevant fields without sensitive/internal data.
    
    Args:
        instance: Master model instance
        
    Returns:
        Dictionary of serialized data
    """
    if instance is None:
        return None
    
    data = {
        'id': instance.id,
        'master_type': instance.master_type,
        'name': instance.name,
        'code': instance.code,
        'status': instance.status,
        'parent_id': instance.parent_id,
        'display_order': instance.display_order,
        'is_system': instance.is_system,
        'metadata': instance.metadata,
    }
    
    # Include extension data if available
    try:
        if hasattr(instance, 'department_details'):
            dept = instance.department_details
            data['department'] = {
                'is_default': dept.is_default,
                'deactivated_at': dept.deactivated_at.isoformat() if dept.deactivated_at else None,
            }
    except Exception:
        pass
    
    try:
        if hasattr(instance, 'project_details'):
            proj = instance.project_details
            data['project'] = {
                'department_id': proj.department_id,
            }
    except Exception:
        pass
    
    return data


@transaction.atomic
def log_master_change(
    master: Master,
    action: Union[str, AuditAction],
    user: Optional[AbstractUser],
    request: Optional[HttpRequest],
    old_data: Optional[Dict[str, Any]] = None,
    new_data: Optional[Dict[str, Any]] = None,
    timestamp: Optional[Any] = None,
) -> Optional[MasterAuditLog]:
    """
    Create an audit log entry for master changes.
    
    Thread-safe audit logging with error handling. If database write fails,
    logs error but doesn't raise exception (audit should not break business logic).
    
    Args:
        master: The Master instance that was changed
        action: Type of action (CREATE, UPDATE, DELETE, STATUS_CHANGE)
        user: User who performed the action
        request: HTTP request (for IP/user agent extraction)
        old_data: Previous state (optional)
        new_data: New state (optional)
        timestamp: Override timestamp (optional, for testing)
        
    Returns:
        Created MasterAuditLog instance or None if creation failed
    """
    try:
        # Validate action
        validated_action = validate_audit_action(action)
        
        # Prepare data
        ip_address = get_client_ip(request)
        user_agent = get_user_agent(request)
        
        # Create audit log
        audit_log = MasterAuditLog.objects.create(
            master=master,
            action=validated_action,
            old_data=old_data,
            new_data=new_data,
            changed_by=user,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        
        # Override timestamp if provided (for testing/backdating)
        if timestamp:
            MasterAuditLog.objects.filter(pk=audit_log.pk).update(changed_at=timestamp)
            audit_log.refresh_from_db()
        
        logger.debug(
            f"Audit log created: {validated_action} on Master {master.id} "
            f"by {user.username if user else 'system'}"
        )
        
        return audit_log
        
    except DatabaseError as e:
        logger.error(f"Database error creating audit log: {e}")
        return None
    except ValueError as e:
        logger.error(f"Validation error creating audit log: {e}")
        return None
    except Exception as e:
        logger.exception(f"Unexpected error creating audit log: {e}")
        return None


def log_master_bulk_action(
    masters: List[Master],
    action: Union[str, AuditAction],
    user: Optional[AbstractUser],
    request: Optional[HttpRequest],
    summary: Optional[Dict[str, Any]] = None,
) -> int:
    """
    Create a single audit log entry for bulk operations.
    
    More efficient than individual logs for bulk create/update/delete.
    
    Args:
        masters: List of affected Master instances
        action: Bulk action type
        user: User who performed the action
        request: HTTP request
        summary: Optional summary data (count, errors, etc.)
        
    Returns:
        Number of audit logs created (1 for bulk summary)
    """
    if not masters:
        return 0
    
    try:
        validated_action = f"BULK_{validate_audit_action(action)}"
        
        # Create single summary log
        audit_log = MasterAuditLog.objects.create(
            master=masters[0],
            action=validated_action,
            old_data=None,
            new_data={
                'affected_ids': [m.id for m in masters],
                'affected_count': len(masters),
                'summary': summary or {},
            },
            changed_by=user,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
        
        logger.info(
            f"Bulk audit log created: {validated_action} on {len(masters)} masters "
            f"by {user.username if user else 'system'}"
        )
        
        return 1
        
    except Exception as e:
        logger.exception(f"Error creating bulk audit log: {e}")
        return 0


# ==============================================================================
# CACHE UTILITIES
# ==============================================================================

def invalidate_master_cache(master_type: str, status: Optional[str] = None) -> None:
    """
    Invalidate dropdown cache for a master type.
    
    Args:
        master_type: Type of master (ROLE, DEPARTMENT, etc.)
        status: Specific status to invalidate, or all if None
    """
    from django.core.cache import cache
    
    if status:
        cache_key = f'masters_dropdown_{master_type}_{status}'
        cache.delete(cache_key)
    else:
        # Invalidate all status variants
        for s in MasterStatus:
            cache_key = f'masters_dropdown_{master_type}_{s.value}'
            cache.delete(cache_key)
    
    # Special case: projects depend on departments
    if master_type == MasterType.DEPARTMENT.value:
        cache.delete(f"masters_dropdown_{MasterType.PROJECT.value}_{MasterStatus.ACTIVE.value}")


# ==============================================================================
# QUERY UTILITIES
# ==============================================================================

def get_master_hierarchy(root: Master, include_inactive: bool = False) -> Dict[str, Any]:
    """
    Get full hierarchy tree for a master (with children, grandchildren, etc.).
    
    Args:
        root: Root master to start from
        include_inactive: Whether to include inactive children
        
    Returns:
        Nested dictionary representing hierarchy
    """
    def build_tree(parent: Master) -> Dict[str, Any]:
        children = parent.children.all() if include_inactive else parent.children.filter(status=MasterStatus.ACTIVE)
        
        return {
            'id': parent.id,
            'name': parent.name,
            'code': parent.code,
            'status': parent.status,
            'children': [build_tree(child) for child in children],
        }
    
    return build_tree(root)


# ==============================================================================
# DEPRECATED ALIASES (for backward compatibility)
# ==============================================================================

def create_audit_log(*args, **kwargs):
    """Deprecated: Use log_master_change instead."""
    return log_master_change(*args, **kwargs)