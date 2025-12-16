import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useLocation } from "react-router-dom";
import axiosInstance from "../../../utils/axiosInstance";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
} from "recharts";
 
const measurementFields = [

  "Communication Skills",
  "Multi Tasking Abilities",
  "Team Skills",
  "Technical Skills",
  "Job Knowledge",
  "Productivity",
  "Creativity",
  "Work Quality",
  "Professionalism",
  "Work Consistency",
  "Attitude",
  "Cooperation",
  "Dependability",
  "Attendance",
  "Punctuality",

];
 
const ViewPerformance = () => {

  const location = useLocation();

  const employeeId = location.state?.employeeId || localStorage.getItem("emp_id");
 
  const [employeeInfo, setEmployeeInfo] = useState({

    name: "",
    department: "",
    manager: "",
  });
 
  const [selectedWeek, setSelectedWeek] = useState("");
  const [allWeeksData, setAllWeeksData] = useState({});
  const [weekInputValue, setWeekInputValue] = useState("");
  const [performanceData, setPerformanceData] = useState({

    scores: {},
    comments: {},
  });
 
  const [loading, setLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
 
  useEffect(() => {
    if (!employeeId) {
      console.error("Employee ID not found in route or localStorage");
      return;
    }

    const fetchEmployeeData = async () => {
      try {
        setLoading(true);
 
        const empRes = await axiosInstance.get(
          `/employee/employees/${employeeId}/`
        );

        const empData = empRes.data.employee || empRes.data;

        setEmployeeInfo({
          name: empData.first_name && empData.last_name
            ? `${empData.first_name} ${empData.last_name}`
            : (empData.employee_name || "-"),
          department: empData.department_name || "-",
          manager: empData.manager_name || "-"
        });

        const perfRes = await axiosInstance.get(
          `/performance/evaluation-by-emp/${employeeId}/`
        );

        // Correct array from backend
        const raw = perfRes.data.evaluations || [];

        // CONVERT BACKEND ARRAY → FRONTEND FORMAT
        const formattedData = {};

        if (!Array.isArray(raw) || raw.length === 0) {
          console.warn("No evaluation data found:", raw);
          setAllWeeksData({});
          setPerformanceData({ scores: {}, comments: {} });
        }

        raw.forEach(item => {
          const weekKey = item.evaluation_period;

          if (!formattedData[weekKey]) {
            formattedData[weekKey] = {
              scores: {},
              comments: {}
            };
          }

          const metrics = item.metrics || {};

          // ---------- SCORES ----------
          formattedData[weekKey].scores["Communication Skills"] = metrics.communication_skills || 0;
          formattedData[weekKey].scores["Multi Tasking Abilities"] = metrics.multitasking || 0;
          formattedData[weekKey].scores["Team Skills"] = metrics.team_skills || 0;
          formattedData[weekKey].scores["Technical Skills"] = metrics.technical_skills || 0;
          formattedData[weekKey].scores["Job Knowledge"] = metrics.job_knowledge || 0;
          formattedData[weekKey].scores["Productivity"] = metrics.productivity || 0;
          formattedData[weekKey].scores["Creativity"] = metrics.creativity || 0;
          formattedData[weekKey].scores["Work Quality"] = metrics.work_quality || 0;
          formattedData[weekKey].scores["Professionalism"] = metrics.professionalism || 0;
          formattedData[weekKey].scores["Work Consistency"] = metrics.work_consistency || 0;
          formattedData[weekKey].scores["Attitude"] = metrics.attitude || 0;
          formattedData[weekKey].scores["Cooperation"] = metrics.cooperation || 0;
          formattedData[weekKey].scores["Dependability"] = metrics.dependability || 0;
          formattedData[weekKey].scores["Attendance"] = metrics.attendance || 0;
          formattedData[weekKey].scores["Punctuality"] = metrics.punctuality || 0;

          // COMMENTS (THIS WAS MISSING)
          formattedData[weekKey].comments["Communication Skills"] = metrics.communication_skills_comment || "-";
          formattedData[weekKey].comments["Multi Tasking Abilities"] = metrics.multitasking_comment || "-";
          formattedData[weekKey].comments["Team Skills"] = metrics.team_skills_comment || "-";
          formattedData[weekKey].comments["Technical Skills"] = metrics.technical_skills_comment || "-";
          formattedData[weekKey].comments["Job Knowledge"] = metrics.job_knowledge_comment || "-";
          formattedData[weekKey].comments["Productivity"] = metrics.productivity_comment || "-";
          formattedData[weekKey].comments["Creativity"] = metrics.creativity_comment || "-";
          formattedData[weekKey].comments["Work Quality"] = metrics.work_quality_comment || "-";
          formattedData[weekKey].comments["Professionalism"] = metrics.professionalism_comment || "-";
          formattedData[weekKey].comments["Work Consistency"] = metrics.work_consistency_comment || "-";
          formattedData[weekKey].comments["Attitude"] = metrics.attitude_comment || "-";
          formattedData[weekKey].comments["Cooperation"] = metrics.cooperation_comment || "-";
          formattedData[weekKey].comments["Dependability"] = metrics.dependability_comment || "-";
          formattedData[weekKey].comments["Attendance"] = metrics.attendance_comment || "-";
          formattedData[weekKey].comments["Punctuality"] = metrics.punctuality_comment || "-";
        });


        setAllWeeksData(formattedData);

        const weekNames = Object.keys(formattedData).sort((a, b) => {
          const wA = parseInt(a.match(/\d+/)[0]);
          const wB = parseInt(b.match(/\d+/)[0]);
          return wA - wB;
        });

        if (weekNames.length > 0) {
          const latest = weekNames[weekNames.length - 1];
          setSelectedWeek(latest);
          setPerformanceData(formattedData[latest]);

          // Extract week number from "Week 48"
          const weekNumber = latest.match(/\d+/)[0];

          // Convert to ISO week format for week input: YYYY-W48
          const currentYear = new Date().getFullYear();
          const isoWeek = `${currentYear}-W${weekNumber}`;

          setWeekInputValue(isoWeek);
        }

      }catch (error) {
        console.error("Error loading API data:", error);

        setEmployeeInfo({
          name: "-",
          department: "-",
          manager: "-"
        });
      } finally {
        setLoading(false);
      }
    };
    fetchEmployeeData();
  }, [employeeId]);
 
  const handleWeekChange = (e) => {
    const week = e.target.value;
    setSelectedWeek(week);

    if (allWeeksData[week]) {
      setPerformanceData(allWeeksData[week]);
    } else {
      setPerformanceData({ scores: {}, comments: {} });
    }
  };

 
  if (loading) {
    return (
<div className="container text-center mt-5">
<h4>Loading...</h4>
</div>
    );
  }

  if (!performanceData || !performanceData.scores) {
    return <div className="container text-center mt-5">No Performance Data Available</div>;
  }
 
  if (!allWeeksData || Object.keys(allWeeksData).length === 0) {
    return (
      <div className="container mt-5 text-center">
        <h5>No performance data available for this employee</h5>
      </div>
    );
  }
  const chartData = measurementFields.map((field) => ({
    name: field,
    score: performanceData?.scores?.[field] || 0,
  }));
 
  const sortedMetrics = [...chartData].sort((a, b) => b.score - a.score);
  const top3 = sortedMetrics.slice(0, 3);
  const bottom3 = sortedMetrics.slice(-3);
  const totalScore = chartData.reduce((sum, item) => sum + item.score, 0);
 
  const syncWeekToData = (weekValue) => {
    if (!weekValue) return;

    const weekNum = weekValue.split("-W")[1]; // example: "48"

    const matchedWeek = Object.keys(allWeeksData).find(week =>
      week.includes(`Week ${weekNum}`)
    );

    if (matchedWeek) {
      setWeekLoading(true); // ✅ start animation

      setTimeout(() => {
        setSelectedWeek(matchedWeek);
        setPerformanceData(allWeeksData[matchedWeek]);
        setWeekLoading(false); // ✅ stop animation
      }, 500);
    } else {
      console.warn("No data found for week:", weekNum);
      setPerformanceData({ scores: {}, comments: {} });
    }
  };

  
  return (
<div className="container mt-2 position-relative">
  {weekLoading && (
    <div className="position-absolute w-100 h-100 d-flex justify-content-center align-items-center bg-white bg-opacity-75" style={{ zIndex: 10 }}>
      <div className="text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="mt-2 fw-bold">Loading selected week...</div>
      </div>
    </div>
  )}
<div className="d-flex justify-content-between align-items-center mb-3">
<h5>DASHBOARD</h5>
<div style={{ width: "250px" }}>
  <input
    type="week"
    className="form-control"
    value={weekInputValue}
    disabled={weekLoading}
    onChange={(e) => {
      setWeekInputValue(e.target.value);
      syncWeekToData(e.target.value);
    }}
  />
</div>

</div>
 
      <div className="card mb-3 p-3">
<div className="row">
<div className="col-md-4">
<label className="fw-bold">Employee Name:</label>
<p>{employeeInfo.name}</p>
</div>
<div className="col-md-4">
<label className="fw-bold">Department:</label>
<p>{employeeInfo.department}</p>
</div>
<div className="col-md-4">
<label className="fw-bold">Manager:</label>
<p>{employeeInfo.manager}</p>
</div>
</div>
</div>
 
      <div className="row mb-4">
<div className="col-md-6">
<div className="card border-success shadow-sm">
<div className="card-header bg-success text-white fw-bold">

              Top 3 Performance 
</div>
<ul className="list-group list-group-flush">

              {top3.map((m, i) => (
<li key={i} className="list-group-item d-flex justify-content-between">
<span>{m.name}</span>
<span className="fw-bold">{m.score}</span>
</li>

              ))}
</ul>
</div>
</div>
<div className="col-md-6">
<div className="card border-danger shadow-sm">
<div className="card-header bg-danger text-white fw-bold">

              Bottom 3 Performance 
</div>
<ul className="list-group list-group-flush">

              {bottom3.map((m, i) => (
<li key={i} className="list-group-item d-flex justify-content-between">
<span>{m.name}</span>
<span className="fw-bold">{m.score}</span>
</li>

              ))}
</ul>
</div>
</div>
</div>
 
      <div className="card p-3 mb-4 shadow-sm">
<h6 className="fw-bold mb-3 text-center">Weekly Performance Overview</h6>
<ResponsiveContainer width="100%" height={350}>
<BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
<CartesianGrid strokeDasharray="3 3" />
<XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={100} />
<YAxis domain={[0, 100]} />
<Tooltip />
<Bar dataKey="score" fill="#0d6efd" radius={[5, 5, 0, 0]}>
<LabelList dataKey="score" position="top" />
</Bar>
</BarChart>
</ResponsiveContainer>
</div>
 
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

            {measurementFields.map((field, index) => (
<tr key={index}>
<td className="text-start fw-bold">{field}</td>
<td>{performanceData?.scores?.[field] || "-"}</td>
<td>{performanceData?.comments?.[field] || "-"}</td>
</tr>

            ))}
<tr className="fw-bold table-secondary">
<td>Total Score</td>
<td>{totalScore}</td>
<td>—</td>
</tr>
</tbody>
</table>
</div>
</div>

  );

};
 
export default ViewPerformance;
