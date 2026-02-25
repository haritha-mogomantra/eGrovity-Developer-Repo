# ==============================================================================
# FILE: masters/admin.py
# ==============================================================================

from django.contrib import admin
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from django.urls import reverse
from django.utils.safestring import mark_safe

from .models import (
    DepartmentDetails,
    Master,
    MasterAuditLog,
    MasterStatus,
    MasterType,
    ProjectDetails,
)


# ==============================================================================
# INLINES FOR EXTENSION MODELS
# ==============================================================================

class DepartmentDetailsInline(admin.StackedInline):
    """Inline editor for department-specific details."""
    
    model = DepartmentDetails
    can_delete = False
    verbose_name = _('Department Details')
    verbose_name_plural = _('Department Details')
    fields = [
        'is_default',
        'deactivated_at',
        'deactivated_by',
        'deactivation_reason',
    ]
    readonly_fields = ['deactivated_at', 'deactivated_by']
    
    def get_queryset(self, request):
        """Only show for department masters."""
        qs = super().get_queryset(request)
        return qs.select_related('master')


class ProjectDetailsInline(admin.StackedInline):
    """Inline editor for project-specific details."""
    
    model = ProjectDetails
    can_delete = False
    verbose_name = _('Project Details')
    verbose_name_plural = _('Project Details')
    fields = ['department']
    autocomplete_fields = ['department']
    raw_id_fields = ['department']
    
    def get_queryset(self, request):
        """Only show for project masters."""
        qs = super().get_queryset(request)
        return qs.select_related('master', 'department')


# ==============================================================================
# MASTER ADMIN
# ==============================================================================

