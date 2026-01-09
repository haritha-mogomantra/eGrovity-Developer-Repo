# ==============================================================================
# FILE: masters/serializers.py
# ==============================================================================

from rest_framework import serializers
from .models import (
    Master,
    MasterAuditLog,
    MasterType,
    MasterStatus,
    ProjectDetails,
    EmployeeRoleAssignment
)
from django.conf import settings
import re

from django.contrib.auth import get_user_model

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Minimal user serializer for audit fields"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = fields

class MasterListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing masters"""
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    managers = serializers.SerializerMethodField()
    
    class Meta:
        model = Master
        fields = [
            'id', 'master_type', 'name', 'description', 'code',
            'status', 'display_order', 'is_system',
            'created_at', 'updated_at',
            'created_by_name', 'updated_by_name', 'department_name', 'managers'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None
    
    def get_updated_by_name(self, obj):
        return obj.updated_by.get_full_name() if obj.updated_by else None
    
    def get_department_name(self, obj):
        if obj.master_type != MasterType.PROJECT:
            return None

        try:
            return obj.project_details.department.name
        except ProjectDetails.DoesNotExist:
            return None
        
    def get_managers(self, obj):
        if obj.master_type != MasterType.PROJECT:
            return []

        try:
            return [
                m.get_full_name() or m.username
                for m in obj.project_details.managers.all()
            ]
        except ProjectDetails.DoesNotExist:
            return []


class MasterDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with relationships"""
    created_by = UserSerializer(read_only=True)
    updated_by = UserSerializer(read_only=True)
    parent_details = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    managers = serializers.SerializerMethodField()


    class Meta:
        model = Master
        fields = [
            'id', 'master_type', 'name', 'description', 'code',
            'status', 'metadata', 'parent', 'parent_details',
            'display_order', 'is_system', 'children_count',
            'created_by', 'created_at', 
            'updated_by', 'updated_at', 'department_name', 'managers'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_by', 'updated_at']
    
    def get_parent_details(self, obj):
        if obj.parent:
            return {
                'id': obj.parent.id,
                'name': obj.parent.name
            }
        return None
    
    def get_children_count(self, obj):
        return obj.children.count()

    def get_department_name(self, obj):
        if obj.master_type != MasterType.PROJECT:
            return None

        try:
            return obj.project_details.department.name
        except ProjectDetails.DoesNotExist:
            return None
        
    def get_managers(self, obj):
        if obj.master_type != MasterType.PROJECT:
            return []

        try:
            return [
                {
                    "id": m.id,
                    "name": m.get_full_name() or m.username
                }
                for m in obj.project_details.managers.all()
            ]
        except ProjectDetails.DoesNotExist:
            return []




class MasterCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating masters"""

    class Meta:
        model = Master
        fields = [
            'master_type', 'name', 'description', 'code',
            'status', 'metadata', 'parent', 'display_order', 'is_system'
        ]
    
    def validate_name(self, value):
        """Validate and clean name"""
        if not value or not value.strip():
            raise serializers.ValidationError("Name cannot be empty")
        
        value = value.strip()
        
        if len(value) > 100:
            raise serializers.ValidationError("Name cannot exceed 100 characters")
        
        if not re.match(r'^[a-zA-Z0-9\s&\-_\/]+$', value):
            raise serializers.ValidationError(
                "Name can only contain letters, numbers, spaces, &, /, hyphens, and underscores"
                        )
        
        return value
    
    def validate_code(self, value):
        """Validate and clean code"""
        if value:
            value = value.strip().upper()
            if len(value) > 20:
                raise serializers.ValidationError("Code cannot exceed 20 characters")
            if not re.match(r'^[a-zA-Z0-9\-_]+$', value):
                raise serializers.ValidationError(
                    "Code can only contain letters, numbers, hyphens, and underscores"
                )
        return value
    
    def validate_description(self, value):
        """Validate description length"""
        if value and len(value) > 500:
            raise serializers.ValidationError("Description cannot exceed 500 characters")
        return value
    
    def validate_master_type(self, value):
        """Validate master type"""
        if value not in [choice.value for choice in MasterType]:
            raise serializers.ValidationError(
                f"Invalid master type. Must be one of: {', '.join([c.value for c in MasterType])}"
            )
        return value
    
    def validate_status(self, value):
        """Validate status"""
        if value not in [choice.value for choice in MasterStatus]:
            raise serializers.ValidationError(
                f"Invalid status. Must be one of: {', '.join([c.value for c in MasterStatus])}"
            )
        return value
    
    def validate(self, attrs):
        """Cross-field validation"""
        master_type = attrs.get('master_type')
        name = attrs.get('name')
        code = attrs.get('code')
        parent = attrs.get('parent')
        
        # Check for case-insensitive duplicates
        if master_type and name:
            query = Master.objects.filter(
                master_type=master_type,
                name__iexact=name,
                status=MasterStatus.ACTIVE
            )
            
            if self.instance:
                query = query.exclude(pk=self.instance.pk)
            
            if query.exists():
                raise serializers.ValidationError({
                    'name': f'A master with this name already exists for type {master_type}'
                })
        
        # Check for duplicate codes within departments
        if code and master_type == MasterType.DEPARTMENT:
            query = Master.objects.filter(
                master_type=MasterType.DEPARTMENT,
                code__iexact=code,
                status=MasterStatus.ACTIVE
            )
            
            if self.instance:
                query = query.exclude(pk=self.instance.pk)
            
            if query.exists():
                raise serializers.ValidationError({
                    'code': 'A department with this code already exists'
                })
        
        # Validate parent type matches
        if parent and parent.master_type != master_type:
            raise serializers.ValidationError({
                'parent': 'Parent must be of the same master type'
            })
        
        # Prevent circular parent reference
        if self.instance and parent:
            if parent == self.instance or parent.parent == self.instance:
                raise serializers.ValidationError({
                    'parent': 'Circular parent reference detected'
                })
        
        return attrs


class MasterStatusUpdateSerializer(serializers.Serializer):
    """Serializer for status updates only"""
    status = serializers.ChoiceField(choices=MasterStatus.choices)
    
    def validate_status(self, value):
        """Additional validation for status changes"""
        master = self.context.get('master')
        
        if master and value == MasterStatus.INACTIVE:
            if master.children.filter(status=MasterStatus.ACTIVE).exists():
                raise serializers.ValidationError(
                    "Cannot deactivate master with active child entries"
                )
        
        return value

class MasterBulkCreateSerializer(serializers.Serializer):
    """Serializer for bulk creation"""
    masters = MasterCreateUpdateSerializer(many=True)
    
    def validate_masters(self, value):
        if not value:
            raise serializers.ValidationError("At least one master is required")
        if len(value) > 100:
            raise serializers.ValidationError("Cannot create more than 100 masters at once")
        return value

class MasterAuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit logs"""
    changed_by_name = serializers.SerializerMethodField()
    master_name = serializers.CharField(source='master.name', read_only=True)
    
    class Meta:
        model = MasterAuditLog
        fields = [
            'id', 'master', 'master_name', 'action', 
            'old_data', 'new_data', 'changed_by', 'changed_by_name',
            'changed_at', 'ip_address', 'user_agent'
        ]
        read_only_fields = fields
    
    def get_changed_by_name(self, obj):
        return obj.changed_by.get_full_name() if obj.changed_by else None

class MasterDropdownSerializer(serializers.ModelSerializer):
    """Minimal serializer for dropdown options"""
    label = serializers.CharField(source='name')
    value = serializers.IntegerField(source='id')
    department_name = serializers.SerializerMethodField()

    class Meta:
        model = Master
        fields = ['value', 'label', 'code', 'department_name']

    def get_department_name(self, obj):
        if obj.master_type != MasterType.PROJECT:
            return None
        try:
            return obj.project_details.department.name
        except ProjectDetails.DoesNotExist:
            return None

# =====================================================
# EMPLOYEE ROLE ASSIGNMENT SERIALIZERS (RBAC)
# =====================================================

class EmployeeRoleAssignmentSerializer(serializers.ModelSerializer):
    """
    Admin serializer for assigning roles to employees.
    """

    employee_name = serializers.SerializerMethodField(read_only=True)
    role_name = serializers.SerializerMethodField(read_only=True)
    department_name = serializers.SerializerMethodField(read_only=True)
    reporting_manager_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = EmployeeRoleAssignment
        fields = [
            "id",
            "employee",
            "employee_name",
            "role",
            "role_name",
            "department",
            "department_name",
            "reporting_manager",
            "reporting_manager_name",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    # ----------------------------
    # Display helpers
    # ----------------------------

    def get_employee_name(self, obj):
        return obj.employee.get_full_name() or obj.employee.username

    def get_role_name(self, obj):
        return obj.role.name if obj.role else None

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None

    def get_reporting_manager_name(self, obj):
        if obj.reporting_manager:
            return (
                obj.reporting_manager.get_full_name()
                or obj.reporting_manager.username
            )
        return None

    # ----------------------------
    # Business validations
    # ----------------------------

    def validate(self, attrs):
        role = attrs.get("role")
        department = attrs.get("department")
        reporting_manager = attrs.get("reporting_manager")
        employee = attrs.get("employee")

        # Manager role requires department
        if role and role.master_type == MasterType.ROLE:
            if role.name.lower() == "manager" and not department:
                raise serializers.ValidationError(
                    {"department": "Department is required for Manager role"}
                )

        # Employee cannot report to self
        if reporting_manager and employee and reporting_manager == employee:
            raise serializers.ValidationError(
                {"reporting_manager": "Employee cannot report to themselves"}
            )

        return attrs
