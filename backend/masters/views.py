# ==============================================================================
# FILE: masters/views.py
# ==============================================================================

from __future__ import annotations

import csv
import logging
from typing import Any, Dict, List, Optional, Type

from django.core.cache import cache
from django.db import models  # For models.Q
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpResponse
from django.utils import timezone  # For timezone.now()
from django.utils.translation import gettext_lazy as _
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer

from .models import (
    AuditAction,
    DepartmentDetails,
    Master,
    MasterAuditLog,
    MasterStatus,
    MasterType,
    ProjectDetails,
)
from .permissions import IsMasterAdmin, IsMasterAdminOrReadOnly
from .serializers import (
    MasterListSerializer,
    MasterDetailSerializer,
    MasterCreateUpdateSerializer,
    MasterStatusUpdateSerializer,
    MasterBulkCreateSerializer,
    MasterAuditLogSerializer,
    MasterOptionSerializer,
    MasterTreeSerializer
)
from .services import DepartmentService
from .utils import log_master_change

logger = logging.getLogger(__name__)


# ==============================================================================
# PAGINATION
# ==============================================================================

class SafePageNumberPagination(PageNumberPagination):
    """
    Pagination that returns empty results for invalid pages instead of 404.
    """
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100

    def paginate_queryset(
        self, 
        queryset: QuerySet, 
        request: Request, 
        view: Optional[Any] = None
    ) -> List[Any]:
        try:
            return super().paginate_queryset(queryset, request, view)
        except NotFound:
            self.page = None
            return []

    def get_paginated_response(self, data: List[Dict]) -> Response:
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


# ==============================================================================
# VIEWSET
# ==============================================================================

class MasterViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Master data management.
    
    Provides CRUD operations, status management, bulk operations,
    and specialized endpoints for department lifecycle management.
    """
    
    pagination_class = SafePageNumberPagination
    permission_classes = [IsAuthenticated, IsMasterAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['master_type', 'status', 'is_system']
    search_fields = ['name', 'description', 'code']
    ordering_fields = ['name', 'created_at', 'updated_at', 'display_order']
    ordering = ['master_type', 'display_order', 'name']
    lookup_field = 'pk'

    def get_queryset(self) -> QuerySet:
        """Return optimized queryset with filtering."""
        queryset = Master.objects.select_related(
            'created_by', 'updated_by', 'parent'
        ).prefetch_related('children', 'department_details', 'project_details')
        
        return self._apply_filters(queryset)
    
    def _apply_filters(self, queryset: QuerySet) -> QuerySet:
        """Apply query parameter filters."""
        params = self.request.query_params
        
        # Master type filter
        master_type = params.get('master_type')
        if master_type:
            queryset = queryset.filter(master_type__iexact=master_type)
            
            # Auto-exclude inactive projects unless explicitly requested
            if master_type.upper() == MasterType.PROJECT:
                status_filter = params.get('status')
                if not status_filter:
                    queryset = queryset.exclude(status=MasterStatus.INACTIVE)
        
        # Status filter
        status_param = params.get('status')
        if status_param:
            queryset = queryset.filter(status__iexact=status_param)
        
        # Search filter
        search = params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(name__icontains=search) | 
                models.Q(description__icontains=search) |
                models.Q(code__icontains=search)
            )
        
        return queryset

    def get_serializer_class(self) -> Type[Serializer]:
        """Return appropriate serializer for action."""
        if self.action == 'list':
            return MasterListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return MasterCreateUpdateSerializer
        elif self.action == 'change_status':
            return MasterStatusUpdateSerializer
        return MasterDetailSerializer

    def get_serializer_context(self) -> Dict[str, Any]:
        """Add request to serializer context."""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    # ==========================================================================
    # CRUD OPERATIONS
    # ==========================================================================

    @transaction.atomic
    def perform_create(self, serializer: MasterCreateUpdateSerializer) -> Master:
        """Create master with audit logging."""
        master = serializer.save()
        
        self._log_change(master, AuditAction.CREATE, new_data=serializer.data)
        self._invalidate_cache(master.master_type)
        
        return master

    @transaction.atomic
    def perform_update(self, serializer: MasterCreateUpdateSerializer) -> Master:
        """Update master with audit logging."""
        old_data = MasterDetailSerializer(serializer.instance).data
        master = serializer.save()
        
        self._log_change(
            master, 
            AuditAction.UPDATE, 
            old_data=old_data, 
            new_data=serializer.data
        )
        self._invalidate_cache(master.master_type)
        
        return master

    @transaction.atomic
    def perform_destroy(self, instance: Master) -> None:
        """
        Soft delete master by setting status to INACTIVE.
        Hard delete is prevented for data integrity.
        """
        self._validate_deletion(instance)
        
        old_data = MasterDetailSerializer(instance).data
        
        # Soft delete with minimal field update to bypass validation
        instance.status = MasterStatus.INACTIVE
        instance.updated_by = self.request.user
        instance.save(update_fields=["status", "updated_by", "updated_at"])
        
        self._log_change(instance, AuditAction.DELETE, old_data=old_data)
        self._invalidate_cache(instance.master_type)

    def _validate_deletion(self, instance: Master) -> None:
        """Validate if master can be deleted/deactivated."""
        # Prevent department deletion via standard endpoint
        if instance.master_type == MasterType.DEPARTMENT:
            raise ValidationError(
                _("Departments must be deactivated using the /deactivate endpoint.")
            )
        
        # Protect system masters
        if instance.is_system:
            raise PermissionDenied(_("System masters cannot be deleted."))
        
        # Prevent deletion with active children
        if instance.children.filter(status=MasterStatus.ACTIVE).exists():
            raise ValidationError(
                _("Cannot delete master with active child entries.")
            )

    # ==========================================================================
    # CUSTOM ACTIONS
    # ==========================================================================

    @action(
        detail=True, 
        methods=['patch'], 
        permission_classes=[IsAuthenticated, IsMasterAdmin],
        url_path='change-status'
    )
    def change_status(self, request: Request, pk: Optional[int] = None) -> Response:
        """
        Change master status with business rule validation.
        
        PATCH /api/masters/{id}/change-status/
        Body: {"status": "ACTIVE" | "INACTIVE"}
        """
        master = self.get_object()
        new_status = request.data.get('status')
        
        # Departments use specialized endpoint
        if master.master_type == MasterType.DEPARTMENT:
            raise ValidationError(
                _("Use /deactivate endpoint for department status changes.")
            )
        
        # Protect system masters
        if master.is_system and new_status == MasterStatus.INACTIVE:
            raise PermissionDenied(_("System masters cannot be deactivated."))
        
        serializer = self.get_serializer(
            master, 
            data=request.data, 
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        
        old_status = master.status
        updated_master = serializer.save(updated_by=request.user)
        
        self._log_change(
            updated_master,
            AuditAction.STATUS_CHANGE,
            old_data={'status': old_status},
            new_data={'status': updated_master.status}
        )
        self._invalidate_cache(updated_master.master_type)
        
        return Response(MasterDetailSerializer(updated_master).data)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsMasterAdmin],
        url_path="deactivate"
    )
    @transaction.atomic
    def deactivate_department(self, request: Request, pk: Optional[int] = None) -> Response:
        """
        Deactivate a department with data migration.
        
        POST /api/masters/{id}/deactivate/
        Body: {
            "reason": "Business restructuring",
            "target_department_id": 123
        }
        """
        master = self.get_object()
        
        if master.master_type != MasterType.DEPARTMENT:
            raise ValidationError(_("Only departments can be deactivated."))
        
        # Validate request data
        reason = request.data.get("reason", "").strip()
        if not reason:
            raise ValidationError({"reason": _("Deactivation reason is required.")})
        
        target_id = request.data.get("target_department_id")
        if not target_id:
            raise ValidationError({
                "target_department_id": _("Target department is required.")
            })
        
        if int(target_id) == master.id:
            raise ValidationError({
                "target_department_id": _("Cannot migrate to the same department.")
            })
        
        # Validate target department
        try:
            target = Master.objects.get(
                id=target_id,
                master_type=MasterType.DEPARTMENT,
                status=MasterStatus.ACTIVE
            )
        except Master.DoesNotExist:
            raise ValidationError({
                "target_department_id": _("Invalid or inactive target department.")
            })
        
        # Execute deactivation via service
        service = DepartmentService()
        summary = service.deactivate_department(
            department=master,
            target_department=target,
            action_by=request.user,
            reason=reason
        )
        
        # Update department status and details
        master.status = MasterStatus.INACTIVE
        master.updated_by = request.user
        master.save(update_fields=["status", "updated_by"])
        
        # Update extension details
        DepartmentDetails.objects.filter(master=master).update(
            deactivated_at=timezone.now(),
            deactivated_by=request.user,
            deactivation_reason=reason
        )
        
        return Response({
            "success": True,
            "summary": summary
        })

    @action(
        detail=False, 
        methods=['post'], 
        permission_classes=[IsAuthenticated, IsMasterAdmin],
        url_path='bulk-create'
    )
    @transaction.atomic
    def bulk_create(self, request: Request) -> Response:
        """
        Bulk create masters (excludes PROJECT type).
        
        POST /api/masters/bulk-create/
        Body: {"masters": [{...}, {...}]}
        """
        serializer = MasterBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        created_masters: List[Master] = []
        errors: List[Dict] = []
        
        for idx, master_data in enumerate(serializer.validated_data['masters']):
            # Projects excluded from bulk creation
            if master_data.get("master_type") == MasterType.PROJECT:
                errors.append({
                    'index': idx,
                    'error': _("Projects cannot be bulk created.")
                })
                continue
            
            try:
                master_serializer = MasterCreateUpdateSerializer(
                    data=master_data,
                    context=self.get_serializer_context()
                )
                master_serializer.is_valid(raise_exception=True)
                master = master_serializer.save()
                created_masters.append(master)
                
                self._log_change(master, AuditAction.CREATE, new_data=master_serializer.data)
                
            except ValidationError as e:
                errors.append({
                    'index': idx,
                    'error': e.detail
                })
            except Exception as e:
                logger.error(f"Bulk create error at index {idx}: {str(e)}")
                errors.append({
                    'index': idx,
                    'error': _("Internal error occurred.")
                })
        
        # Invalidate all type caches
        for mt in MasterType:
            self._invalidate_cache(mt.value)
        
        status_code = status.HTTP_201_CREATED if created_masters else status.HTTP_400_BAD_REQUEST
        return Response({
            'created': len(created_masters),
            'failed': len(errors),
            'masters': MasterListSerializer(created_masters, many=True).data,
            'errors': errors
        }, status=status_code)

    @action(detail=False, methods=['get'], url_path='dropdown')
    def dropdown(self, request: Request) -> Response:
        """
        Get lightweight master options for dropdowns.
        
        GET /api/masters/dropdown/?type=ROLE&status=ACTIVE
        """
        master_type = request.query_params.get('type')
        if not master_type:
            raise ValidationError({"type": _("Type parameter is required.")})
        
        # Normalize and validate type
        type_upper = master_type.upper()
        try:
            master_type_enum = MasterType(type_upper)
        except ValueError:
            raise ValidationError({"type": _("Invalid master type.")})
        
        # Check cache
        status_param = request.query_params.get('status', MasterStatus.ACTIVE.value)
        cache_key = f'masters_dropdown_{type_upper}_{status_param.capitalize()}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        
        # Build queryset
        queryset = Master.objects.filter(
            master_type=master_type_enum,
            status__iexact=status_param
        ).order_by('display_order', 'name')
        
        # Use appropriate serializer
        if master_type_enum == MasterType.PROJECT:
            data = self._build_project_dropdown(queryset)
        else:
            serializer = MasterOptionSerializer(queryset, many=True)
            data = serializer.data
        
        cache.set(cache_key, data, 3600)
        return Response(data)
    
    def _build_project_dropdown(self, queryset: QuerySet) -> List[Dict]:
        """Build project dropdown with department info."""
        projects = list(queryset.select_related('project_details__department'))
        
        return [
            {
                "id": p.id,
                "name": p.name,
                "code": p.code,
                "department_name": (
                    p.project_details.department.name 
                    if hasattr(p, 'project_details') and p.project_details.department 
                    else None
                ),
                "status": p.status
            }
            for p in projects
        ]

    @action(detail=False, methods=['get'], url_path='types')
    def types(self, request: Request) -> Response:
        """Get available master types."""
        return Response([
            {'value': choice.value, 'label': str(choice.label)}
            for choice in MasterType
        ])

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request: Request) -> HttpResponse:
        """
        Export masters to CSV (streaming response).
        
        GET /api/masters/export/?master_type=ROLE
        """
        queryset = self.get_queryset().iterator(chunk_size=1000)
        
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
                master.created_at.isoformat(),
                master.created_by.get_full_name() if master.created_by else ''
            ])
        
        return response

    @action(
        detail=True, 
        methods=['get'], 
        url_path='audit-logs',
        pagination_class=SafePageNumberPagination
    )
    def audit_logs(self, request: Request, pk: Optional[int] = None) -> Response:
        """
        Get paginated audit logs for a master.
        
        GET /api/masters/{id}/audit-logs/
        """
        master = self.get_object()
        logs = master.audit_logs.select_related('changed_by').all()
        
        page = self.paginate_queryset(logs)
        if page is not None:
            serializer = MasterAuditLogSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = MasterAuditLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='tree')
    def tree(self, request: Request) -> Response:
        """
        Get hierarchical tree structure.
        
        GET /api/masters/tree/?type=DEPARTMENT&root_only=true
        """
        master_type = request.query_params.get('type')
        if not master_type:
            raise ValidationError({"type": _("Type parameter is required.")})
        
        queryset = Master.objects.filter(
            master_type__iexact=master_type,
            status=MasterStatus.ACTIVE
        )
        
        # Optional: return only root nodes
        if request.query_params.get('root_only') == 'true':
            queryset = queryset.filter(parent__isnull=True)
        
        serializer = MasterTreeSerializer(
            queryset, 
            many=True, 
            context={'request': request, 'depth': 0}
        )
        return Response(serializer.data)

    # ==========================================================================
    # HELPERS
    # ==========================================================================

    def _log_change(
        self, 
        master: Master, 
        action: AuditAction,
        old_data: Optional[Dict] = None,
        new_data: Optional[Dict] = None
    ) -> None:
        """Create audit log entry."""
        log_master_change(
            master=master,
            action=action.value,
            user=self.request.user,
            request=self.request,
            old_data=old_data,
            new_data=new_data
        )

    def _invalidate_cache(self, master_type: str) -> None:
        """Invalidate dropdown caches for a master type."""
        for status in MasterStatus:
            cache_key = f'masters_dropdown_{master_type}_{status.value}'
            cache.delete(cache_key)
        
        # Special case: projects depend on departments
        if master_type == MasterType.DEPARTMENT.value:
            cache.delete(f"masters_dropdown_{MasterType.PROJECT.value}_{MasterStatus.ACTIVE.value}")