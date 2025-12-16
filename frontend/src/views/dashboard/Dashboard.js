/*
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";
import EmployeeDashboard from "./EmployeeDashboard";
import "bootstrap/dist/css/bootstrap.min.css";


function Dashboard() {
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(true);
  const [authError, setAuthError] = useState(null);

  const role = localStorage.getItem("role");
  const empId = localStorage.getItem("emp_id");
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");

  useEffect(() => {
    validateAccess();
  }, []);


  const validateAccess = () => {
    // Check for required authentication data
    if (!token) {
      setAuthError("No authentication token found. Please log in.");
      setTimeout(() => navigate("/login"), 2000);
      return;
    }

    if (!role) {
      setAuthError("User role not found. Please log in again.");
      setTimeout(() => navigate("/login"), 2000);
      return;
    }

    if (!empId) {
      setAuthError("Employee ID not found. Please log in again.");
      setTimeout(() => navigate("/login"), 2000);
      return;
    }

    // Validate role is one of the expected values
    const validRoles = ["Admin", "Manager", "Employee"];
    if (!validRoles.includes(role)) {
      setAuthError("Invalid user role. Please contact support.");
      setTimeout(() => navigate("/login"), 2000);
      return;
    }

    setIsValidating(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  // Loading state while validating
  if (isValidating) {
    return (
      <div className="container-fluid d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Validating access...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (authError) {
    return (
      <div className="container-fluid d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
        <div className="card shadow-lg" style={{ maxWidth: "500px" }}>
          <div className="card-body text-center p-5">
            <div className="text-danger mb-3">
              <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: "3rem" }}></i>
            </div>
            <h4 className="card-title text-danger mb-3">Access Denied</h4>
            <p className="card-text text-muted mb-4">{authError}</p>
            <button className="btn btn-primary" onClick={handleLogout}>
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Route to appropriate dashboard
  switch (role) {
    case "Employee":
      return <EmployeeDashboard />;
    
    case "Manager":
    case "Admin":
      return <AdminDashboard />;
    
    default:
      // Fallback (should never reach here due to validation)
      return (
        <div className="container-fluid">
          <div className="alert alert-warning mt-4" role="alert">
            <h5 className="alert-heading">Unknown Role</h5>
            <p>Unable to determine dashboard for role: <strong>{role}</strong></p>
            <hr />
            <button className="btn btn-outline-warning" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      );
  }
}

export default Dashboard;
*/

/*
import React from "react";
import AdminDashboard from "./AdminDashboard";
import EmployeeDashboard from "./EmployeeDashboard";

function Dashboard() {
  const role = localStorage.getItem("role")?.toLowerCase();

  if (role === "employee") {
    return <EmployeeDashboard />;
  }

  // admin & manager
  return <AdminDashboard />;
}

export default Dashboard;
*/

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role")?.toLowerCase();
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token || !role) {
      navigate("/login", { replace: true });
      return;
    }

    if (role === "employee") {
      navigate("/employee-dashboard", { replace: true });
    } else {
      navigate("/admin-dashboard", { replace: true });
    }
  }, []);

  return null;
}

export default Dashboard;