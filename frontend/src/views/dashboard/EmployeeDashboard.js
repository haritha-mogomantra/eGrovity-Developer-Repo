import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import axiosInstance from "../../utils/axiosInstance";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

/**
 * EMPLOYEE DASHBOARD
 * ------------------
 * Displays personal performance metrics with weekly selection
 * Features: Top/Bottom 3 metrics, performance chart, detailed table
 */

function EmployeeDashboard() {
  const empId = localStorage.getItem("emp_id");

  const [employeeInfo, setEmployeeInfo] = useState({
    name: "-",
    department: "-",
    manager: "-",
  });

  const [selectedWeek, setSelectedWeek] = useState("");
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ---------------- FETCH EMPLOYEE INFO ----------------
  const fetchEmployeeInfo = async () => {
    try {
        const res = await axiosInstance.get(
        `employee/employees/employee/${empId}/`
        );

        const firstName =
        res.data.user?.first_name ||
        res.data.first_name ||
        "";

        const lastName =
        res.data.user?.last_name ||
        res.data.last_name ||
        "";

        setEmployeeInfo({
        name: `${firstName} ${lastName}`.trim() || "-",
        department:
            res.data.department_name ||
            res.data.department ||
            "-",
        manager:
            res.data.manager_name ||
            res.data.reporting_manager_name ||
            "-",
        });
    } catch (err) {
        console.error("Employee info error:", err);
        setError("Unable to load employee information");
    }
    };

  // ---------------- FETCH PERFORMANCE ----------------
  const fetchPerformance = async (week, year) => {
    try {
      setLoading(true);
      setError(null);
      const res = await axiosInstance.get(
        "performance/performance/by-employee-week/",
        { params: { emp_id: empId, week, year } }
      );
      setPerformance(res.data);
    } catch (err) {
      console.error("Performance fetch error:", err);
      setError(
        err.response?.status === 404
          ? "No performance data available for this week"
          : "Unable to load performance data"
      );
      setPerformance(null);
    } finally {
      setLoading(false);
    }
  };


  // ---------------- FETCH LATEST COMPLETED WEEK ----------------
  const fetchLatestCompletedWeek = async () => {
    const res = await axiosInstance.get("performance/latest-week/");
    return res.data; // { week, year }
  };

  // ---------------- CALCULATE CURRENT WEEK ----------------
  const getCurrentWeek = () => {
    const today = new Date();
    const year = today.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((today - startOfYear) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return { year, week: Math.max(1, Math.min(week, 53)) };
  };

  // ---------------- INITIAL LOAD ----------------
  useEffect(() => {
    if (!empId) {
      setError("Employee ID not found. Please log in again.");
      return;
    }

    fetchEmployeeInfo();

    const loadLatestWeek = async () => {
      try {
        const { week, year } = await fetchLatestCompletedWeek();

        const defaultWeek = `${year}-W${String(week).padStart(2, "0")}`;
        setSelectedWeek(defaultWeek);
        fetchPerformance(week, year);
      } catch (err) {
        console.error("Latest week fetch error:", err);
        setError("Unable to determine latest completed week");
      }
    };

    loadLatestWeek();

  }, [empId]);

  // ---------------- WEEK CHANGE HANDLER ----------------
  const handleWeekChange = (e) => {
    const value = e.target.value;
    setSelectedWeek(value);
    const [year, weekStr] = value.split("-W");
    fetchPerformance(parseInt(weekStr, 10), parseInt(year, 10));
  };

  // ---------------- DATA DERIVATIONS ----------------
  const metrics = performance?.metrics || {};
  const metricList = Object.keys(metrics).filter(k => !k.endsWith("_comment"));

  const sortedMetrics = metricList.length > 0
    ? [...metricList]
        .map(m => ({ name: m, score: metrics[m] }))
        .sort((a, b) => b.score - a.score)
    : [];

  const top3 = sortedMetrics.slice(0, 3);
  const bottom3 = sortedMetrics.slice(-3).reverse();

  // ---------------- CHART CONFIGURATION ----------------
  const chartData = {
    labels: metricList.map(m => m.replace(/_/g, " ").toUpperCase()),
    datasets: [
      {
        label: "Score",
        data: metricList.map(m => metrics[m]),
        backgroundColor: "rgba(54, 162, 235, 0.6)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => `Score: ${context.parsed.y}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  // ---------------- ERROR STATE ----------------
  if (error && !performance) {
    return (
      <div className="container-fluid">
        <div className="alert alert-danger mt-4" role="alert">
          <h5 className="alert-heading">Error</h5>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // ---------------- MAIN UI ----------------
  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Employee Performance Dashboard</h4>
        <div className="d-flex align-items-center gap-2">
          <label htmlFor="week-selector" className="mb-0 text-nowrap">
            Select Week:
          </label>
          <input
            id="week-selector"
            type="week"
            className="form-control"
            style={{ width: "180px" }}
            value={selectedWeek}
            onChange={handleWeekChange}
            aria-label="Select performance week"
          />
        </div>
      </div>

 
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <strong className="text-muted">Employee</strong>
              <div className="mt-1">{employeeInfo.name}</div>
            </div>
            <div className="col-md-4">
              <strong className="text-muted">Department</strong>
              <div className="mt-1">{employeeInfo.department}</div>
            </div>
            <div className="col-md-4">
              <strong className="text-muted">Manager</strong>
              <div className="mt-1">{employeeInfo.manager}</div>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Loading performance data...</p>
        </div>
      )}

      {!loading && !performance && (
        <div className="alert alert-info" role="alert">
          <h5 className="alert-heading">No Data Available</h5>
          <p className="mb-0">
            No performance data found for the selected week. Please select a different week or contact your manager.
          </p>
        </div>
      )}

      {!loading && performance && (
        <>
          <div className="card shadow-sm mb-4">
              <div className="card-header bg-light">
                <strong>Weekly Performance Overview</strong>
              </div>
              <div className="card-body" style={{ height: "400px" }}>
                {metricList.length > 0 ? (
                  <Bar data={chartData} options={chartOptions} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                    No metrics to display
                  </div>
                )}
              </div>
            </div>
          <div className="row mb-4 g-3">
            <div className="col-lg-6">
              <div className="card border-success shadow-sm h-100">
                <div className="card-header bg-success text-white">
                  <strong>Top 3 Performance Metrics</strong>
                </div>
                <ul className="list-group list-group-flush">
                  {top3.length > 0 ? (
                    top3.map((m, idx) => (
                      <li
                        key={m.name}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <span>
                            {idx + 1}. {m.name.replace(/_/g, " ").toUpperCase()}
                            </span>
                            <strong>{m.score}</strong>
                      </li>
                    ))
                  ) : (
                    <li className="list-group-item text-muted">No metrics available</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card border-warning shadow-sm h-100">
                <div className="card-header bg-warning text-dark">
                  <strong>Bottom 3 Performance Metrics</strong>
                </div>
                <ul className="list-group list-group-flush">
                  {bottom3.length > 0 ? (
                    bottom3.map((m, idx) => (
                      <li
                        key={m.name}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <span>
                            {sortedMetrics.length - idx}. {m.name.replace(/_/g, " ").toUpperCase()}
                            </span>
                            <strong>{m.score}</strong>
                      </li>
                    ))
                  ) : (
                    <li className="list-group-item text-muted">No metrics available</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

{/*
          <div className="card shadow-sm">
            <div className="card-header bg-light">
              <strong>📋 Detailed Performance Breakdown</strong>
            </div>
            <div className="table-responsive">
              <table className="table table-hover table-bordered align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "40%" }}>Metric</th>
                    <th style={{ width: "15%" }} className="text-center">Score</th>
                    <th style={{ width: "45%" }}>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {metricList.length > 0 ? (
                    metricList.map(m => (
                      <tr key={m}>
                        <td className="fw-semibold">
                          {m.replace(/_/g, " ").toUpperCase()}
                        </td>
                        <td className="text-center">
                          <span>{metrics[m]}</span>
                        </td>
                        <td>
                          <small>{metrics[`${m}_comment`] || "—"}</small>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="text-center text-muted">
                        No metrics available
                      </td>
                    </tr>
                  )}
                  <tr className="table-primary fw-bold">
                    <td>TOTAL SCORE</td>
                    <td className="text-center">
                      <span>{performance?.total_score || 0}</span>
                    </td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
*/}
        </>
      )}
    </div>
  );
}

export default EmployeeDashboard;