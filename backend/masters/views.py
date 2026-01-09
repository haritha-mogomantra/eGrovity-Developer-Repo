# ==============================================================================
# FILE: masters/views.py
# ==============================================================================

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.db.models import Q
from django.core.cache import cache
from django_filters.rest_framework import DjangoFilterBackend
import csv
from django.http import HttpResponse

from .models import (
    Master,
    MasterAuditLog,
    MasterType,
    MasterStatus,
    ProjectDetails,
    EmployeeRoleAssignment
)
from .serializers import (
    MasterListSerializer, MasterDetailSerializer, 
    MasterCreateUpdateSerializer, MasterStatusUpdateSerializer,
    MasterBulkCreateSerializer, MasterAuditLogSerializer,
    MasterDropdownSerializer, EmployeeRoleAssignmentSerializer
)
from .permissions import IsMasterAdmin, IsMasterAdminOrReadOnly
from .utils import log_master_change
from rest_framework.views import APIView
from employee.models import Employee

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.exceptions import NotFound


class SafePageNumberPagination(PageNumberPagination):
    """
    Pagination that does NOT throw 404 for invalid pages.
    Returns empty result instead.
    """
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        try:
            return super().paginate_queryset(queryset, request, view)
        except NotFound:
            # Invalid page → return empty list instead of error
            self.page = None
            return []

    def get_paginated_response(self, data):
        if self.page is None:
            return Response({
                "count": 0,
                "next": None,
                "previous": None,
                "results": [],
                "total_pages": 0,
                "current_page": 1,
            })

        return Response({
            "count": self.page.paginator.count,
            "next": self.get_next_link(),
            "previous": self.get_previous_link(),
            "results": data,
            "total_pages": self.page.paginator.num_pages,
            "current_page": self.page.number,
        })


class MasterViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Master CRUD operations
    
    List: GET /api/masters/
    Create: POST /api/masters/
    Retrieve: GET /api/masters/{id}/
    Update: PUT /api/masters/{id}/
    Partial Update: PATCH /api/masters/{id}/
    Delete: DELETE /api/masters/{id}/
    """

    pagination_class = SafePageNumberPagination
    queryset = Master.objects.select_related(
        'created_by', 'updated_by', 'parent'
    ).prefetch_related('children')
    permission_classes = [IsAuthenticated, IsMasterAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['master_type', 'status', 'is_system']
    search_fields = ['name', 'description', 'code']
    ordering_fields = ['name', 'created_at', 'updated_at', 'display_order']
    ordering = ['master_type', 'display_order', 'name']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return MasterListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return MasterCreateUpdateSerializer
        return MasterDetailSerializer
    
    def get_queryset(self):
        """Filter queryset based on query parameters"""
        queryset = super().get_queryset()
        
        # Filter by master type from query params
        master_type = self.request.query_params.get('master_type', None)
        if master_type:
            queryset = queryset.filter(master_type__iexact=master_type)

        if master_type == MasterType.PROJECT and not self.request.query_params.get('status'):
            queryset = queryset.exclude(status=MasterStatus.INACTIVE)


        status = self.request.query_params.get('status', None)
        if status:
            queryset = queryset.filter(status__iexact=status)

        # Search functionality
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | 
                Q(description__icontains=search) |
                Q(code__icontains=search)
            )
        
        return queryset
    
    def perform_create(self, serializer):
        """Create master with audit tracking"""
        master = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user
        )

        # =====================================================
        # PROJECT DETAILS CREATION (ONLY FOR PROJECT)
        # =====================================================
        if master.master_type == MasterType.PROJECT:
            department_id = self.request.data.get("department_id")
            manager_ids = self.request.data.get("managers", [])

            if not department_id:
                raise ValidationError({"department_id": "Department is required for project"})

            department = Master.objects.filter(
                id=department_id,
                master_type=MasterType.DEPARTMENT,
                status=MasterStatus.ACTIVE
            ).first()

            if not department:
                raise ValidationError({"department_id": "Invalid department"})

            project_details = ProjectDetails.objects.create(
                project=master,
                department=department
            )

            if manager_ids:
                project_details.managers.set(manager_ids)

        # Log creation
        log_master_change(
            master=master,
            action='CREATE',
            user=self.request.user,
            request=self.request,
            new_data=serializer.data
        )

        # Invalidate cache
        self._invalidate_cache(master.master_type)

    
    def perform_update(self, serializer):
        """Update master with audit tracking"""
        old_data = MasterDetailSerializer(serializer.instance).data
        master = serializer.save(updated_by=self.request.user)

        # =====================================================
        # PROJECT DETAILS UPDATE (ONLY FOR PROJECT)
        # =====================================================
        if master.master_type == MasterType.PROJECT:
            department_id = self.request.data.get("department_id")
            manager_ids = self.request.data.get("managers")

            # =====================================================
            # ✅ MANAGER IS MANDATORY FOR PROJECT (BUSINESS RULE)
            # =====================================================
            if not manager_ids:
                raise ValidationError({
                    "managers": "At least one manager must be assigned to the project"
                })

            project_details, _ = ProjectDetails.objects.get_or_create(
                project=master
            )

            if department_id:
                department = Master.objects.filter(
                    id=department_id,
                    master_type=MasterType.DEPARTMENT,
                    status=MasterStatus.ACTIVE
                ).first()

                if not department:
                    raise ValidationError({"department_id": "Invalid department"})

                project_details.department = department

            if manager_ids is not None:
                project_details.managers.set(manager_ids)

            project_details.save()

        
        # Log update
        log_master_change(
            master=master,
            action='UPDATE',
            user=self.request.user,
            request=self.request,
            old_data=old_data,
            new_data=serializer.data
        )
        
        # Invalidate cache
        self._invalidate_cache(master.master_type)
    
    def perform_destroy(self, instance):
        """
        Soft delete master by setting status = Inactive
        """

        # System masters cannot be deleted
        if instance.is_system:
            raise PermissionDenied("System masters cannot be deleted")

        # Cannot delete if active children exist
        if instance.children.filter(status=MasterStatus.ACTIVE).exists():
            raise ValidationError({
                "detail": "Cannot delete this item because it has active child entries"
            })

        old_data = MasterDetailSerializer(instance).data

        # Soft delete (skip full_clean / unique validation)
        instance.status = MasterStatus.INACTIVE
        instance.updated_by = self.request.user
        instance.save(update_fields=["status", "updated_by"])

        # Audit log
        log_master_change(
            master=instance,
            action='DELETE',
            user=self.request.user,
            request=self.request,
            old_data=old_data
        )

        # Invalidate cache
        self._invalidate_cache(instance.master_type)

    
    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsMasterAdmin])
    def change_status(self, request, pk=None):
        """
        Change master status
        PATCH /api/masters/{id}/change_status/
        Body: {"status": "Active" or "Inactive"}
        """
        master = self.get_object()
        
        if master.is_system and request.data.get('status') == MasterStatus.INACTIVE:
            return Response(
                {'error': 'System masters cannot be deactivated'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = MasterStatusUpdateSerializer(
            data=request.data,
            context={'master': master}
        )
        serializer.is_valid(raise_exception=True)
        
        old_status = master.status
        master.status = serializer.validated_data['status']
        master.updated_by = request.user
        master.save()
        
        # Log status change
        log_master_change(
            master=master,
            action='STATUS_CHANGE',
            user=request.user,
            request=request,
            old_data={'status': old_status},
            new_data={'status': master.status}
        )
        
        # Invalidate cache
        self._invalidate_cache(master.master_type)
        
        return Response(MasterDetailSerializer(master).data)
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsMasterAdmin])
    def bulk_create(self, request):
        """
        Bulk create masters
        POST /api/masters/bulk_create/
        Body: {"masters": [{...}, {...}]}
        """
        serializer = MasterBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        created_masters = []
        errors = []
        
        for idx, master_data in enumerate(serializer.validated_data['masters']):
            try:
                master_serializer = MasterCreateUpdateSerializer(data=master_data)
                master_serializer.is_valid(raise_exception=True)
                master = master_serializer.save(
                    created_by=request.user,
                    updated_by=request.user
                )
                created_masters.append(master)
                
                # Log creation
                log_master_change(
                    master=master,
                    action='CREATE',
                    user=request.user,
                    request=request,
                    new_data=master_serializer.data
                )
            except Exception as e:
                errors.append({
                    'index': idx,
                    'data': master_data,
                    'error': str(e)
                })
        
        # Invalidate all caches
        for master_type in MasterType:
            self._invalidate_cache(master_type.value)
        
        return Response({
            'created': len(created_masters),
            'failed': len(errors),
            'masters': MasterListSerializer(created_masters, many=True).data,
            'errors': errors
        }, status=status.HTTP_201_CREATED if created_masters else status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def dropdown(self, request):
        """
        Get masters for dropdown (lightweight response)
        GET /api/masters/dropdown/?type=ROLE&status=Active
        """
        master_type = request.query_params.get('type')
        if not master_type:
            return Response(
                {'error': 'type parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Try to get from cache
        cache_key = f'masters_dropdown_{master_type}_{request.query_params.get("status", "Active")}'
        cached_data = cache.get(cache_key)
        
        if cached_data:
            return Response(cached_data)
        
        queryset = self.get_queryset().filter(
            master_type__iexact=master_type
        ).order_by('display_order', 'name')

        # =====================================================
        # 🔥 PROJECT DROPDOWN NEEDS DEPARTMENT INFO
        # =====================================================
        if master_type.upper() == MasterType.PROJECT:
            queryset = queryset.filter(
                master_type__iexact=MasterType.PROJECT,
                status=MasterStatus.ACTIVE
            )

            project_details_map = {
                pd.project_id: pd
                for pd in ProjectDetails.objects.select_related("department")
            }

            data = []
            for p in queryset:
                pd = project_details_map.get(p.id)

                data.append({
                    "id": p.id,
                    "name": p.name,
                    "department_name": pd.department.name if pd else None,
                })

            cache.set(cache_key, data, 3600)
            return Response(data)

        # =====================================================
        # ✅ DEFAULT DROPDOWN (ROLE / DEPARTMENT / METRIC)
        # =====================================================
        serializer = MasterDropdownSerializer(queryset, many=True)
        cache.set(cache_key, serializer.data, 3600)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def types(self, request):
        """
        Get all available master types
        GET /api/masters/types/
        """
        return Response([
            {'value': choice.value, 'label': choice.label}
            for choice in MasterType
        ])
    
    @action(detail=False, methods=['get'])
    def export(self, request):
        """
        Export masters to CSV
        GET /api/masters/export/?type=ROLE
        """
        queryset = self.get_queryset()
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="masters_export.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Type', 'Name', 'Code', 'Description', 'Status', 
            'Display Order', 'Is System', 'Created At', 'Created By'
        ])
        
        for master in queryset:
            writer.writerow([
                master.id,
                master.master_type,
                master.name,
                master.code or '',
                master.description or '',
                master.status,
                master.display_order,
                master.is_system,
                master.created_at,
                master.created_by.username if master.created_by else ''
            ])
        
        return response
    
    @action(detail=True, methods=['get'])
    def audit_logs(self, request, pk=None):
        """
        Get audit logs for a specific master
        GET /api/masters/{id}/audit_logs/
        """
        master = self.get_object()
        logs = master.audit_logs.all()
        serializer = MasterAuditLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    def _invalidate_cache(self, master_type):
        """Invalidate cache for a specific master type"""
        for status_value in [MasterStatus.ACTIVE, MasterStatus.INACTIVE]:
            cache_key = f'masters_dropdown_{master_type}_{status_value.value}'
            cache.delete(cache_key)



# =====================================================
# EMPLOYEE ROLE ASSIGNMENT (RBAC MASTER)
# =====================================================

class EmployeeRoleAssignmentViewSet(viewsets.ModelViewSet):
    """
    RBAC Master:
    Assigns roles to employees.
    Admin-only write access.
    """

    queryset = EmployeeRoleAssignment.objects.select_related(
        "employee",
        "role",
        "department",
        "reporting_manager",
    )
    serializer_class = EmployeeRoleAssignmentSerializer
    permission_classes = [IsAuthenticated, IsMasterAdmin]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["role", "department", "status"]
    search_fields = [
        "employee__user__first_name",
        "employee__user__last_name",
        "role__name",
    ]

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()
