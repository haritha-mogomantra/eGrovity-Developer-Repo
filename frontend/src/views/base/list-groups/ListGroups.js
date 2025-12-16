import React, { useState } from "react";
import { Form, Button, Card, Container, Row, Col, Alert } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import axiosInstance from "../../../utils/axiosInstance";
 
const ChangePassword = () => {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
 
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState("success");
 
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
 
  const handleSubmit = async (e) => {
    e.preventDefault();
 
    const { currentPassword, newPassword, confirmPassword } = formData;
 
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage("⚠️ Please fill all fields.");
      setVariant("warning");
      return;
    }
 
    if (newPassword !== confirmPassword) {
      setMessage("❌ New password and confirm password do not match.");
      setVariant("danger");
      return;
    }
 
    try {
     
      const response = await axiosInstance.post("users/change-password/", {
        old_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
 
      if (response.data.status === "success") {
        setMessage(response.data.message || "Password changed successfully!");
        setVariant("success");

        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        setMessage(response.data.message || "Failed to update password.");
        setVariant("danger");
      }
    } catch (error) {
      const errMsg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        "Server Error! Try again.";

      setMessage("❌ " + errMsg);
      setVariant("danger");
    }
  };
 
  return (
    <Container className="d-flex justify-content-center align-items-center">
      <Row className="w-100 justify-content-center">
        <Col md={6} lg={5}>
          <Card className="shadow p-4 rounded-4">
            <h4 className="text-center mb-4 fw-bold text-primary">Change Password</h4>
 
            {message && <Alert variant={variant}>{message}</Alert>}
 
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Current Password</Form.Label>
                <Form.Control
                  type="password"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  placeholder="Enter current password"
                />
              </Form.Group>
 
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">New Password</Form.Label>
                <Form.Control
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  placeholder="Enter new password"
                />
              </Form.Group>
 
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Confirm New Password</Form.Label>
                <Form.Control
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm new password"
                />
              </Form.Group>
 
              <div className="d-grid">
                <Button variant="primary" type="submit">
                  Update Password
                </Button>
              </div>
            </Form>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};
 
export default ChangePassword;