import React, { useEffect, useState } from "react";
import axios from "axios";
import Profile from "../../../components/profile/Profile";
 
const EmployeeProfile = () => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
 
  const token = localStorage.getItem("access_token");
  const userId = localStorage.getItem("userId"); // unique ID from login response
 
  const empId = localStorage.getItem("emp_id");  // from login

    useEffect(() => {
    const fetchEmployeeProfile = async () => {
        try {
        const response = await axios.get(
            `http://127.0.0.1:8000/api/employee/profile/`,
            {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            }
        );

        const d = response.data;

        setProfileData({
            title: "EMPLOYEE PROFILE",
            editable: true,

            personal: {
                emp_id: d.emp_id,
                first_name: d.first_name,
                last_name: d.last_name,
                email: d.email,
                contact_number: d.contact_number || "",
                gender: d.gender || "",
                dob: d.dob || "",
                profile_picture_url: d.profile_picture_url || "",
            },
            professional: {
                role: d.role,
                department: d.department,
                department_code: d.department_code,
                designation: d.designation,
                project_name: d.project_name,
                joining_date: d.joining_date,
                manager_name: d.manager_name,
                reporting_manager_name: d.manager_name,
            },

            address: {
                address_line1: d.address_line1 || "",
                address_line2: d.address_line2 || "",
                city: d.city || "",
                state: d.state || "",
                pincode: d.pincode || "",
            }
            });

        } catch (error) {
        console.error("Failed to fetch employee profile", error);
        } finally {
        setLoading(false);
        }
    };

    fetchEmployeeProfile();
    }, [empId, token]);

 
  if (loading) return <h4 className="text-center mt-4">Loading...</h4>;
  if (!profileData)
    return (
<h4 className="text-center text-danger mt-4">
        Failed to load employee profile
</h4>
    );
 
  return <Profile {...profileData} />;
};
 
export default EmployeeProfile;