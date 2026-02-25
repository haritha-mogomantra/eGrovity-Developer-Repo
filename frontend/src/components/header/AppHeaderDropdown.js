import React from "react";
import { Link } from "react-router-dom";
import {
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem,
} from "@coreui/react";

const AppHeaderDropdown = ({ userRole }) => {
  const first = localStorage.getItem("first_name") || "";
  const last = localStorage.getItem("last_name") || "";
  const fullName = `${first} ${last}`.trim() || "User";
  const role = (localStorage.getItem("role") || "").toLowerCase();

  // 🔹 PROFILE PICTURE STATE
  const [profilePicture, setProfilePicture] = React.useState(
    localStorage.getItem("profile_picture_url") || "/default-profile.png"
  );

  // 🔹 FETCH PROFILE PICTURE ON MOUNT
  React.useEffect(() => {
    const fetchProfilePicture = async () => {
      try {
        // First check localStorage for cached picture
        const cachedPicture = localStorage.getItem("profile_picture_url");
        if (cachedPicture) {
          setProfilePicture(cachedPicture);
        }

        const token = localStorage.getItem("access_token");
        const endpoint = role === "admin" 
          ? "/api/employee/admin/profile/" 
          : "/api/employee/profile/";
        
        const response = await fetch(`${process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000"}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const data = await response.json();

        // SUPPORT BOTH ADMIN & EMPLOYEE RESPONSE SHAPES
        const picture =
          data.profile_picture_url ||           // employee response
          data?.personal?.profile_picture_url;  // admin response

        if (picture) {
          const urlWithTimestamp = `${picture}?t=${new Date().getTime()}`;
          setProfilePicture(urlWithTimestamp);
          localStorage.setItem("profile_picture_url", urlWithTimestamp);
        }
      } catch (err) {
        console.log("Failed to fetch profile picture:", err);
      }
    };

    const token = localStorage.getItem("access_token");
      if (role && token) {
        fetchProfilePicture();
      }
  }, [role]);

  // 🔹 SEPARATE useEffect FOR EVENT LISTENER (THIS IS THE FIX)
  React.useEffect(() => {
    const handleProfileUpdate = () => {
      const updatedPicture = localStorage.getItem("profile_picture_url");
      console.log("Profile picture updated event received:", updatedPicture); // Debug log
      if (updatedPicture) {
        setProfilePicture(updatedPicture);
      }
    };

    window.addEventListener("profilePictureUpdated", handleProfileUpdate);

    // Cleanup
    return () => {
      window.removeEventListener("profilePictureUpdated", handleProfileUpdate);
    };
  }, []); // Empty dependency array - runs once and stays active
  
  return (
    <CDropdown variant="nav-item" placement="bottom-end">
      <CDropdownToggle caret className="fw-bold text-black d-flex align-items-center gap-2">
        <img
          src={profilePicture}
          alt="Profile"
          onError={() => setProfilePicture("/default-profile.png")}
          className="rounded-circle"
          style={{
            width: "32px",
            height: "32px",
            objectFit: "cover",
            border: "2px solid #e5e7eb"
          }}
        />
        <span>{fullName}</span>
      </CDropdownToggle>

      <CDropdownMenu className="pt-2">
        <CDropdownItem
          as={Link}
          to={role === "admin" ? "/pages/profile" : "/pages/employeeprofile"}
        >
          <i className="bi bi-person-circle me-2"></i> Profile
        </CDropdownItem>

        <CDropdownItem as={Link} to="/pages/change-password">
          <i className="bi bi-key me-2"></i> Change Password
        </CDropdownItem>

        <CDropdownItem
          as="button"
          className="text-danger"
          onClick={() => {
            localStorage.clear();
            window.location.href = "/#/login";
          }}
        >
          <i className="bi bi-box-arrow-right me-2 text-danger"></i> Logout
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  );
};

export default AppHeaderDropdown;