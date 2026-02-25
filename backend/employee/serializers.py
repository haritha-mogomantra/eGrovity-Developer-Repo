# ===========================================================
# employee/serializers.py
# ===========================================================
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db import transaction, models
from django.db.models import Q
from django.utils import timezone
from .models import Employee
from masters.models import Master, MasterType
from masters.models import MasterStatus
import re, csv, io, os
from datetime import datetime, date
from django.db import IntegrityError


User = get_user_model()


# ===========================================================
# USER SUMMARY SERIALIZER
# ===========================================================
class UserSummarySerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "emp_id", "first_name", "last_name", "full_name", "email"]

    def get_full_name(self, obj):
        return f"{obj.first_name or ''} {obj.last_name or ''}".strip()


# ===========================================================
# EMPLOYEE SERIALIZER (Read + Write)
# ===========================================================
class EmployeeSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    department = serializers.CharField(source="department.name", read_only=True)
    full_name = serializers.SerializerMethodField(read_only=True)
    email = serializers.ReadOnlyField(source="user.email")
    department_name = serializers.ReadOnlyField(source="department.name")
    manager_name = serializers.SerializerMethodField(read_only=True)
    manager_emp_id = serializers.CharField(source="manager.user.emp_id", read_only=True)
    team_size = serializers.SerializerMethodField(read_only=True)
    status = serializers.SerializerMethodField()
    designation = serializers.CharField(read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id", "user", "emp_id", "full_name", "email", "contact_number",
            "department", "department_name",
            "manager_name", "manager_emp_id",
            "designation",
            "status", "joining_date",
            "team_size", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    # ===========================================================
    # READ HELPERS
    # ===========================================================
    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()

    def get_manager_name(self, obj):
        if obj.manager and hasattr(obj.manager, "user"):
            return f"{obj.manager.user.first_name} {obj.manager.user.last_name}".strip()
        return "Not Assigned"

    def get_team_size(self, obj):
        return Employee.objects.filter(manager=obj, is_deleted=False).count()
    
    def get_status(self, obj):
        if obj.is_deleted:
            return "Inactive"
        return obj.status or "Active"

    # ===========================================================
    # WRITE VALIDATION (accepts emp_id or full name)
    # ===========================================================
    def validate_manager(self, value):

        if not value:
            return None

        # ✅ Try lookup by emp_id first
        manager = Employee.objects.filter(user__emp_id__iexact=value, is_deleted=False).first()
        if manager:
            return manager

        # ✅ Try flexible name-based search (handles 2–3 part names)
        name = value.strip()
        name_parts = name.split()

        if len(name_parts) >= 2:
            first_part = name_parts[0]
            last_part = name_parts[-1]

            manager = Employee.objects.filter(
                Q(user__first_name__icontains=first_part) &
                Q(user__last_name__icontains=last_part),
                is_deleted=False
            ).first()
        else:
            # Fallback: match any name part (first or last)
            manager = Employee.objects.filter(
                Q(user__first_name__icontains=name) |
                Q(user__last_name__icontains=name),
                is_deleted=False
            ).first()

        if manager:
            return manager

        raise serializers.ValidationError(f"Manager '{value}' not found.")

    # ===========================================================
    # OVERRIDE CREATE & UPDATE (to support manager resolution)
    # ===========================================================
    def create(self, validated_data):
        manager = validated_data.pop("manager", None)
        if manager and isinstance(manager, str):
            validated_data["manager"] = self.validate_manager(manager)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        manager = validated_data.pop("manager", None)
        if manager and isinstance(manager, str):
            validated_data["manager"] = self.validate_manager(manager)
        return super().update(instance, validated_data)
    
    def to_representation(self, instance):
        data = super().to_representation(instance)

        # If soft-deleted, force status to Inactive
        if instance.is_deleted:
            data["status"] = "Inactive"

        data["full_name"] = data.get("full_name") or ""
        data["department_name"] = data.get("department_name") or ""
        data["designation"] = data.get("designation") or ""
        data["manager_name"] = data.get("manager_name") or ""
        data["emp_id"] = data.get("emp_id") or ""
        data["status"] = data.get("status") or "Active"

        return data


# ===========================================================
# EMPLOYEE CREATE / UPDATE SERIALIZER
# ===========================================================

class EmployeeCreateUpdateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    first_name = serializers.CharField(write_only=True)
    last_name = serializers.CharField(write_only=True)
    department_name = serializers.CharField(write_only=True, required=True)
    manager = serializers.CharField(write_only=True, required=False, allow_blank=True)
    designation = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True
    )

    # Allow multiple joining_date input formats (handles all business cases)
    joining_date = serializers.DateField(
        input_formats=["%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"],
        required=True
    )

    class Meta:
        model = Employee
        fields = [
            "id", "email", "first_name", "last_name",
            "contact_number", "department_name", "manager", "designation",
            "joining_date",
        ]

    def validate_first_name(self, value):
        value = value.strip()

        # Only alphabets
        if not re.match(r"^[A-Za-z]+$", value):
            raise serializers.ValidationError(
                "First name must contain only alphabets (A–Z)."
            )

        # Minimum 3 letters
        if len(value) < 3:
            raise serializers.ValidationError(
                "First name must contain at least 3 letters."
            )

        return value.title()

    def validate_last_name(self, value):
        value = value.strip()

        # Last name is mandatory
        if not value:
            raise serializers.ValidationError("Last name is required.")

        # Allow alphabets and spaces
        if not re.match(r"^[A-Za-z ]+$", value):
            raise serializers.ValidationError(
                "Last name must contain only alphabets and spaces."
            )

        return value.title()

    def validate_joining_date(self, value):
        today = date.today()

        if value > today:
            raise serializers.ValidationError("Joining date cannot be in the future.")

        return value

    def validate_contact_number(self, value):
        if not value:
            return value
        pattern = r"^\+91[6-9]\d{9}$"
        if not re.match(pattern, value):
            raise serializers.ValidationError("Contact number must start with +91 and be valid.")
        qs = Employee.objects.filter(contact_number=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This contact number is already used.")
        return value

    def validate(self, attrs):
        mandatory_fields = ["first_name", "last_name", "email", "department_name", "joining_date"]
        missing = [f for f in mandatory_fields if not attrs.get(f)]
        if missing:
            raise serializers.ValidationError({
                "error": f"Missing mandatory fields: {', '.join(missing)}"
            })

        dept_name = attrs.get("department_name").strip()

        department = Master.objects.filter(
            name__iexact=dept_name,
            master_type=MasterType.DEPARTMENT,
            status=MasterStatus.ACTIVE
        ).first()
        if not department:
            raise serializers.ValidationError({
                "department_name": f"Department '{dept_name}' not found or inactive."
            })

        attrs["department"] = department

        designation_value = attrs.get("designation")

        if designation_value:
            attrs["designation"] = designation_value.strip().title()

        return attrs


    @transaction.atomic
    def create(self, validated_data):
        department = validated_data.pop("department")
        validated_data.pop("department_name", None)
        manager_emp_id = validated_data.pop("manager", None)
        email = validated_data.pop("email")
        first_name = validated_data.pop("first_name").strip().title()
        last_name = validated_data.pop("last_name").strip().title()


        if not department:
           raise serializers.ValidationError({"department_name": "Department not found or inactive."})

        if manager_emp_id in ["", None, "None", "null"]:
            manager_emp_id = None

        manager = None
        if manager_emp_id and manager_emp_id.strip():
            manager = Employee.objects.filter(user__emp_id__iexact=manager_emp_id).first()
            if not manager or manager.role.name not in ["Manager", "Admin"]:
                raise serializers.ValidationError({"manager": "Assigned manager must have role 'Manager' or 'Admin'."})
            
        if manager and manager.department != department:
            raise serializers.ValidationError({
                "manager": "Manager must belong to the same department"
            })

        # ✅ emp_id belongs to USER, not Employee
        admin_emp_id = self.initial_data.get("emp_id")
        if not admin_emp_id:
            raise serializers.ValidationError({"emp_id": "Employee ID is required (Manual Entry Mode)."})

        try:
            user = User.objects.create_user(
                username=admin_emp_id,
                emp_id=admin_emp_id,
                email=email,
                first_name=first_name,
                last_name=last_name,
                department=department
            )
        except IntegrityError as e:
            error_msg = str(e)

            if "users_user.email" in error_msg:
                raise serializers.ValidationError({
                    "email": "A user with this email already exists."
                })

            if "users_user.emp_id" in error_msg:
                raise serializers.ValidationError({
                    "emp_id": "Employee ID already exists."
                })

            raise serializers.ValidationError({
                "error": "User creation failed due to database constraint."
            })

        validated_data.pop("emp_id", None)

        employee_role = Master.objects.filter(
            master_type=MasterType.ROLE,
            name__iexact="Employee",
            status=MasterStatus.ACTIVE
        ).first()

        if not employee_role:
            raise serializers.ValidationError("Default Employee role not configured")
        
        request = self.context.get("request")
        actor = request.user if request else None

        employee = Employee(
            user=user,
            department=department,
            role=employee_role,
            manager=manager,
            **validated_data,
        )

        employee.save()
        return employee

    @transaction.atomic
    def update(self, instance, validated_data):
        department = validated_data.pop("department", None)
        manager_emp_id = validated_data.pop("manager", None)

        if department:
            instance.department = department

        if manager_emp_id and manager_emp_id.strip():
            name = manager_emp_id.strip()
            manager = Employee.objects.filter(user__emp_id__iexact=name, is_deleted=False).first()

            if not manager:
                name_parts = name.split()
                if len(name_parts) >= 2:
                    manager = Employee.objects.filter(
                        Q(user__first_name__icontains=name_parts[0]) &
                        Q(user__last_name__icontains=name_parts[-1]),
                        is_deleted=False
                    ).first()
                else:
                    manager = Employee.objects.filter(
                        Q(user__first_name__icontains=name) |
                        Q(user__last_name__icontains=name),
                        is_deleted=False
                    ).first()

            if not manager:
                raise serializers.ValidationError({"manager": f"Manager '{manager_emp_id}' not found."})
            if manager.role.name not in ["Manager", "Admin"]:
                raise serializers.ValidationError({"manager": "Assigned manager must be Manager/Admin."})

            instance.manager = manager

        user = instance.user
        if "first_name" in validated_data:
            user.first_name = validated_data.pop("first_name")
        if "last_name" in validated_data:
            user.last_name = validated_data.pop("last_name")
        if "email" in validated_data:
            user.email = validated_data.pop("email")
        user.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


# ===========================================================
# COMMON IMAGE VALIDATION
# ===========================================================
def validate_image_file(value):
    if value:
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png"]:
            raise serializers.ValidationError("Only JPG and PNG images are allowed.")
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("Profile picture size must not exceed 2MB.")
    return value

# ===========================================================
# ADMIN PROFILE SERIALIZER
# ===========================================================
class AdminProfileSerializer(serializers.ModelSerializer):
    emp_id = serializers.CharField(source="user.emp_id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=False)
    last_name = serializers.CharField(source="user.last_name", required=False)
    email = serializers.EmailField(source="user.email", required=False)
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "emp_id", "first_name", "last_name", "email",
            "department", "designation", "joining_date", "status",
            "contact_number", "gender", "dob", 
            "profile_picture", "profile_picture_url",
            "address_line1", "address_line2", "city", "state", "pincode",
        ]
        read_only_fields = ["emp_id", "department", "status"]

    def get_profile_picture_url(self, obj):
        request = self.context.get("request")
        if obj.profile_picture and hasattr(obj.profile_picture, "url"):
            return request.build_absolute_uri(obj.profile_picture.url) if request else obj.profile_picture.url
        return None

    def validate_profile_picture(self, value):
        return validate_image_file(value)

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        user = instance.user
        for field, value in user_data.items():
            setattr(user, field, value)
        user.save()

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
    
    def to_representation(self, instance):
        d = super().to_representation(instance)

        return {
            "personal": {
                "emp_id": d.get("emp_id"),
                "first_name": d.get("first_name"),
                "last_name": d.get("last_name"),
                "gender": d.get("gender"),
                "dob": d.get("dob"),
                "contact_number": d.get("contact_number"),
                "email": d.get("email"),
                "profile_picture_url": d.get("profile_picture_url"),
            },
            "professional": {
                "department": d.get("department"),
                "designation": d.get("designation"),
                "joining_date": d.get("joining_date"),
                "status": d.get("status"),
            },
            "address": {
                "address_line1": d.get("address_line1"),
                "address_line2": d.get("address_line2"),
                "city": d.get("city"),
                "state": d.get("state"),
                "pincode": d.get("pincode"),
            }
        }



# ===========================================================
# MANAGER PROFILE SERIALIZER
# ===========================================================
class ManagerProfileSerializer(serializers.ModelSerializer):
    emp_id = serializers.CharField(source="user.emp_id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=False)
    last_name = serializers.CharField(source="user.last_name", required=False)
    email = serializers.EmailField(source="user.email", required=False)
    department = serializers.CharField(source="department.name", read_only=True)
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "emp_id", "first_name", "last_name", "email", "gender",
            "department", "designation", "joining_date", "status",
            "contact_number", "dob", "profile_picture", "profile_picture_url",
            "address_line1", "address_line2", "city", "state", "pincode",
        ]
        read_only_fields = ["emp_id", "department", "status"]

    def get_profile_picture_url(self, obj):
        request = self.context.get("request")
        if obj.profile_picture and hasattr(obj.profile_picture, "url"):
            return request.build_absolute_uri(obj.profile_picture.url) if request else obj.profile_picture.url
        return None

    def validate_profile_picture(self, value):
        return validate_image_file(value)

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        user = instance.user
        for field, value in user_data.items():
            setattr(user, field, value)
        user.save()

        for field, value in validated_data.items():
            setattr(instance, field, value)
        request = self.context.get("request")
        if request:
            instance.updated_by = request.user

        instance.save()
        return instance


# ===========================================================
# EMPLOYEE PROFILE SERIALIZER
# ===========================================================
class EmployeeProfileSerializer(serializers.ModelSerializer):
    emp_id = serializers.CharField(source="user.emp_id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=False)
    last_name = serializers.CharField(source="user.last_name", required=False)
    email = serializers.EmailField(source="user.email", required=False)
    department = serializers.CharField(source="department.name", read_only=True)
    manager_name = serializers.SerializerMethodField()
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "emp_id", "first_name", "last_name", "email", "gender",
            "contact_number", "dob", "profile_picture", "profile_picture_url",
            "department", "designation",
            "joining_date", "manager_name", "status",
            "address_line1", "address_line2", "city", "state", "pincode",
        ]
        read_only_fields = ["emp_id", "department", "status", "manager_name"]

    def get_manager_name(self, obj):
        if obj.manager and hasattr(obj.manager, "user"):
            return f"{obj.manager.user.first_name} {obj.manager.user.last_name}".strip()
        return "Not Assigned"

    def get_profile_picture_url(self, obj):
        request = self.context.get("request")
        if obj.profile_picture and hasattr(obj.profile_picture, "url"):
            return request.build_absolute_uri(obj.profile_picture.url) if request else obj.profile_picture.url
        return None

    def validate_profile_picture(self, value):
        return validate_image_file(value)

    @transaction.atomic
    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        for attr, val in user_data.items():
            setattr(instance.user, attr, val)
        instance.user.save()

        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        return instance


# ===========================================================
# EMPLOYEE BULK CSV UPLOAD SERIALIZER (Enhanced)
# ===========================================================
class EmployeeCSVUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        if not value.name.endswith(".csv"):
            raise serializers.ValidationError("Only CSV files are allowed.")
        return value

    def create(self, validated_data):
        file = validated_data["file"]
        decoded_file = file.read().decode("utf-8")
        io_string = io.StringIO(decoded_file)
        reader = csv.DictReader(io_string)

        # Normalize CSV headers (case-insensitive)
        normalized_rows = []
        for row in reader:
            fixed_row = {}
            for key, value in row.items():
                key_clean = key.strip().lower().replace("_", " ").title()
                fixed_row[key_clean] = value.strip() if value else ""
            normalized_rows.append(fixed_row)

        if not normalized_rows:
            raise serializers.ValidationError({"error": "CSV file is empty."})

        # ----- FIXED HEADER DETECTION ----------
        # Normalize entire header map (lowercase keys → original keys)
        normalized_header_map = {k.strip().lower(): k for k in normalized_rows[0].keys()}

        # Mandatory fields (case insensitive now)
        required_cols = ["first name", "last name", "email", "joining date", "department"]
        missing = [col for col in required_cols if col not in normalized_header_map]
        if missing:
            raise serializers.ValidationError({"error": f"CSV missing columns: {', '.join(missing)}"})

        # Department column (Department NAME only)
        if "department" in normalized_header_map:
            dept_key = normalized_header_map["department"]
        else:
            raise serializers.ValidationError({
                "error": "CSV must contain a 'Department' column (Department Name)."
            })

        if missing:
            raise serializers.ValidationError({"error": f"CSV must contain: {', '.join(required_cols)}"})

        success_count, errors = 0, []
        seen_emails, seen_name_dept = set(), set()

        with transaction.atomic():
            for i, row in enumerate(normalized_rows, start=2):
                try:
                    # Extract & clean values
                    email = row.get("Email", "").lower()
                    first_name = row.get("First Name", "").strip().title()
                    last_name = row.get("Last Name", "").strip().title()
                    dept_code = row.get(dept_key, "").strip()
                    joining_date_str = row.get("Joining Date", "").strip()
                    contact_number = row.get("Contact Number") or None
                    designation = row.get("Designation") or None

                    if designation:
                        designation = designation.strip().title()

                    manager_emp_id = row.get("Manager") or None

                    # 1️⃣ Mandatory Field Validation
                    if not all([email, first_name, last_name, dept_code, joining_date_str]):
                        errors.append(
                            f"Row {i}: Missing mandatory fields "
                            f"(First Name, Last Name, Email, Department, Joining Date)."
                        )
                        continue

                    # 3️⃣ Prevent duplicate email within file
                    if email in seen_emails:
                        errors.append(f"Row {i}: Duplicate email '{email}' in CSV.")
                        continue
                    seen_emails.add(email)

                    dept_name = dept_code.strip()

                    department = Master.objects.filter(
                        name__iexact=dept_name,
                        master_type=MasterType.DEPARTMENT,
                        status=MasterStatus.ACTIVE
                    ).first()

                    if not department:
                        errors.append(f"Row {i}: Department '{dept_name}' not found.")
                        continue


                    if User.objects.filter(
                        Q(email__iexact=email),
                        ~Q(employee_profile__is_deleted=True)
                    ).exists():

                        errors.append(f"Row {i}: Email '{email}' already exists in system.")
                        continue

                    # 6️⃣ Validate Joining Date format
                    for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
                        try:
                            joining_date = datetime.strptime(joining_date_str, fmt).date()
                            break
                        except ValueError:
                            joining_date = None

                    if not joining_date:
                        errors.append(f"Row {i}: Joining Date must be YYYY-MM-DD or DD-MM-YYYY.")
                        continue

                    # 7️⃣ Validate Duplicate Employee (Same Name + Dept)
                    name_dept_key = f"{first_name.lower()}_{last_name.lower()}_{department.id}"
                    if name_dept_key in seen_name_dept:
                        errors.append(f"Row {i}: Duplicate employee '{first_name} {last_name}' in same department in file.")
                        continue
                    seen_name_dept.add(name_dept_key)

                    if Employee.objects.filter(
                        user__first_name__iexact=first_name,
                        user__last_name__iexact=last_name,
                        department=department,
                        is_deleted=False
                    ).exists():
                        errors.append(
                            f"Row {i}: Employee '{first_name} {last_name}' already exists in department '{department.name}'."
                        )
                        continue

                    # Create User & Employee
                    admin_emp_id = row.get("Emp Id") or row.get("Employee Id")

                    if not admin_emp_id:
                        raise serializers.ValidationError({"emp_id": "Employee ID is required (Manual Entry Mode)."})

                    # 8️⃣ Manager Validation (Accepts Full Name OR Emp ID)
                    manager = None

                    if manager_emp_id and str(manager_emp_id).strip().lower() not in ["none", "null"]:
                        manager_value = manager_emp_id.strip()

                        # 1️⃣ Try Emp ID
                        manager = Employee.objects.filter(
                            user__emp_id__iexact=manager_value,
                            is_deleted=False
                        ).first()

                        # 2️⃣ Try Full Name (First + Last)
                        if not manager:
                            name_parts = manager_value.split()
                            if len(name_parts) >= 2:
                                manager = Employee.objects.filter(
                                    Q(user__first_name__iexact=name_parts[0]) &
                                    Q(user__last_name__iexact=name_parts[-1]),
                                    is_deleted=False
                                ).first()

                        # 3️⃣ Final validation
                        if not manager:
                            errors.append(
                                f"Row {i}: Manager '{manager_value}' not found (use full name or emp_id)."
                            )
                            continue

                        # 4️⃣ Role check
                        if manager.role.name not in ["Manager", "Admin"]:
                            errors.append(
                                f"Row {i}: Manager '{manager_value}' must have role Manager/Admin."
                            )
                            continue

                        # 5️⃣ Manager must belong to same department
                        if manager.department != department:
                            errors.append(
                                f"Row {i}: Manager must belong to the same department."
                            )
                            continue

                        # 6️⃣ Prevent self-manager assignment
                        if manager.user.emp_id == admin_emp_id:
                            errors.append(
                                f"Row {i}: Employee cannot be their own manager."
                            )
                            continue


                    # 9️⃣ Contact number validation
                    if contact_number:
                        pattern = r"^\+91[6-9]\d{9}$"
                        if not re.match(pattern, contact_number):
                            errors.append(f"Row {i}: Contact number '{contact_number}' must start with +91 and be valid.")
                            continue
                    
                    if User.objects.filter(emp_id=admin_emp_id).exists():
                        errors.append(f"Row {i}: Employee ID '{admin_emp_id}' already exists.")
                        continue

                    user = User.objects.create_user(
                        username=admin_emp_id,
                        emp_id=admin_emp_id,
                        email=email,
                        first_name=first_name,
                        last_name=last_name,
                        department=department
                    )

                    employee_role = Master.objects.filter(
                        master_type=MasterType.ROLE,
                        name__iexact="Employee",
                        status=MasterStatus.ACTIVE
                    ).first()

                    if not employee_role:
                        errors.append(f"Row {i}: Default Employee role not configured.")
                        continue

                    request = self.context.get("request")
                    actor = request.user if request else None

                    employee = Employee(
                        user=user,
                        department=department,
                        role=employee_role,
                        manager=manager,
                        designation=designation,
                        contact_number=contact_number,
                        joining_date=joining_date,
                        status="Active",
                    )
                    employee.save()

                    success_count += 1

                except Exception as e:
                    errors.append(f"Row {i}: Unexpected error - {str(e)}")

        return {"success_count": success_count, "errors": errors}