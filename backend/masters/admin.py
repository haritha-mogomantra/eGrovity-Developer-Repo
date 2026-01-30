# ==============================================================================
# FILE: masters/admin.py
# ==============================================================================

from django.contrib import admin
from django.utils.html import format_html
from .models import Master, MasterAuditLog

@admin.register(Master)
class MasterAdmin(admin.ModelAdmin):
    """Admin interface for Master model"""
    actions = None
    
    list_display = [
        'id', 'master_type', 'name', 'code', 'status_badge', 
        'display_order', 'system_badge', 'created_at', 'created_by'
    ]
    list_filter = ['master_type', 'status', 'is_system', 'created_at']
    search_fields = ['name', 'description', 'code']
    ordering = ['master_type', 'display_order', 'name']

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ['master_type', 'created_by', 'created_at', 'updated_by', 'updated_at']
        return ['created_by', 'created_at', 'updated_by', 'updated_at']
    
    def get_fields(self, request, obj=None):
        fields = list(super().get_fields(request, obj))
        if not request.user.is_superuser and 'is_system' in fields:
            fields.remove('is_system')
        return fields

    
    fieldsets = (
        ('Basic Information', {
            'fields': ('master_type', 'name', 'code', 'description', 'status')
        }),
        ('Hierarchy', {
            'fields': ('parent', 'display_order'),
            'classes': ('collapse',)
        }),
        ('Additional Settings', {
            'fields': ('metadata', 'is_system'),
            'classes': ('collapse',)
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def status_badge(self, obj):
        """Display status with color badge"""
        colors = {
            'Active': 'green',
            'Inactive': 'red'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px; font-weight: bold;">{}</span>',
            colors.get(obj.status, 'gray'),
            obj.status
        )
    status_badge.short_description = 'Status'
    
    def system_badge(self, obj):
        """Display system badge"""
        if obj.is_system:
            return format_html(
                '<span style="background-color: orange; color: white; padding: 3px 10px; '
                'border-radius: 3px; font-weight: bold;">SYSTEM</span>'
            )
        return '-'
    system_badge.short_description = 'System'
    
    def save_model(self, request, obj, form, change):
        """Set user on save"""
        if not change:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
    
    def has_delete_permission(self, request, obj=None):
        """Prevent deletion of system masters"""
        if obj and obj.is_system:
            return False
        return super().has_delete_permission(request, obj)
    
    def has_change_permission(self, request, obj=None):
        if obj and obj.is_system:
            return False
        return super().has_change_permission(request, obj)


@admin.register(MasterAuditLog)
class MasterAuditLogAdmin(admin.ModelAdmin):
    """Admin interface for MasterAuditLog model"""
    
    list_display = [
        'id', 'master', 'action', 'changed_by', 'changed_at', 'ip_address'
    ]
    list_filter = ['action', 'changed_at']
    search_fields = ['master__name', 'changed_by__username']
    readonly_fields = [
        'master', 'action', 'old_data', 'new_data', 
        'changed_by', 'changed_at', 'ip_address', 'user_agent'
    ]
    ordering = ['-changed_at']
    
    def has_add_permission(self, request):
        """Prevent manual creation of audit logs"""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Prevent deletion of audit logs"""
        return False