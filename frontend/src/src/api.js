import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000/api", // your backend base URL
});

// Example endpoints (adjust to your backend)
export const getEmployees = () => API.get("/employees/");
export const addEmployee = (data) => API.post("/employees/", data);
export const updateEmployee = (id, data) => API.put(`/employees/${id}/`, data);
export const deleteEmployee = (id) => API.delete(`/employees/${id}/`);

export default API;
