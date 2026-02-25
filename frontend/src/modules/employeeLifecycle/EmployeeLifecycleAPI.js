import axiosInstance from "../../utils/axiosInstance";

const EmployeeLifecycleAPI = {
  /**
   * Deactivate department and move employees
   * (WRITE → Masters domain)
   */
  deactivateDepartment: async ({
    departmentId,
    reason,
    targetDepartmentId,
  }) => {
    const res = await axiosInstance.post(
      `/masters/${departmentId}/deactivate/`,
      {
        reason,
        target_department_id: targetDepartmentId,
      }
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