@admin.register(Master)
class MasterAdmin(admin.ModelAdmin):
    """Admin interface for Master model with extension support."""
    
    # List view configuration
    list_display = [
        'id',
        'master_type',
        'name',
        'code',
        'status_badge',
        'display_order',
        'system_badge',
        'parent_link',
        'has_details_badge',
        'created_at',
        'created_by',
    ]
    list_filter = [
        'master_type',
        'status',
        'is_system',
        ('parent', admin.RelatedOnlyFieldListFilter),
        'created_at',
    ]
    list_select_related = ['created_by', 'parent']
    search_fields = ['name', 'description', 'code']
    ordering = ['master_type', 'display_order', 'name']
    date_hierarchy = 'created_at'
    list_per_page = 50
    
    # Form configuration
    autocomplete_fields = ['parent']
    readonly_fields = [
        'created_by',
        'created_at',
        'updated_by',
        'updated_at',
        'audit_logs_link',
    ]
    
    fieldsets = (
        (_('Basic Information'), {
            'fields': (
                'master_type',
                'name',
                'code',
                'description',
                'status',
            )
        }),
        (_('Hierarchy & Ordering'), {
            'fields': ('parent', 'display_order'),
            'classes': ('collapse',),
            'description': _('Configure parent-child relationships and display order.')
        }),
        (_('Advanced Settings'), {
            'fields': ('metadata', 'is_system'),
            'classes': ('collapse',),
            'description': _('System flag protects from deletion. Metadata stores flexible JSON.')
        }),
        (_('Audit Trail'), {
            'fields': (
                'created_by',
                'created_at',
                'updated_by',
                'updated_at',
                'audit_logs_link',
            ),
            'classes': ('collapse',),
        }),
    )
    
    # Dynamic inlines based on master type
    def get_inlines(self, request, obj=None):
        """Return appropriate inlines based on master type."""
        if obj is None:
            return []
        
        if obj.master_type == MasterType.DEPARTMENT:
            return [DepartmentDetailsInline]
        elif obj.master_type == MasterType.PROJECT:
            return [ProjectDetailsInline]
        return []
    
    def get_readonly_fields(self, request, obj=None):
        """Dynamic readonly fields based on permissions and state."""
        readonly = [
            'created_by',
            'created_at',
            'updated_by',
            'updated_at',
            'audit_logs_link',
        ]
        
        # Prevent changing master_type after creation
        if obj:
            readonly.append('master_type')
            
            # Prevent editing system masters (except superusers)
            if obj.is_system and not request.user.is_superuser:
                readonly = [f.name for f in self.model._meta.concrete_fields]
        
        return readonly
    
    def get_fields(self, request, obj=None):
        """Filter fields based on permissions."""
        fields = list(super().get_fields(request, obj))
        
        # Only superusers can see is_system
        if not request.user.is_superuser and 'is_system' in fields:
            fields.remove('is_system')
        
        return fields
    
    # Custom display methods
    def status_badge(self, obj: Master) -> str:
        """Display status with color badge."""
        colors = {
            MasterStatus.ACTIVE.value: '#28a745',    # Green
            MasterStatus.INACTIVE.value: '#dc3545',  # Red
        }
        color = colors.get(obj.status, '#6c757d')  # Gray default
        
        return format_html(
            '<span style="background-color: {}; color: white; padding: 4px 8px; '
            'border-radius: 4px; font-size: 12px; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = _('Status')
    status_badge.admin_order_field = 'status'
    
    def system_badge(self, obj: Master) -> str:
        """Display system badge."""
        if obj.is_system:
            return format_html(
                '<span style="background-color: #fd7e14; color: white; padding: 4px 8px; '
                'border-radius: 4px; font-size: 11px; font-weight: bold;">{}</span>',
                _('SYSTEM')
            )
        return format_html(
            '<span style="color: #6c757d; font-size: 11px;">-</span>'
        )
    system_badge.short_description = _('System')
    system_badge.admin_order_field = 'is_system'
    
    def parent_link(self, obj: Master) -> str:
        """Display parent as clickable link."""
        if obj.parent:
            url = reverse('admin:masters_master_change', args=[obj.parent.id])
            return format_html(
                '<a href="{}">{}</a>',
                url,
                obj.parent.name
            )
        return format_html(
            '<span style="color: #6c757d; font-style: italic;">{}</span>',
            _('None')
        )
    parent_link.short_description = _('Parent')
    parent_link.admin_order_field = 'parent__name'
    
    def has_details_badge(self, obj: Master) -> str:
        """Show if master has extension details."""
        if obj.master_type == MasterType.DEPARTMENT:
            has_details = hasattr(obj, 'department_details')
        elif obj.master_type == MasterType.PROJECT:
            has_details = hasattr(obj, 'project_details')
        else:
            has_details = False
        
        if has_details:
            return format_html(
                '<span style="color: #28a745;">✓</span>'
            )
        return format_html(
            '<span style="color: #dc3545;">✗</span>'
        )
    has_details_badge.short_description = _('Details')
    
    def audit_logs_link(self, obj: Master) -> str:
        """Link to view audit logs for this master."""
        count = obj.audit_logs.count()
        url = reverse('admin:masters_masterauditlog_changelist')
        return format_html(
            '<a href="{}?master__id__exact={}">{} {}</a>',
            url,
            obj.id,
            count,
            _('audit log entries')
        )
    audit_logs_link.short_description = _('Audit History')
    
    # Save and permission methods
    def save_model(self, request, obj, form, change):
        """Set audit fields on save."""
        if not change:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
    
    def save_formset(self, request, form, formset, change):
        """Handle inline formset saves with audit."""
        instances = formset.save(commit=False)
        for instance in instances:
            if hasattr(instance, 'master'):
                # Extension models don't have their own audit, but we log via Master
                pass
            instance.save()
        formset.save_m2m()
    
    def has_delete_permission(self, request, obj=None):
        """Prevent deletion of system masters."""
        if obj and obj.is_system:
            return False
        return super().has_delete_permission(request, obj)
    
    def has_change_permission(self, request, obj=None):
        """Restrict editing of system masters (superusers exempt)."""
        if obj and obj.is_system and not request.user.is_superuser:
            return False
        return super().has_change_permission(request, obj)
    
    def get_queryset(self, request):
        """Optimize queryset with extensions."""
        qs = super().get_queryset(request)
        return qs.select_related(
            'created_by', 'updated_by', 'parent'
        ).prefetch_related(
            'department_details',
            'project_details',
        )
    
    class Media:
        """Custom CSS/JS for admin."""
        css = {
            'all': ('admin/css/masters_admin.css',),
        }


# ==============================================================================
# EXTENSION MODEL ADMINS (Standalone)
# ==============================================================================

@admin.register(DepartmentDetails)
class DepartmentDetailsAdmin(admin.ModelAdmin):
    """Standalone admin for department details (read-only)."""
    
    list_display = [
        'master',
        'is_default',
        'deactivated_at',
        'deactivated_by',
    ]
    list_filter = ['is_default', 'deactivated_at']
    search_fields = ['master__name', 'deactivation_reason']
    readonly_fields = [
        'master',
        'deactivated_at',
        'deactivated_by',
    ]
    
    def has_add_permission(self, request):
        """Prevent manual creation - use Master admin."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Prevent deletion - cascade from Master."""
        return False


@admin.register(ProjectDetails)
class ProjectDetailsAdmin(admin.ModelAdmin):
    """Standalone admin for project details (read-only)."""
    
    list_display = [
        'master',
        'department',
    ]
    list_filter = ['department']
    search_fields = ['master__name', 'department__name']
    autocomplete_fields = ['department']
    readonly_fields = ['master']
    
    def has_add_permission(self, request):
        """Prevent manual creation - use Master admin."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Prevent deletion - cascade from Master."""
        return False


# ==============================================================================
# AUDIT LOG ADMIN
# ==============================================================================

@admin.register(MasterAuditLog)
class MasterAuditLogAdmin(admin.ModelAdmin):
    """Admin interface for MasterAuditLog model (read-only)."""
    
    list_display = [
        'id',
        'master_link',
        'action_badge',
        'changed_by',
        'changed_at',
        'ip_address',
    ]
    list_filter = [
        'action',
        'changed_at',
        ('master__master_type', admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = [
        'master__name',
        'changed_by__username',
        'changed_by__email',
        'ip_address',
    ]
    readonly_fields = [
        'master',
        'action',
        'action_display',
        'old_data_formatted',
        'new_data_formatted',
        'changed_by',
        'changed_at',
        'ip_address',
        'user_agent',
    ]
    ordering = ['-changed_at']
    date_hierarchy = 'changed_at'
    list_per_page = 100
    
    fieldsets = (
        (_('Change Information'), {
            'fields': (
                'master',
                'action',
                'action_display',
                'changed_by',
                'changed_at',
            )
        }),
        (_('Data Changes'), {
            'fields': ('old_data_formatted', 'new_data_formatted'),
            'classes': ('wide',),
        }),
        (_('Client Information'), {
            'fields': ('ip_address', 'user_agent'),
            'classes': ('collapse',),
        }),
    )
    
    def master_link(self, obj: MasterAuditLog) -> str:
        """Display master as clickable link."""
        url = reverse('admin:masters_master_change', args=[obj.master.id])
        return format_html(
            '<a href="{}">{} ({})</a>',
            url,
            obj.master.name,
            obj.master.get_master_type_display()
        )
    master_link.short_description = _('Master')
    master_link.admin_order_field = 'master__name'
    
    def action_badge(self, obj: MasterAuditLog) -> str:
        """Display action with color badge."""
        colors = {
            'CREATE': '#28a745',
            'UPDATE': '#007bff',
            'DELETE': '#dc3545',
            'STATUS_CHANGE': '#ffc107',
        }
        color = colors.get(obj.action, '#6c757d')
        
        return format_html(
            '<span style="background-color: {}; color: white; padding: 4px 8px; '
            'border-radius: 4px; font-size: 11px; font-weight: bold;">{}</span>',
            color,
            obj.get_action_display()
        )
    action_badge.short_description = _('Action')
    action_badge.admin_order_field = 'action'
    
    def action_display(self, obj: MasterAuditLog) -> str:
        """Human-readable action."""
        return obj.get_action_display()
    action_display.short_description = _('Action Type')
    
    def old_data_formatted(self, obj: MasterAuditLog) -> str:
        """Format old data as readable JSON."""
        if not obj.old_data:
            return format_html(
                '<span style="color: #6c757d; font-style: italic;">{}</span>',
                _('No previous data')
            )
        return self._format_json(obj.old_data)
    old_data_formatted.short_description = _('Previous Data')
    
    def new_data_formatted(self, obj: MasterAuditLog) -> str:
        """Format new data as readable JSON."""
        if not obj.new_data:
            return format_html(
                '<span style="color: #6c757d; font-style: italic;">{}</span>',
                _('No new data')
            )
        return self._format_json(obj.new_data)
    new_data_formatted.short_description = _('New Data')
    
    def _format_json(self, data: dict) -> str:
        """Format dictionary as HTML table."""
        import json
        from django.utils.html import escape
        
        if not isinstance(data, dict):
            return format_html('<pre>{}</pre>', escape(str(data)))
        
        rows = []
        for key, value in data.items():
            rows.append(format_html(
                '<tr><td style="font-weight: bold; padding: 4px 8px; '
                'background-color: #f8f9fa;">{}</td>'
                '<td style="padding: 4px 8px;"><pre>{}</pre></td></tr>',
                escape(str(key)),
                escape(json.dumps(value, indent=2, ensure_ascii=False))
            ))
        
        return format_html(
            '<table style="width: 100%; border-collapse: collapse;">{}</table>',
            mark_safe(''.join(rows))
        )
    
    def has_add_permission(self, request):
        """Prevent manual creation of audit logs."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Prevent editing of audit logs."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Prevent deletion of audit logs (immutable history)."""
        return False
    
    def get_queryset(self, request):
        """Optimize queryset."""
        return super().get_queryset(request).select_related(
            'master', 'changed_by'
        )