import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import axiosInstance from "../../../utils/axiosInstance";

export default function Login() {
    

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState({ show: false, message: "", type: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axiosInstance.post("users/login/", {
        username,
        password,
    });

      console.log("Response:", response.data);

      if (response.status === 200 && response.data.access) {
        const {
          access,
          refresh,
          emp_id,
          username,
          role,
          first_name,
          last_name,
          full_name
        } = response.data;

        // Save tokens
        localStorage.setItem("access_token", access);
        localStorage.setItem("refresh_token", refresh);

        // Save user info
        localStorage.setItem("emp_id", emp_id || "");
        localStorage.setItem("userId", emp_id || "");
        localStorage.setItem("username", username || "");
        localStorage.setItem("role", role?.toLowerCase() || "");

        // Save names
        localStorage.setItem("first_name", first_name || "");
        localStorage.setItem("last_name", last_name || "");

        // Build full name dynamically
        localStorage.setItem(
          "full_name",
          `${first_name || ""} ${last_name || ""}`.trim()
        );

        // Required for PerformanceMetrics role check
        localStorage.setItem(
          "user",
          JSON.stringify({
            emp_id,
            username,
            role: role?.toLowerCase() || "",
            full_name: `${first_name || ""} ${last_name || ""}`.trim(),
          })
        );

        // ✅ STORE PROFILE PICTURE FOR HEADER (PERSIST AFTER RE-LOGIN)
        if (response.data.profile_picture_url) {
          localStorage.setItem(
            "profile_picture_url",
            response.data.profile_picture_url
          );
        } else {
          localStorage.setItem("profile_picture_url", "/default-profile.png");
        }

        setAlert({
          show: true,
          message: `Welcome ${role}! Login successful.`,
          type: "success",
        });

        setTimeout(() => {
          if (role === "admin" || role === "manager") {
            navigate("/dashboard");
          } else {
            navigate("/employee-dashboard");
          }
        }, 1000);

      } else { setAlert({
          show: true,
          message: response.data.message || "Invalid credentials!",
          type: "danger",
        });
      }
    } catch (error) {
      console.error("Login Error:", error);
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Server error! Please try again later.";

      setAlert({
        show: true,
        message,
        type: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5 d-flex justify-content-center align-items-center">
      <div
        className="card shadow-lg p-4"
        style={{ width: "400px", borderRadius: "15px" }}
      >
        <h3 className="text-center mb-4 text-primary">LOGIN</h3>

        {alert.show && (
          <div
            className={`alert alert-${alert.type} alert-dismissible fade show`}
            role="alert"
          >
            {alert.message}
            <button
              type="button"
              className="btn-close"
              onClick={() => setAlert({ show: false, message: "", type: "" })}
            ></button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-bold">
              Username
            </label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your username, emp ID, or email"
              disabled={loading}
            />
          </div>

          <div className="mb-3">
            <label className="form-label fw-bold">Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 d-flex justify-content-center align-items-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <div className="text-center mt-3 text-muted small">© 2025 eGrovity</div>
      </div>
    </div>
  );
}
