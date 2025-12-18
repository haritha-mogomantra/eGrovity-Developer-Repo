import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useLocation } from "react-router-dom";
import axiosInstance from "../../../utils/axiosInstance";
 

const ViewPerformance = () => {

  const location = useLocation();
  const employeeId = location.state?.employeeId || localStorage.getItem("emp_id");
  const [employeeInfo, setEmployeeInfo] = useState({

    empId: "",
    name: "",
    department: "",
    manager: "",
  });
 
  const [selectedWeek, setSelectedWeek] = useState("");
  const [allWeeks, setAllWeeks] = useState([]);
  const [performanceData, setPerformanceData] = useState({
    scores: {},
    comments: {},
  });
  const [measurementFields, setMeasurementFields] = useState([]);
  const [loading, setLoading] = useState(false);

  const fallbackMetrics = [
    "communication_skills",
    "multitasking",
    "team_skills",
    "technical_skills",
    "job_knowledge",
    "productivity",
    "creativity",
    "work_quality",
    "professionalism",
    "work_consistency",
    "attitude",
    "cooperation",
    "dependability",
    "attendance",
    "punctuality"
  ];

  const convertToWeekInput = (weekString) => {
    if (!weekString) return "";
    const weekNumber = weekString.replace("Week ", "").trim();
    const year = new Date().getFullYear();
    return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
  };

  const convertFromWeekInput = (weekInput) => {
    if (!weekInput) return "";
    const week = weekInput.split("-W")[1];
    return `Week ${parseInt(week, 10)}`;
  };


 
  // -------------------------------

  //  FETCH EMPLOYEE DATA FROM BACKEND

  // -------------------------------

  const fetchEmployeeDetails = async () => {

    try {

      const res = await axiosInstance.get(`employee/employees/employee/${employeeId}/`);
      console.log("EMPLOYEE API DATA =>", res.data);

      setEmployeeInfo({
        empId: res.data.emp_id || res.data.empId || res.data.id || employeeId,
        name:
          res.data.name ||
          res.data.full_name ||
          res.data.employee_name ||
          `${res.data.first_name || ""} ${res.data.last_name || ""}`.trim(),
        department:
          res.data.department ||
          res.data.department_name ||
          res.data.dept_name ||
          "",
        manager:
          res.data.manager ||
          res.data.reporting_manager ||
          res.data.manager_name ||
          "",
      });

    } catch (err) {
      console.error("Employee fetch error:", err);
    }
  };
 
  // ----------------------------------------

  //  FETCH PERFORMANCE DATA FROM BACKEND

  // ----------------------------------------

  const fetchPerformance = async () => {
    try {
      setLoading(true); // ✅ START LOADER

      const getISOWeek = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
        const week1 = new Date(d.getFullYear(), 0, 4);
        return (
          1 +
          Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
        );
      };

      const today = new Date();
      const currentWeek = getISOWeek(today);
      let latestWeek = currentWeek - 1;
      let year = today.getFullYear();

      if (latestWeek === 0) {
        latestWeek = 52;
        year = year - 1;
      }

      const formattedWeek = `${year}-W${String(latestWeek).padStart(2, "0")}`;

      let finalWeek = latestWeek;
      let finalYear = year;

      // ✅ Only auto-set week if user hasn't chosen yet
      if (!selectedWeek) {
        const savedWeek = localStorage.getItem("selected_week") || formattedWeek;
        setSelectedWeek(savedWeek);
        finalYear = parseInt(savedWeek.split("-W")[0], 10);
        finalWeek = parseInt(savedWeek.split("-W")[1], 10);
      } else {
        finalYear = parseInt(selectedWeek.split("-W")[0], 10);
        finalWeek = parseInt(selectedWeek.split("-W")[1], 10);
      }
      const response = await axiosInstance.get(
        "performance/performance/by-employee-week/",
        {
          params: {
            emp_id: employeeId,
            week: finalWeek,
            year: finalYear,
          },
        }
      );

      const performance = response.data || {};
      setPerformanceData(performance);

      let fields = [];

      if (performance?.metrics && typeof performance.metrics === "object") {
        fields = Object.keys(performance.metrics)
          .filter(key => !key.endsWith("_comment"));
      }
      else if (performance?.evaluation_details?.length > 0) {
        fields = performance.evaluation_details.map(m => m.metric_name);
      }
      else if (performance?.results?.length > 0) {
        fields = performance.results.map(m => m.metric);
      }
      else {
        fields = fallbackMetrics;
      }
      setMeasurementFields(fields);

    } catch (err) {
      console.error("Performance fetch error:", err);
      setMeasurementFields(fallbackMetrics);
    } finally {
      setLoading(false); // ✅ STOP LOADER
    }
  }; 
  // ----------------------------------------

  //  USE EFFECT TO LOAD DATA ONCE

  // ----------------------------------------

  useEffect(() => {
    fetchEmployeeDetails();
    fetchPerformance();
  }, [employeeId]);
 
  // ----------------------------------------

  //  WHEN WEEK IS CHANGED

  // ----------------------------------------


  const handleWeekChange = async (e) => {
    const weekInputValue = e.target.value;
    if (!weekInputValue) return;

    setSelectedWeek(weekInputValue);
    localStorage.setItem("selected_week", weekInputValue);
    setLoading(true);

    const backendWeek = parseInt(weekInputValue.split("-W")[1], 10);
    const year = parseInt(weekInputValue.split("-W")[0], 10);

    try {
      const res = await axiosInstance.get(
        "performance/performance/by-employee-week/",
        {
          params: {
            emp_id: employeeId,
            week: backendWeek,
            year: year,
          },
        }
      );

      const weekData = res.data || {};
      setPerformanceData(weekData);

      let fields = fallbackMetrics;

      if (weekData?.scores && Object.keys(weekData.scores).length > 0) {
        fields = Object.keys(weekData.scores);
      } 
      else if (weekData?.metrics?.length > 0) {
        fields = weekData.metrics.map(m => m.name);
      }

      setMeasurementFields(fields);
    } catch (err) {
      console.error("Week change error:", err);
      setMeasurementFields(fallbackMetrics);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------

  // TOTAL SCORE CALCULATION

  // ----------------------------------------

  const displayMetrics =
    measurementFields.length > 0 ? measurementFields : fallbackMetrics;

  const formatLabel = (key) =>
    key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

 
  return (
    <div className="container mt-2">

      {/* HEADER + WEEK DROPDOWN */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5>EMPLOYEE PERFORMANCE</h5>
      <div style={{ width: "250px" }}>
        <input
            type="week"
            className="form-control"
            value={selectedWeek}
            onChange={handleWeekChange}
          />
      </div>
      </div>
 
      {/* EMPLOYEE INFO */}
      <div className="card mb-3 p-3">
      <div className="row">
      <div className="col-md-3">
        <label className="fw-bold">EmpId:</label>
          <p>{employeeInfo.empId}</p>
      </div>
      <div className="col-md-3">
        <label className="fw-bold">Employee Name:</label>
          <p>{employeeInfo.name}</p>
      </div>
<div className="col-md-3">
<label className="fw-bold">Department:</label>
<p>{employeeInfo.department}</p>
</div>
<div className="col-md-3">
<label className="fw-bold">Manager:</label>
<p>{employeeInfo.manager}</p>
</div>
</div>
</div>
 
      {/* PERFORMANCE TABLE */}
      {loading ? (
        <div className="text-center mt-4 mb-4">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="mt-2">Loading performance data...</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-bordered align-middle text-start">
            <thead className="table-primary">
              <tr>
                <th>Measurement</th>
                <th>Score</th>
                <th>Comments/Remarks</th>
              </tr>
            </thead>
            <tbody>
              {displayMetrics.map((field, index) => {
                const metricKey = field;

                const score =
                  performanceData?.metrics?.[metricKey] ??
                  "-";

                const comment =
                  performanceData?.metrics?.[`${metricKey}_comment`] ??
                  "-";
                return (
                  <tr key={index}>
                    <td className="fw-bold">{formatLabel(field)}</td>
                    <td>{score}</td>
                    <td>{comment}</td>
                  </tr>
                );
              })}

              <tr className="fw-bold table-secondary">
                <td>Total Score</td>
                <td>{performanceData?.total_score || 0}</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
  </div>
  );
};
      
export default ViewPerformance;