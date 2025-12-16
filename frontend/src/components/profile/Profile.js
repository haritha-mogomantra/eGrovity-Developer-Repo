import React, { useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

const DEFAULT_PROFILE = "/default-profile.png";

// ADD THIS VALIDATION FUNCTION HERE ⬇️
const validateProfilePicture = (file) => {
  const maxSize = 2 * 1024 * 1024; // 2MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 2MB' };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only JPG, PNG, and WEBP formats are allowed' };
  }
  
  return { valid: true };
};

const Profile = ({ title, editable, personal = {}, professional = {}, address = {} }) => {

  const [editingSections, setEditingSections] = useState({});
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    personal,
    professional,
    address,
  });

  const [originalData, setOriginalData] = useState({
    personal,
    professional,
    address,
  });

  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(
    personal?.profile_picture_url || DEFAULT_PROFILE
  );
  const [originalProfilePicture, setOriginalProfilePicture] = useState(
    personal?.profile_picture_url || DEFAULT_PROFILE
  );

  const toggleEditSection = (section) => {
    setEditingSections((prev) => {

      // 1️⃣ If already editing, DO NOTHING (block double-edit behavior)
      if (prev[section]) {
        return prev;
      }

      // 2️⃣ Backup original data only once when entering edit mode
      setOriginalData((old) => ({
        ...old,
        [section]: { ...formData[section] }
      }));

      return {
        ...prev,
        [section]: true,   // Always OPEN edit mode, never toggle off
      };
    });
  };


  // Handle profile picture change
  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file
      const validation = validateProfilePicture(file);
      if (!validation.valid) {
        showToast(validation.error, "error");
        e.target.value = ''; // Reset input
        return;
      }
      
      // Check image dimensions (recommended 1:1 aspect ratio)
      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        if (Math.abs(aspectRatio - 1) > 0.2) { // Allow 20% deviation from 1:1
          showToast("Recommended 1:1 (square) ratio. Uploaded image may look stretched.", "warning");
        }
        
        // If validation passes, update preview
        setProfilePicture(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setProfilePicturePreview(reader.result);
        };
        reader.readAsDataURL(file);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  // Handle cancel profile picture
  const handleCancelProfilePicture = () => {
    setProfilePicture(null);
    setProfilePicturePreview(originalProfilePicture);
    // Reset file input
    const fileInput = document.getElementById("profilePictureInput");
    if (fileInput) fileInput.value = '';
  };


  // Handle field change
  const handleFieldChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  // Save changes
  const handleSave = async (section) => {
    try {
      setSaving(true);
      const token = localStorage.getItem("access_token");
      const role = localStorage.getItem("role");

      const roleName = localStorage.getItem("role")?.toLowerCase();

      let updateUrl = "http://127.0.0.1:8000/api/employee/profile/"; // default for employees

      if (roleName?.includes("admin")) {
        updateUrl = "http://127.0.0.1:8000/api/employee/admin/profile/";
      } 
      else if (roleName?.includes("manager")) {
        updateUrl = "http://127.0.0.1:8000/api/employee/manager/profile/";
      }

      const payload = new FormData();

      if (profilePicture) {
        payload.append("profile_picture", profilePicture);
      }

      Object.keys(formData[section]).forEach((key) => {
        const value = formData[section][key];
        if (value !== null && value !== undefined && value !== "") {
          payload.append(key, value);
        }
      });

      const response = await axios.patch(updateUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response?.data?.profile_picture_url) {
        const newPictureUrl = response.data.profile_picture_url;

        const urlWithTimestamp = `${newPictureUrl}?t=${new Date().getTime()}`;

        setFormData((prev) => ({
          ...prev,
          personal: {
            ...prev.personal,
            profile_picture_url: urlWithTimestamp,
          },
        }));

        setProfilePicturePreview(urlWithTimestamp);
        setOriginalProfilePicture(urlWithTimestamp);

        localStorage.setItem("profile_picture_url", urlWithTimestamp);

        // ✅ THIS IS THE IMPORTANT LINE
        window.dispatchEvent(new Event("profilePictureUpdated"));
      }

      showToast("Profile updated successfully!", "success");
      setEditingSections((prev) => ({ ...prev, [section]: false }));
      setProfilePicture(null); // ✅ ADD THIS LINE - Ensure buttons disappear
      
    } catch (err) {
      console.error("Failed to update profile", err);
      const errorMsg = err.response?.data?.error || 
                      JSON.stringify(err.response?.data) || 
                      "Failed to update profile";
      showToast(errorMsg, "error");
    } finally {
      setSaving(false);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // Calculate age from DOB
  const calculateAge = (dob) => {
    if (!dob) return "—";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const viewStyle = {
    fontSize: "1rem",
    fontWeight: 500,
    color: "#1f2937",
    padding: "6px 0",
  };

  // --- Bootstrap Toast Helper ---
  const showToast = (message, type = "success") => {
    const toastElement = document.getElementById("profileToast");
    const toastBody = document.getElementById("profileToastMessage");

    toastBody.innerText = message;

    toastElement.classList.remove("bg-success", "bg-danger", "bg-warning");
    toastElement.classList.add(
      type === "success"
        ? "bg-success"
        : type === "error"
        ? "bg-danger"
        : "bg-warning"
    );

    const toast = new window.bootstrap.Toast(toastElement);
    toast.show();
  };



 return (
  <>
    <div
      aria-live="polite"
      aria-atomic="true"
      className="position-fixed top-0 end-0 p-3"
      style={{ zIndex: 9999 }}
    >
      <div
        id="profileToast"
        className="toast align-items-center text-white bg-success border-0"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <div className="d-flex">
          <div className="toast-body" id="profileToastMessage">Message</div>
          <button
            type="button"
            className="btn-close btn-close-white me-2 m-auto"
            data-bs-dismiss="toast"
            aria-label="Close"
          ></button>
        </div>
      </div>
    </div>

    <div className="container-fluid py-4" style={{ backgroundColor: "#f8f9fa" }}>
       {/* PAGE HEADING */}
        <div className="mb-3">
          <h3 className="fw-bold mb-0">Profile</h3>
        </div>
      <div className="row">
        {/* LEFT SIDEBAR */}
        <div className="col-md-4">
          <div className="card shadow-sm border-0" style={{ borderRadius: "12px" }}>
            <div className="card-body p-4">
              {/* Profile Picture with Edit - Circular */}
              <div className="position-relative mb-3" style={{ width: "140px", margin: "0 auto" }}>
                <img
                  src={profilePicturePreview}
                  alt="Profile"
                  className="rounded-circle"
                  style={{
                    width: "140px",
                    height: "140px",
                    objectFit: "cover",
                    border: "4px solid #f0f0f0",
                    display: "block",
                  }}
                />
                {editable && (
                  <>
                    <input
                      type="file"
                      id="profilePictureInput"
                      hidden
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleProfilePictureChange}
                    />
                    <button
                      className="btn btn-light btn-sm position-absolute"
                      style={{
                        bottom: "5px",
                        right: "5px",
                        borderRadius: "50%",
                        width: "35px",
                        height: "35px",
                        padding: "0",
                      }}
                      onClick={() => document.getElementById("profilePictureInput").click()}
                      title="Change profile picture (Max 2MB, JPG/PNG/WEBP, 1:1 ratio)"
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                  </>
                )}
              </div>
              {/* Show Save/Cancel buttons when profile picture is changed */}
              {editable && profilePicture && (
                <div className="d-flex justify-content-center gap-2 mb-3">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleCancelProfilePicture}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSave("personal")}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Photo"}
                  </button>
                </div>
              )}

              {/* Name & ID */}
              <div className="mb-3">
                <h4 className="mb-0 fw-bold">
                  {formData.personal.first_name} {formData.personal.last_name}
                </h4>
                <div className="d-flex align-items-center gap-2 mt-1">
                  <span className="text-muted">{formData.personal.emp_id}</span>
                  <i className="bi bi-clipboard text-muted" style={{ cursor: "pointer" }}></i>
                </div>
                <span className="badge bg-primary mt-2">{formData.professional.designation || formData.professional.role}</span>
              </div>

              {/* Basic Information */}
              <h6 className="fw-bold mb-3">Basic Information</h6>

              {/* Email */}
              <div className="mb-3">
                <div className="d-flex align-items-start gap-2">
                  <i className="bi bi-envelope mt-1"></i>
                  <div>
                    <div className="text-muted small">Email</div>
                    <div className="fw-semibold">{formData.personal.email}</div>
                  </div>
                </div>
              </div>

              {/* Mobile Phone */}
              <div className="mb-3">
                <div className="d-flex align-items-start gap-2">
                  <i className="bi bi-phone mt-1"></i>
                  <div>
                    <div className="text-muted small">Mobile Phone</div>
                    <div className="fw-semibold">{formData.personal.contact_number || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Department */}
              <div className="mb-3">
                <div className="d-flex align-items-start gap-2">
                  <i className="bi bi-building mt-1"></i>
                  <div>
                    <div className="text-muted small">Department</div>
                    <div className="fw-semibold">{formData.professional.department || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Gender */}
              <div className="mb-3">
                <div className="d-flex align-items-start gap-2">
                  <i className="bi bi-gender-ambiguous mt-1"></i>
                  <div>
                    <div className="text-muted small">Gender</div>
                    <div className="fw-semibold">{formData.personal.gender || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Age */}
              <div className="mb-3">
                <div className="d-flex align-items-start gap-2">
                  <i className="bi bi-calendar mt-1"></i>
                  <div>
                    <div className="text-muted small">Age</div>
                    <div className="fw-semibold">{calculateAge(formData.personal.dob)}</div>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="mb-3">
                <div className="d-flex align-items-start gap-2">
                  <i className="bi bi-check-circle mt-1"></i>
                  <div>
                    <div className="text-muted small">Status</div>
                    <div className="fw-semibold">{formData.professional.status || "Active"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CONTENT AREA */}
        <div className="col-md-8">
          {/* PROFILE HEADING */}

              {/* Professional Information Section */}
              <div className="card shadow-sm border-0 mb-3" style={{ borderRadius: "12px" }}>
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="d-flex align-items-center justify-content-center"
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          backgroundColor: "#e3f2fd",
                        }}
                      >
                        <i className="bi bi-person-fill text-primary"></i>
                      </div>
                      <h5 className="mb-0 fw-bold">Personal</h5>
                    </div>
                    {editable && (
                      <button
                        className="btn btn-light btn-sm"
                        disabled={editingSections.personal}
                        style={{ borderRadius: "50%", width: "35px", height: "35px" }}
                        onClick={() => toggleEditSection("personal")}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                    )}
                  </div>

                  <div className="row">
                    {/* Employee ID */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Employee ID</div>

                      {editingSections.personal ? (
                        <input
                            type="text"
                            className="form-control"
                            value={formData.personal.emp_id || ""}
                            disabled
                            style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
                        />
                    ) : (
                        <div style={viewStyle}>{formData.personal.emp_id || "—"}</div>
                    )}
                    </div>

                    {/* First Name */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">First Name</div>

                      {editingSections.personal ? (
                        <input
                            type="text"
                            className="form-control"
                            value={formData.personal.first_name || ""}
                            disabled
                            style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
                        />
                    ) : (
                        <div style={viewStyle}>{formData.personal.first_name || "—"}</div>
                    )}
                    </div>

                    {/* Last Name */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Last Name</div>

                      {editingSections.personal ? (
                        <input
                            type="text"
                            className="form-control"
                            value={formData.personal.last_name || ""}
                            disabled
                            style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
                        />
                    ) : (
                        <div style={viewStyle}>{formData.personal.last_name || "—"}</div>
                    )}
                    </div>

                    {/* Gender */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Gender</div>

                      {editingSections.personal ? (
                        <select
                          className="form-control"
                          value={formData.personal.gender || ""}
                          onChange={(e) =>
                            handleFieldChange("personal", "gender", e.target.value)
                          }
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      ) : (
                        <div style={viewStyle}>{formData.personal.gender || "—"}</div>
                      )}
                    </div>

                    {/* DOB */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Date of Birth</div>

                      {editingSections.personal ? (
                        <input
                          type="date"
                          className="form-control"
                          value={formData.personal.dob || ""}
                          onChange={(e) =>
                            handleFieldChange("personal", "dob", e.target.value)
                          }
                        />
                      ) : (
                        <div style={viewStyle}>{formatDate(formData.personal.dob)}</div>
                      )}
                    </div>

                    {/* Contact Number */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Contact Number</div>

                      {editingSections.personal ? (
                        <input
                          type="text"
                          className="form-control"
                          value={formData.personal.contact_number || ""}
                          onChange={(e) =>
                            handleFieldChange("personal", "contact_number", e.target.value)
                          }
                        />
                      ) : (
                        <div className="form-control-plaintext">
                          <div style={viewStyle}>{formData.personal.contact_number || "—"}</div>
                        </div>
                      )}
                    </div>

                    {/* Email ID */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Email ID</div>

                      {editingSections.personal ? (
                        <input
                            type="email"
                            className="form-control"
                            value={formData.personal.email || ""}
                            disabled
                            style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
                        />
                    ) : (
                        <div style={viewStyle}>{formData.personal.email || "—"}</div>
                    )}
                    </div>

                  </div>

                  {editingSections.personal && (
                    <div className="d-flex justify-content-end gap-2 mt-3">
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            personal: { ...originalData.personal }
                          }));
                          setEditingSections((prev) => ({
                            ...prev,
                            personal: false
                          }));
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSave("personal")}
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Information Section */}
              <div className="card shadow-sm border-0 mb-3" style={{ borderRadius: "12px" }}>
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="d-flex align-items-center justify-content-center"
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          backgroundColor: "#e3f2fd",
                        }}
                      >
                        <i className="bi bi-briefcase text-primary"></i>
                      </div>
                      <h5 className="mb-0 fw-bold">Professional</h5>
                    </div>
                    {editable && (
                      <button
                        className="btn btn-light btn-sm"
                        disabled={editingSections.professional}
                        style={{ borderRadius: "50%", width: "35px", height: "35px" }}
                        onClick={() => toggleEditSection("professional")}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                    )}
                  </div>

                  <div className="row">

                    {/* Department – ALWAYS VIEW ONLY */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Department</div>
                      {editingSections.professional ? (
                        <input
                          type="text"
                          className="form-control"
                          disabled
                          value={formData.professional.department || "—"}
                          style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
                        />
                      ) : (
                        <div style={viewStyle}>{formData.professional.department || "—"}</div>
                      )}
                    </div>

                    {/* Designation – ALWAYS VIEW ONLY */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Designation</div>
                      {editingSections.professional ? (
                        <input
                          type="text"
                          className="form-control"
                          disabled
                          value={formData.professional.designation || "—"}
                          style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
                        />
                      ) : (
                        <div style={viewStyle}>{formData.professional.designation || "—"}</div>
                      )}
                    </div>

                    {/* Project Name – EDITABLE */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Project Name</div>
                      {editingSections.professional ? (
                        <input
                          type="text"
                          className="form-control"
                          value={formData.professional.project_name || ""}
                          onChange={(e) =>
                            handleFieldChange("professional", "project_name", e.target.value)
                          }
                        />
                      ) : (
                        <div style={viewStyle}>{formData.professional.project_name || "—"}</div>
                      )}
                    </div>

                    {/* Date of Joining – ALWAYS VIEW ONLY */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Date of Joining</div>
                      {editingSections.professional ? (
                        <input
                          type="text"
                          className="form-control"
                          disabled
                          value={formatDate(formData.professional.joining_date)}
                          style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
                        />
                      ) : (
                        <div style={viewStyle}>
                          {formatDate(formData.professional.joining_date)}
                        </div>
                      )}
                    </div>

                    {/* Manager – EDITABLE */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Manager</div>
                      {editingSections.professional ? (
                        <input
                          type="text"
                          className="form-control"
                          value={formData.professional.manager_name || ""}
                          onChange={(e) =>
                            handleFieldChange("professional", "manager_name", e.target.value)
                          }
                        />
                      ) : (
                        <div style={viewStyle}>{formData.professional.manager_name || "—"}</div>
                      )}
                    </div>
                  </div>

                  {editingSections.professional && (
                    <div className="d-flex justify-content-end gap-2 mt-3">
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            professional: { ...originalData.professional }
                          }));
                          setEditingSections((prev) => ({
                            ...prev,
                            professional: false
                          }));
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSave("professional")}
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Address Section */}
              <div className="card shadow-sm border-0 mb-3" style={{ borderRadius: "12px" }}>
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="d-flex align-items-center justify-content-center"
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          backgroundColor: "#fff3e0",
                        }}
                      >
                        <i className="bi bi-house text-warning"></i>
                      </div>
                      <h5 className="mb-0 fw-bold">Address</h5>
                    </div>
                    {editable && (
                      <button
                        className="btn btn-light btn-sm"
                        disabled={editingSections.address}
                        style={{ borderRadius: "50%", width: "35px", height: "35px" }}
                        onClick={() => toggleEditSection("address")}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                    )}
                  </div>

                  <div className="row">
                    {/* Address Line 1 */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Address Line 1</div>

                      {editingSections.address ? (
                        <input
                          type="text"
                          className="form-control"
                          value={formData.address.address_line1 || ""}
                          onChange={(e) =>
                            handleFieldChange("address", "address_line1", e.target.value)
                          }
                        />
                      ) : (
                        <div style={viewStyle}>{formData.address.address_line1 || "—"}</div>
                      )}
                    </div>

                    {/* State */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">State</div>

                      {editingSections.address ? (
                        <input
                          type="text"
                          className="form-control"
                          value={formData.address.state || ""}
                          onChange={(e) => handleFieldChange("address", "state", e.target.value)}
                        />
                      ) : (
                        <div style={viewStyle}>{formData.address.state || "—"}</div>
                      )}
                    </div>

                    {/* City */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">City</div>

                      {editingSections.address ? (
                        <input
                          type="text"
                          className="form-control"
                          value={formData.address.city || ""}
                          onChange={(e) => handleFieldChange("address", "city", e.target.value)}
                        />
                      ) : (
                        <div style={viewStyle}>{formData.address.city || "—"}</div>
                      )}
                    </div>

                    {/* Pincode */}
                    <div className="col-md-6 mb-3">
                      <div className="text-muted small mb-1">Pincode</div>

                      {editingSections.address ? (
                        <input
                          type="text"
                          className="form-control"
                          value={formData.address.pincode || ""}
                          onChange={(e) =>
                            handleFieldChange("address", "pincode", e.target.value)
                          }
                        />
                      ) : (
                        <div style={viewStyle}>{formData.address.pincode || "—"}</div>
                      )}
                    </div>

                  </div>

                  {editingSections.address && (
                    <div className="d-flex justify-content-end gap-2 mt-3">
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            address: { ...originalData.address }
                          }));
                          setEditingSections((prev) => ({
                            ...prev,
                            address: false
                          }));
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSave("address")}
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Profile;