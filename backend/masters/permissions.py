# ==============================================================================
# FILE: masters/permissions.py
# ==============================================================================

from __future__ import annotations

from typing import Any

from django.conf import settings
from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.views import View

from .models import Master


# ==============================================================================
# CONFIGURATION
# ==============================================================================

# Configurable group name (can be overridden in settings)
MASTER_ADMIN_GROUP = getattr(settings, 'MASTER_ADMIN_GROUP', 'Master Admin')


# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

def is_master_admin(user) -> bool:
    """
    Check if user has master admin privileges.
    
    Superusers, staff users, or members of the Master Admin group
    are considered master admins.
    """
    if not user or not user.is_authenticated:
        return False
    
    if user.is_superuser or user.is_staff:
        return True
    
    # Cache group check on user object to avoid repeated queries
    cache_attr = '_is_master_admin'
    if hasattr(user, cache_attr):
        return getattr(user, cache_attr)
    
    is_admin = user.groups.filter(name=MASTER_ADMIN_GROUP).exists()
    try:
        setattr(user, cache_attr, is_admin)
    except Exception:
        pass
    return is_admin


# ==============================================================================
# PERMISSION CLASSES
# ==============================================================================

class IsMasterAdmin(permissions.BasePermission):
    """
    Full admin access for master data management.
    
    Grants permission to:
    - Create, update, delete masters
    - Change status and deactivate departments
    - Bulk operations
    
    Allowed for:
    - Superusers
    - Staff users  
    - Members of 'Master Admin' group (configurable via MASTER_ADMIN_GROUP setting)
    """
    
    def has_permission(self, request: Request, view: View) -> bool:
        return is_master_admin(request.user)
    
    def has_object_permission(
        self, 
        request: Request, 
        view: View, 
        obj: Any
    ) -> bool:
        """
        Object-level permission check.
        
        Additional checks:
        - System masters can only be modified by superusers
        - Inactive masters can only be reactivated by admins
        """
        if not is_master_admin(request.user):
            return False
        
        # System masters require superuser for modifications
        if isinstance(obj, Master) and obj.is_system:
            return request.user.is_superuser
        
        return True


class IsMasterAdminOrReadOnly(permissions.BasePermission):
    """
    Read access for authenticated users, write access for admins only.
    
    Read methods (GET, HEAD, OPTIONS): Any authenticated user
    Write methods (POST, PUT, PATCH, DELETE): Master admins only
    """
    
    def has_permission(self, request: Request, view: View) -> bool:
        # Allow read-only methods for any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        
        # Write methods require admin privileges
        return is_master_admin(request.user)
    
    def has_object_permission(
        self, 
        request: Request, 
        view: View, 
        obj: Any
    ) -> bool:
        # Read-only access check
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        
        # Write access requires admin check
        if not is_master_admin(request.user):
            return False
        
        # System masters require superuser
        if isinstance(obj, Master) and obj.is_system:
            return request.user.is_superuser
        
        return True


class IsSuperUserOrReadOnly(permissions.BasePermission):
    """
    Read access for all authenticated users, full access for superusers only.
    
    Use case: System-critical masters that should only be modified
    by superusers, not regular staff or Master Admin group members.
    """
    
    def has_permission(self, request: Request, view: View) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_superuser)
    
    def has_object_permission(
        self, 
        request: Request, 
        view: View, 
        obj: Any
    ) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_superuser)


class CanCreateMasterType(permissions.BasePermission):
    """
    Permission to restrict creation of specific master types.
    
    Example usage:
    - Only superusers can create DEPARTMENT masters
    - Only admins can create PROJECT masters
    - Anyone can create METRIC masters
    
    Configure via settings.MASTER_TYPE_PERMISSIONS
    """
    
    def has_permission(self, request: Request, view: View) -> bool:
        if request.method != 'POST':
            return True  # Only restrict creation
        
        # Get master_type from request data
        master_type = request.data.get('master_type')
        if not master_type:
            return True  # Let serializer validate required field
        
        # Check configured permissions
        type_permissions = getattr(settings, 'MASTER_TYPE_PERMISSIONS', {})
        required_role = type_permissions.get(master_type, 'admin')  # default: admin
        
        if required_role == 'superuser':
            return bool(request.user and request.user.is_superuser)
        elif required_role == 'staff':
            return bool(request.user and (request.user.is_superuser or request.user.is_staff))
        else:  # 'admin' or default
            return is_master_admin(request.user)


# ==============================================================================
# DEPRECATED ALIASES (for backward compatibility)
# ==============================================================================

# Keep old names for existing code, but mark for deprecation
MasterAdminPermission = IsMasterAdmin  # TODO: Remove in v2.0
MasterAdminOrReadOnlyPermission = IsMasterAdminOrReadOnly  # TODO: Remove in v2.0