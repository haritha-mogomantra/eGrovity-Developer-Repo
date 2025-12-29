# ==============================================================================
# FILE: masters/permissions.py
# ==============================================================================

from rest_framework import permissions

class IsMasterAdmin(permissions.BasePermission):
    """
    Permission class to check if user is an admin
    Only admins can create, update, or delete masters
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser or request.user.is_staff:
            return True
        
        return request.user.groups.filter(name='Master Admin').exists()
    
    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class IsMasterAdminOrReadOnly(permissions.BasePermission):
    """
    Permission class to allow read access to everyone
    but write access only to admins
    """
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        
        if not request.user or not request.user.is_authenticated:
            return False
        
        return (
            request.user.is_superuser or 
            request.user.is_staff or
            request.user.groups.filter(name='Master Admin').exists()
        )
    
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        
        return (
            request.user.is_superuser or 
            request.user.is_staff or
            request.user.groups.filter(name='Master Admin').exists()
        )
