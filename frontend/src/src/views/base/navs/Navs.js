// src/pages/ProfileCard.jsx
import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const Profile = ({ title, editable, personal, professional, address }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({ personal, professional, address });

  const handleChange = (section, key, value) => {
    setProfile((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  const handleEditToggle = () => setIsEditing(!isEditing);

  const handleSave = () => {
    setIsEditing(false);
    alert("✅ Profile updated successfully!");
    // TODO: Send updated profile to backend
  };

  return (
    <div className="card shadow border-0 my-4">
      <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
        <span>{title}</span>
        {editable && (
          <button
            className={`btn btn-sm ${isEditing ? "btn-success" : "btn-light"} text-dark`}
            onClick={isEditing ? handleSave : handleEditToggle}
          >
            <i className={`bi ${isEditing ? "bi-save" : "bi-pencil-square"} me-1`}></i>
            {isEditing ? "Save" : "Edit"}
          </button>
        )}
      </div>

      <div className="card-body p-4">
        {/* PERSONAL INFO */}
        <h5 className="text-primary border-bottom pb-2 mb-3">Personal Information</h5>
        <div className="row">
          {Object.entries(profile.personal).map(([key, value]) => (
            <div className="col-md-4 mb-3" key={key}>
              <strong>{key}:</strong>{" "}
              {isEditing ? (
                <input
                  type="text"
                  className="form-control mt-1"
                  value={value}
                  onChange={(e) => handleChange("personal", key, e.target.value)}
                />
              ) : (
                <span className="ms-2">{value}</span>
              )}
            </div>
          ))}
        </div>

        {/* PROFESSIONAL INFO */}
        <h5 className="text-primary border-bottom pb-2 mt-4 mb-3">Professional Information</h5>
        <div className="row">
          {Object.entries(profile.professional).map(([key, value]) => (
            <div className="col-md-4 mb-3" key={key}>
              <strong>{key}:</strong>{" "}
              {isEditing ? (
                <input
                  type="text"
                  className="form-control mt-1"
                  value={value}
                  onChange={(e) => handleChange("professional", key, e.target.value)}
                />
              ) : (
                <span className="ms-2">{value}</span>
              )}
            </div>
          ))}
        </div>

        {/* ADDRESS INFO */}
        <h5 className="text-primary border-bottom pb-2 mt-4 mb-3">Address</h5>
        <div className="row">
          {Object.entries(profile.address).map(([key, value]) => (
            <div className="col-md-4 mb-3" key={key}>
              <strong>{key}:</strong>{" "}
              {isEditing ? (
                <input
                  type="text"
                  className="form-control mt-1"
                  value={value}
                  onChange={(e) => handleChange("address", key, e.target.value)}
                />
              ) : (
                <span className="ms-2">{value}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Profile;
