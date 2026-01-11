import axiosInstance from "../../utils/axiosInstance";

const EmployeeLifecycleAPI = {
  /**
   * Deactivate department and move employees
   * (WRITE → Masters domain)
   */
  deactivateDepartment: async ({ departmentId, reason }) => {
    const res = await axiosInstance.post(
      `/masters/${departmentId}/deactivate/`,
      { reason }
    );
    return res.data;
  },

  /**
   * Preview impact of department deactivation (READ-ONLY)
   */
  previewDepartmentDeactivation: async (departmentId) => {
    const res = await axiosInstance.get(
      `/employee-lifecycle/departments/${departmentId}/summary/`
    );
    return res.data;
  },

  /**
   * Lifecycle audit history (READ-ONLY)
   */
  getLifecycleHistory: async (params = {}) => {
    const res = await axiosInstance.get(
      "/employee-lifecycle/history/",
      { params }
    );
    return res.data;
  },
};

export default EmployeeLifecycleAPI;
