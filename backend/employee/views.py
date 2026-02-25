# ===========================================================
# employee/views.py
# ===========================================================

from rest_framework import viewsets, status, permissions, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model
from rest_framework.pagination import PageNumberPagination
from django.db import transaction
from django.db.models import Q, F, Value, CharField
from django.db.models.functions import Coalesce, Concat
from django.db.models.functions import Coalesce, Concat, NullIf
from .models import Employee
from masters.models import Master, MasterType, MasterStatus

from .serializers import (
    EmployeeSerializer,
    EmployeeCreateUpdateSerializer,
    EmployeeCSVUploadSerializer,
    AdminProfileSerializer,
    ManagerProfileSerializer,
    EmployeeProfileSerializer,  
)

User = get_user_model()


# ===========================================================
# PAGINATION
# ===========================================================
class DefaultPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            "count": self.page.paginator.count,
            "next": self.get_next_link(),
            "previous": self.get_previous_link(),
            "current_page": self.page.number,
            "total_pages": self.page.paginator.num_pages,
            "results": data
        })

# ===========================================================
# EMPLOYEE VIEWSET
# ===========================================================
class EmployeeViewSet(viewsets.ModelViewSet):
    lookup_field = "emp_id"
    lookup_url_kwarg = "emp_id"
    queryset = Employee.objects.select_related("user", "department", "manager")
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DefaultPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status"]
    search_fields = [
        "user__first_name", "user__last_name", "user__emp_id",
        "designation", "contact_number", "department__name"
    ]
    ordering_fields = [
        "user__emp_id",
        "full_name",
        "designation",
        "manager_name",
        "department__name",
        "joining_sort",
        "user__email",
    ]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return EmployeeCreateUpdateSerializer
        return EmployeeSerializer

    def get_queryset(self):
        request = self.request
        user = request.user
        qs = Employee.objects.select_related("user", "department", "manager")

        employee = getattr(user, "employee_profile", None)
        role = employee.role.name if employee and employee.role else ""

        if role == "Manager":
            qs = qs.filter(manager=employee)
        elif role == "Employee":
            qs = qs.filter(user=user)

        department_param = request.query_params.get("department")
        if department_param:
            dept = Master.objects.filter(
                master_type=MasterType.DEPARTMENT
            ).filter(
                Q(name__iexact=department_param) |
                Q(code__iexact=department_param)
            ).first()

            if dept:
                qs = qs.filter(department=dept)
            else:
                qs = qs.none()


        manager_param = request.query_params.get("manager")
        if manager_param:
            manager_emp = Employee.objects.select_related("user").filter(
                Q(user__emp_id__iexact=manager_param) | Q(user__username__iexact=manager_param)
            ).first()
            qs = qs.filter(manager=manager_emp) if manager_emp else qs.none()


        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status__iexact=status_param.strip())

        qs = qs.annotate(
            full_name=Concat(
                "user__first_name",
                Value(" "),
                "user__last_name"
            ),
            manager_name=Concat(
                Coalesce(F("manager__user__first_name"), Value("")),
                Value(" "),
                Coalesce(F("manager__user__last_name"), Value("")),
                output_field=CharField()
            ),
            # ASC key → empty managers sorted LAST
            manager_sort_key_asc=Coalesce(
                NullIf(
                    Concat(
                        Coalesce(F("manager__user__first_name"), Value("")),
                        Value(" "),
                        Coalesce(F("manager__user__last_name"), Value("")),
                    ),
                    Value("")
                ),
                Value("ZZZZZZZZ"),    # ensures empty names go last on ASC
                output_field=CharField()
            ),

            # DESC key → empty managers still sorted LAST
            manager_sort_key_desc=Coalesce(
                NullIf(
                    Concat(
                        Coalesce(F("manager__user__first_name"), Value("")),
                        Value(" "),
                        Coalesce(F("manager__user__last_name"), Value("")),
                    ),
                    Value("")
                ),
                Value("00000000"),    # ensures empty names go last on DESC
                output_field=CharField()
            ),
            joining_sort=F("joining_date")
        )

        return qs


    def list(self, request, *args, **kwargs):
        """
        Ensures pagination always respects search + filters + ordering together.
        This is enterprise-standard DRF behavior enforcement.
        """

        queryset = self.filter_queryset(self.get_queryset())

        # ===================== CUSTOM NULLS-LAST SORTING FIX ======================
        ordering = request.query_params.get("ordering")

        if ordering == "manager_name":
            queryset = queryset.order_by("manager_sort_key_asc")

        elif ordering == "-manager_name":
            queryset = queryset.order_by("-manager_sort_key_desc")

        # ==========================================================================

        # Continue normal flow
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
 

    def get_object(self):
        emp_id = self.kwargs.get("emp_id")

        if not emp_id:
            raise ValidationError("Employee ID is required.")

        emp_id = emp_id.strip().upper()

        if emp_id.startswith("EMP") and not emp_id[3:].isdigit():
            raise ValidationError("Invalid emp_id format. Expected EMPxxxx.")

        try:
            return Employee.objects.select_related(
                "user", "department", "manager"
            ).get(user__emp_id__iexact=emp_id, is_deleted=False)

        except Employee.DoesNotExist:
            raise NotFound(f"Employee with emp_id '{emp_id}' not found.")


    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        employee.refresh_from_db()

        total_count = Employee.objects.filter(status="Active", is_deleted=False).count()

        return Response({
            "message": "Employee created successfully.",
            "employee": EmployeeSerializer(employee, context={"request": request}).data,
            "total_employees": total_count  
        }, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        employee = self.get_object()
        user = request.user
        requester = getattr(user, "employee_profile", None)
        if requester and requester.role.name == "Manager" and employee.manager != requester:
            return Response({"error": "Managers can update only their own team members."},
                            status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(employee, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)

        employee._action_user = request.user
        
        serializer.save()
        employee.refresh_from_db()

        return Response({"message": "Employee updated successfully.",
                         "employee": EmployeeSerializer(employee, context={"request": request}).data},
                        status=status.HTTP_200_OK)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        employee = self.get_object()

        if employee.is_deleted:
            return Response(
                {"error": "Employee is already deleted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        actor = request.user

        employee.soft_delete(
            action_by=actor,
            reason="Deactivated by admin"
        )

        return Response(
            {"message": "Employee deactivated successfully."},
            status=status.HTTP_200_OK
        )


    @action(detail=False, methods=["GET"], url_path="managers")
    def list_managers(self, request):
        dept_name = request.query_params.get("department_name")

        managers = Employee.objects.select_related("user", "department").filter(
            Q(role__name__in=["Manager", "Admin"]),
            status="Active"
        )

        #FILTER BY DEPARTMENT WHEN PROVIDED
        if dept_name:
            dept = Master.objects.filter(
                master_type=MasterType.DEPARTMENT,
                name__iexact=dept_name
            ).first()

            if dept:
                managers = managers.filter(department=dept)
            else:
                managers = managers.none()

        managers = managers.order_by("user__first_name")

        return Response([
            {
                "emp_id": emp.user.emp_id,
                "full_name": f"{emp.user.first_name} {emp.user.last_name}".strip(),
                "department": emp.department.name
            }
            for emp in managers
        ], status=status.HTTP_200_OK)
# ===========================================================
# ADMIN PROFILE VIEW
# ===========================================================
class AdminProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response({"error": "Profile not found for this user."},
                            status=status.HTTP_404_NOT_FOUND)


        # AUTO-CREATE EMPLOYEE PROFILE FOR ADMIN IF MISSING
        employee = getattr(user, "employee_profile", None)

        if not employee:
            # Try active department first, fallback to first available
            return Response(
                {"error": "Employee profile not found. Contact administrator."},
                status=status.HTTP_409_CONFLICT
            )

        serializer = AdminProfileSerializer(employee, context={"request": request})
        data = serializer.data

        return Response({
            "personal": data.get("personal", {}),
            "professional": data.get("professional", {}),
            "address": data.get("address", {})
        }, status=status.HTTP_200_OK)

    @transaction.atomic
    def patch(self, request):
        user = request.user

        # User can update only their own profile
        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response({"error": "Profile not found for this user."},
                            status=status.HTTP_404_NOT_FOUND)

        # AUTO-CREATE EMPLOYEE PROFILE IF MISSING
        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response(
                {"error": "Employee profile not found. Contact administrator."},
                status=status.HTTP_409_CONFLICT
            )

        serializer = AdminProfileSerializer(employee, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        data = serializer.data

        return Response({
            "profile_picture_url": data.get("personal", {}).get("profile_picture_url"),
            **data  # return original grouped sections
        }, status=status.HTTP_200_OK)


    def put(self, request):
        return self.patch(request)

# ===========================================================
# MANAGER PROFILE VIEW
# ===========================================================
class ManagerProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response({"error": "Profile not found for this user."},
                            status=status.HTTP_404_NOT_FOUND)

        
        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response({"error": "Employee record not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ManagerProfileSerializer(employee, context={"request": request})
        data = serializer.data
        return Response({
            "profile_picture_url": data.get("profile_picture_url"),   # manager serializer is flat
            **data
        }, status=status.HTTP_200_OK)


    @transaction.atomic
    def patch(self, request):
        user = request.user
        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response({"error": "Profile not found for this user."},
                            status=status.HTTP_404_NOT_FOUND)


        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response({"error": "Employee record not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ManagerProfileSerializer(employee, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        return self.patch(request)


# ===========================================================
# EMPLOYEE PROFILE VIEW
# ===========================================================
class EmployeeProfileView(APIView):
    """API for Employee personal profile (view/update)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response({"error": "Profile not found for this user."},
                            status=status.HTTP_404_NOT_FOUND)


        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response({"error": "Employee record not found for this user."}, status=status.HTTP_404_NOT_FOUND)

        serializer = EmployeeProfileSerializer(employee, context={"request": request})
        data = serializer.data
        return Response({
            "profile_picture_url": data.get("profile_picture_url"),
            **data
        }, status=status.HTTP_200_OK)


    @transaction.atomic
    def patch(self, request):
        user = request.user
        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response({"error": "Profile not found for this user."},
                            status=status.HTTP_404_NOT_FOUND)


        employee = getattr(user, "employee_profile", None)
        if not employee:
            return Response({"error": "Employee record not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = EmployeeProfileSerializer(employee, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        return self.patch(request)


# ===========================================================
# EMPLOYEE BULK CSV UPLOAD VIEW
# ===========================================================
class EmployeeCSVUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        employee = getattr(request.user, "employee_profile", None)
        if not (request.user.is_superuser or (employee and employee.role.name == "Admin")):
            return Response(
                {"error": "Only Admins can upload employee CSV files."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = EmployeeCSVUploadSerializer(
            data=request.data,
            context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        return Response({
            "message": "Employee CSV processed successfully.",
            "uploaded_count": result.get("success_count", 0),
            "errors": result.get("errors", []),
        }, status=status.HTTP_201_CREATED)
    

    @action(detail=False, methods=["POST"], url_path="upload_csv")
    @transaction.atomic
    def upload_csv(self, request):
        employee = getattr(request.user, "employee_profile", None)
        if not (request.user.is_superuser or (employee and employee.role.name == "Admin")):
            return Response(
                {"error": "Only Admins can upload employee CSV files."},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = EmployeeCSVUploadSerializer(
            data=request.data,
            context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        total_employees = Employee.objects.filter(status="Active", is_deleted=False).count()

        return Response({
            "message": f"CSV processed successfully. {result.get('success_count', 0)} added.",
            "errors": result.get("errors", []),
            "total_employees": total_employees  # aSSllows frontend to jump to last page
        }, status=status.HTTP_200_OK)
