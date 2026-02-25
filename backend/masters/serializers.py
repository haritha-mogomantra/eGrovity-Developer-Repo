# ==============================================================================
# FILE: masters/serializers.py
# ==============================================================================

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone  # ADDED THIS IMPORT
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import (
    AuditAction,
    DepartmentDetails,
    Master,
    MasterAuditLog,
    MasterStatus,
    MasterType,
    ProjectDetails,
)

User = get_user_model()


# ==============================================================================
# UTILITY SERIALIZERS
# ==============================================================================

class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal user representation for audit fields."""
    
    name = serializers.CharField(source='get_full_name', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name']
        read_only_fields = fields


class ParentSerializer(serializers.ModelSerializer):
    """Minimal representation for parent relationships."""
    
    class Meta:
        model = Master
        fields = ['id', 'name', 'code', 'status']


# ==============================================================================
# EXTENSION SERIALIZERS
# ==============================================================================

class DepartmentDetailsSerializer(serializers.ModelSerializer):
    """Serializer for department-specific extension data."""
    
    class Meta:
        model = DepartmentDetails
        fields = [
            'is_default',
            'deactivated_at',
            'deactivated_by',
            'deactivation_reason'
        ]
        read_only_fields = ['deactivated_at', 'deactivated_by']


class ProjectDetailsSerializer(serializers.ModelSerializer):
    """Serializer for project-specific extension data."""
    
    department_name = serializers.CharField(
        source='department.name',
        read_only=True
    )
    department_code = serializers.CharField(
        source='department.code',
        read_only=True
    )
    
    class Meta:
        model = ProjectDetails
        fields = ['department', 'department_name', 'department_code']
    
    def validate_department(self, value: Master) -> Master:
        """Ensure department is active."""
        if value.status != MasterStatus.ACTIVE:
            raise serializers.ValidationError(
                _("Selected department must be active.")
            )
        return value


# ==============================================================================
# MASTER SERIALIZERS
# ==============================================================================

class MasterListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    
    type_display = serializers.CharField(
        source='get_master_type_display',
        read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )
    updated_by_name = serializers.CharField(
        source='updated_by.get_full_name',
        read_only=True
    )
    children_count = serializers.IntegerField(
        source='children.count',
        read_only=True
    )
    has_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Master
        fields = [
            'id',
            'master_type',
            'type_display',
            'name',
            'code',
            'description',
            'status',
            'status_display',
            'display_order',
            'is_system',
            'parent',
            'children_count',
            'has_details',
            'created_at',
            'updated_at',
            'created_by_name',
            'updated_by_name',
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_has_details(self, obj: Master) -> bool:
        """Check if master has extension data."""
        if obj.master_type == MasterType.DEPARTMENT:
            return hasattr(obj, 'department_details')
        elif obj.master_type == MasterType.PROJECT:
            return hasattr(obj, 'project_details')
        return False


class MasterDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with full relationships and extension data."""
    
    type_display = serializers.CharField(
        source='get_master_type_display',
        read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    created_by = UserMinimalSerializer(read_only=True)
    updated_by = UserMinimalSerializer(read_only=True)
    parent_details = ParentSerializer(source='parent', read_only=True)
    children_count = serializers.IntegerField(source='children.count', read_only=True)
    
    # Extension data
    department_details = DepartmentDetailsSerializer(read_only=True)
    project_details = ProjectDetailsSerializer(read_only=True)
    
    class Meta:
        model = Master
        fields = [
            'id',
            'master_type',
            'type_display',
            'name',
            'code',
            'description',
            'status',
            'status_display',
            'metadata',
            'parent',
            'parent_details',
            'display_order',
            'is_system',
            'children_count',
            'department_details',
            'project_details',
            'created_by',
            'created_at',
            'updated_by',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']


class MasterCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating masters with extension support."""
    
    code = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True
    )
    status = serializers.CharField(
        required=False,
        default=MasterStatus.ACTIVE
    )
    # Extension write fields
    department_details = DepartmentDetailsSerializer(
        required=False,
        write_only=True
    )
    project_details = ProjectDetailsSerializer(
        required=False,
        write_only=True
    )
    
    class Meta:
        model = Master
        fields = [
            'master_type',
            'name',
            'code',
            'description',
            'status',
            'metadata',
            'parent',
            'display_order',
            'is_system',
            'department_details',
            'project_details',
        ]
    
    def validate_name(self, value: str) -> str:
        """Clean and validate name."""
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError(_("Name cannot be empty."))
        if len(cleaned) > 100:
            raise serializers.ValidationError(
                _("Name cannot exceed 100 characters.")
            )
        # Relaxed regex: allows unicode letters, numbers, spaces, and common punctuation
        if not re.match(r'^[\w\s\-_&/().]+$', cleaned, re.UNICODE):
            raise serializers.ValidationError(
                _("Name contains invalid characters.")
            )
        return cleaned
    
    def validate_code(self, value: Optional[str]) -> str:
        """Clean and validate code, auto-generate if not provided."""
        if not value:
            # Auto-generate code from name if not provided
            name = self.initial_data.get('name', 'UNKNOWN')
            # Take first 3 chars of name + random 3 digits
            name_part = name[:3].upper().replace(' ', '_')
            import random
            random_part = str(random.randint(100, 999))
            return (name_part + random_part)[:20]
        
        cleaned = value.strip().upper()
        if len(cleaned) > 20:
            raise serializers.ValidationError(
                _("Code cannot exceed 20 characters.")
            )
        if not re.match(r'^[A-Z0-9\-_]+$', cleaned):
            raise serializers.ValidationError(
                _("Code can only contain uppercase letters, numbers, hyphens, and underscores.")
            )
        return cleaned
    
    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        """Cross-field validation."""
        master_type = attrs.get('master_type')
        parent = attrs.get('parent')
        instance = self.instance
        
        # Validate parent type matches
        if parent and parent.master_type != master_type:
            raise serializers.ValidationError({
                'parent': _("Parent must be of the same master type.")
            })
        
        # Prevent circular references
        if instance and parent:
            current = parent
            visited = set()
            while current:
                if current in visited or current == instance:
                    raise serializers.ValidationError({
                        'parent': _("Circular parent reference detected.")
                    })
                visited.add(current)
                current = current.parent
        
        # Validate extension data matches type
        dept_data = attrs.get('department_details')
        proj_data = attrs.get('project_details')
        
        if dept_data and master_type != MasterType.DEPARTMENT:
            raise serializers.ValidationError({
                'department_details': _("Only valid for DEPARTMENT type.")
            })
        
        if proj_data and master_type != MasterType.PROJECT:
            raise serializers.ValidationError({
                'project_details': _("Only valid for PROJECT type.")
            })
        
        return attrs
    
    @transaction.atomic
    def create(self, validated_data: Dict[str, Any]) -> Master:
        """Create master with extension data."""
        dept_data = validated_data.pop('department_details', None)
        proj_data = validated_data.pop('project_details', None)
        
        # Ensure code is set (validate_code should handle this, but double-check)
        if not validated_data.get('code'):
            name = validated_data.get('name', 'UNKNOWN')
            validated_data['code'] = name[:3].upper() + str(int(timezone.now().timestamp()))[-4:]
        
        # Set audit fields
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
            validated_data['updated_by'] = request.user
        
        master = Master.objects.create(**validated_data)
        
        # Create extension records
        if master.master_type == MasterType.DEPARTMENT and dept_data:
            DepartmentDetails.objects.create(master=master, **dept_data)
        elif master.master_type == MasterType.PROJECT and proj_data:
            ProjectDetails.objects.create(master=master, **proj_data)
        
        return master
    
    @transaction.atomic
    def update(self, instance: Master, validated_data: Dict[str, Any]) -> Master:
        """Update master with extension data."""
        dept_data = validated_data.pop('department_details', None)
        proj_data = validated_data.pop('project_details', None)
        
        # Update audit field
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['updated_by'] = request.user
        
        # Update master fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update or create extension records
        if instance.master_type == MasterType.DEPARTMENT and dept_data:
            details, _ = DepartmentDetails.objects.get_or_create(master=instance)
            for attr, value in dept_data.items():
                setattr(details, attr, value)
            details.save()
        elif instance.master_type == MasterType.PROJECT and proj_data:
            details, _ = ProjectDetails.objects.get_or_create(master=instance)
            for attr, value in proj_data.items():
                setattr(details, attr, value)
            details.save()
        
        return instance


class MasterStatusUpdateSerializer(serializers.ModelSerializer):
    """Serializer for status updates with business rule validation."""
    
    class Meta:
        model = Master
        fields = ['status']
    
    def validate_status(self, value: str) -> str:
        """Validate status transition rules."""
        instance = self.instance
        if not instance:
            return value
        
        # Prevent deactivation if active children exist
        if value == MasterStatus.INACTIVE:
            if instance.children.filter(status=MasterStatus.ACTIVE).exists():
                raise serializers.ValidationError(
                    _("Cannot deactivate master with active child entries.")
                )
            
            # Department-specific: check if default
            if instance.master_type == MasterType.DEPARTMENT:
                try:
                    if instance.department_details.is_default:
                        raise serializers.ValidationError(
                            _("Cannot deactivate the default department.")
                        )
                except DepartmentDetails.DoesNotExist:
                    pass
        
        return value
    
    def update(self, instance: Master, validated_data: Dict[str, Any]) -> Master:
        """Update status with audit logging."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['updated_by'] = request.user
        
        # Handle department deactivation fields
        if (instance.master_type == MasterType.DEPARTMENT and 
            validated_data.get('status') == MasterStatus.INACTIVE):
            try:
                details = instance.department_details
                details.deactivated_at = timezone.now()
                details.deactivated_by = (
                    request.user if request and request.user.is_authenticated else None
                )
                details.save(update_fields=['deactivated_at', 'deactivated_by'])
            except DepartmentDetails.DoesNotExist:
                pass
        
        return super().update(instance, validated_data)


# ==============================================================================
# BULK OPERATIONS
# ==============================================================================

class MasterBulkCreateSerializer(serializers.Serializer):
    """Serializer for bulk creation of masters."""
    
    masters = MasterCreateUpdateSerializer(many=True)
    
    def validate_masters(self, value: List[Dict]) -> List[Dict]:
        """Validate bulk creation limits."""
        if not value:
            raise serializers.ValidationError(_("At least one master is required."))
        if len(value) > 100:
            raise serializers.ValidationError(
                _("Cannot create more than 100 masters at once.")
            )
        return value
    
    @transaction.atomic
    def create(self, validated_data: Dict[str, List]) -> List[Master]:
        """Bulk create masters."""
        masters_data = validated_data['masters']
        created = []
        
        for data in masters_data:
            serializer = MasterCreateUpdateSerializer(
                data=data,
                context=self.context
            )
            serializer.is_valid(raise_exception=True)
            created.append(serializer.save())
        
        return created


# ==============================================================================
# AUDIT SERIALIZERS
# ==============================================================================

class MasterAuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit log entries."""
    
    changed_by_name = serializers.CharField(
        source='changed_by.get_full_name',
        read_only=True
    )
    master_name = serializers.CharField(source='master.name', read_only=True)
    action_display = serializers.CharField(
        source='get_action_display',
        read_only=True
    )
    
    class Meta:
        model = MasterAuditLog
        fields = [
            'id',
            'master',
            'master_name',
            'action',
            'action_display',
            'old_data',
            'new_data',
            'changed_by',
            'changed_by_name',
            'changed_at',
            'ip_address',
            'user_agent',
        ]
        read_only_fields = fields


# ==============================================================================
# DROPDOWN / UTILITY SERIALIZERS
# ==============================================================================

class MasterOptionSerializer(serializers.ModelSerializer):
    value = serializers.IntegerField(source='id', read_only=True)
    label = serializers.CharField(source='name', read_only=True)

    class Meta:
        model = Master
        fields = ['id', 'name', 'code', 'status', 'value', 'label']

class MasterTreeSerializer(serializers.ModelSerializer):
    """Serializer for hierarchical tree display."""
    
    children = serializers.SerializerMethodField()
    label = serializers.CharField(source='name')
    
    class Meta:
        model = Master
        fields = ['id', 'label', 'name', 'code', 'status', 'children']
    
    def get_children(self, obj: Master) -> List[Dict]:
        """Recursively serialize children."""
        # Limit depth to prevent recursion issues
        depth = (self.context or {}).get('depth', 0)
        if depth > 5:
            return []
        
        children = obj.children.filter(status=MasterStatus.ACTIVE)
        return MasterTreeSerializer(
            children,
            many=True,
            context={**(self.context or {}), 'depth': depth + 1}
        ).data