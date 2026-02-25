import React, { useState, useRef, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import { CTooltip } from "@coreui/react";
import { useNavigate, useLocation } from "react-router-dom";
import axiosInstance from "../../../utils/axiosInstance";
import { useMasterData } from "../../../context/MasterDataContext";


const formatWeekValue = (year, week) =>
  `${year}-W${String(week).padStart(2, "0")}`;


const readOnlyStyle = {
  backgroundColor: "#e9ecef",
  pointerEvents: "none",
};

// Format week as "Week 48 (24 Nov - 30 Nov 2025)"
const formatWeekRange = (weekValue) => {
  if (!weekValue) return "";

  const [year, w] = weekValue.split("-W");
  const week = Number(w);

  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = new Date(simple);

  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - dow + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - dow);

  const ISOweekEnd = new Date(ISOweekStart);
  ISOweekEnd.setDate(ISOweekStart.getDate() + 6);

  const fmt = { day: "numeric", month: "short" };
  return `Week ${week} (${ISOweekStart.toLocaleDateString("en-GB", fmt)} - ${ISOweekEnd.toLocaleDateString("en-GB", fmt)} ${year})`;
};

const getUserRole = () => {
  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {}

  // If user object missing, fall back to role stored in login
  const role =
    user?.role ||
    localStorage.getItem("role") ||
    "";

  // normalize to lowercase to match backend & permission checks
  return role.toLowerCase();
};



const PerformanceMetrics = () => {
  const [selectedWeek, setSelectedWeek] = useState("");

  useEffect(() => {
    if (selectedWeek) return;

    const loadLatestWeek = async () => {
      try {
        const res = await axiosInstance.get("/performance/latest-week/");
        const { week, year } = res.data;

        if (!week || !year) return;

        setSelectedWeek(formatWeekValue(year, week));
      } catch (err) {
        console.error("Failed to load latest performance week", err);
      }
    };

    loadLatestWeek();
  }, [selectedWeek]);


  const [employeeId, setEmployeeId] = useState("");
  const [currentEmployeeId, setCurrentEmployeeId] = useState("");
  const [viewEmployeeId, setViewEmployeeId] = useState("");
  const [employeeData, setEmployeeData] = useState({
    name: "",
    department: "",
    manager: "",
    weeklyCalendar: "",
    presentDate: "",
  });

  const [evaluationId, setEvaluationId] = useState(null);
  const [scores, setScores] = useState([]);
  const [comments, setComments] = useState([]);
  const [eligibleEmployees, setEligibleEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState({
    search: false,
    submit: false,
    print: false,
    page: false,
  });
  const [performanceList, setPerformanceList] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [scoreError, setScoreError] = useState("");
  const [showNoEmployeeAlert, setShowNoEmployeeAlert] = useState(false);

  // NEW unified validation modal (industry standard)
  const [validationModal, setValidationModal] = useState({
    show: false,
    message: "",
  });


  const navigate = useNavigate();
  const { masters } = useMasterData();

  // Resolve Department name from Master (single source of truth)
  const resolveDepartment = (data = {}) =>
    masters?.DEPARTMENT?.find(
      d =>
        d.id === data.department_id ||
        d.name === data.department_name
    )?.name || "";


  const measurements = (masters?.MEASUREMENT || [])
    .filter(m => m.status === "Active")
    .sort((a, b) => a.id - b.id)
    .map(m => m.name);

  // Sync scores & comments length with dynamic measurements
  useEffect(() => {
    if (!measurements.length) return;

    setScores(prev =>
      prev.length === measurements.length
        ? prev
        : Array(measurements.length).fill("")
    );

    setComments(prev =>
      prev.length === measurements.length
        ? prev
        : Array(measurements.length).fill("")
    );
  }, [measurements.length]);


  const printRef = useRef(null);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const { employee, mode, selectedWeek: navigatedWeek } = location.state || {};



  useEffect(() => {
    if (navigatedWeek) {
      setSelectedWeek(navigatedWeek);
    }
  }, [navigatedWeek]);


  useEffect(() => {
    if (mode !== "add") return;

    const role = getUserRole();
    if (!["admin", "manager"].includes(role)) {
      return; // Prevents unintended loading for Employees
    }


    const { year, week } = parseWeek(selectedWeek);
    if (!year || !week) {
      setEligibleEmployees([]);
      setFilteredEmployees([]);
      return;
    }

    axiosInstance
      .get(`/performance/eligible-employees/?week=${week}&year=${year}`)
      .then((res) => {
        const list = res.data || [];
        setEligibleEmployees(list);
        setFilteredEmployees([]);
      })
      .catch((err) => {
        console.error("Failed to load eligible employees", err);
        setEligibleEmployees([]);
        setFilteredEmployees([]);
      });
  }, [selectedWeek]);

  useEffect(() => {
    setShowNoEmployeeAlert(false);
  }, [selectedWeek]);

  useEffect(() => {
    if (mode !== "add") return;

    const { year, week } = parseWeek(selectedWeek);

    if (!year || !week) {
      setEligibleEmployees([]);
      setFilteredEmployees([]);
      return;
    }

    const loadEligible = async () => {
      try {
        const res = await axiosInstance.get(
          `/performance/eligible-employees/?week=${week}&year=${year}`
        );
        const list = res.data || [];
        setEligibleEmployees(list);

        // NEW: Show / auto-hide alert when zero employees
        if (list.length === 0) {
          setShowNoEmployeeAlert(true);

          // Auto hide after 5 seconds
          setTimeout(() => setShowNoEmployeeAlert(false), 5000);
        } else {
          setShowNoEmployeeAlert(false);
        }

        // Re-filter if user already typed something
        if (employeeId.trim()) {
          const value = employeeId.toUpperCase();
          setFilteredEmployees(
            list.filter(
              (emp) =>
                emp.emp_id.toUpperCase().includes(value) ||
                emp.full_name.toUpperCase().includes(value)
            )
          );
        }
      } catch (err) {
        console.error("Failed to load eligible employees:", err);
        setEligibleEmployees([]);
        setFilteredEmployees([]);
      }
    };

    loadEligible();
  }, [selectedWeek, mode]);


  // Keep fields editable ONLY in edit mode
  const [isReadOnly, setIsReadOnly] = useState(true);

  useEffect(() => {
    setIsReadOnly(mode == "view");
  }, [mode]);



  useEffect(() => {
    const fetchPerformanceList = async () => {
      try {
        const res = await axiosInstance.get("/performance/evaluations/");
        setPerformanceList(res.data || []);
      } catch (error) {
        console.error("Error fetching performance list:", error);
      }
    };

    fetchPerformanceList();
  }, []);


  const parseWeek = (weekValue) => {
    if (!weekValue || !weekValue.includes("-W")) return { year: null, week: null };
    const [year, weekStr] = weekValue.split("-W");
    return { year: Number(year), week: Number(weekStr) };
  };


  useEffect(() => {
    if (!employee) return;

    const empId =
      employee.emp_id ||
      employee.employee_emp_id ||
      employee.user?.emp_id ||
      "";

    // always fill visible ID
    setViewEmployeeId(empId);
    
    // ✅ Store the current employee ID
    setCurrentEmployeeId(empId);

    // IMPORTANT: for edit mode, set employeeId so submit works
    if (mode === "edit") {
      setEmployeeId(empId);
    }

    setEmployeeData({
      name:
        employee.employee_name ||
        employee.full_name ||
        employee.user?.full_name ||
        "",
      department: resolveDepartment(employee),
      manager: employee.manager_name || employee.evaluator_name || "",
      designation: employee.designation || employee.role_name || employee.position || "",
    });
  }, [employee, mode]);

  useEffect(() => {
    if (mode === "view" && navigatedWeek) {
      setSelectedWeek(navigatedWeek);
    }
  }, [mode, navigatedWeek]);
  
  
  useEffect(() => {
    const loadEmployeeEvaluation = async () => {
      if (!employee) return;
      if (mode !== "edit" && mode !== "view") return;
      if (!selectedWeek) return;

      setLoading((prev) => ({ ...prev, page: true }));
      // Get employee ID from the clicked employee record
const empId = employee.user?.emp_id || employee.emp_id || employee.employee_emp_id;

      try {
        const { year, week } = parseWeek(selectedWeek);
        
        if (!year || !week) {
          console.error("Invalid week format");
          setLoading((prev) => ({ ...prev, page: false }));
          return;
        }

        const res = await axiosInstance.get(
          `/performance/evaluations/?employee_id=${empId}&week=${week}&year=${year}`
        );

        //  FIX: Handle different response structures
        let evalData = null;

        // Check if paginated response
        if (res.data && res.data.results && Array.isArray(res.data.results)) {
          evalData = res.data.results[0];
        }
        // Check if direct array
        else if (Array.isArray(res.data)) {
          evalData = res.data[0];
        }
        // Check if single object
        else if (res.data && res.data.id) {
          evalData = res.data;
        }

        // Check if evaluation exists
        if (!evalData) {
          setValidationModal({
            show: true,
            message: `No evaluation found for this employee in Week ${week}, ${year}.`
          });
          setScores(Array(measurements.length).fill(""));
          setComments(Array(measurements.length).fill(""));
          setLoading((prev) => ({ ...prev, page: false }));
          return;
        }

        setEvaluationId(evalData.id);

        const metrics = evalData.metrics || {};


        setScores(
          measurements.map(name => {
            const key = name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_|_$/g, "");
            return metrics[key] ?? "";
          })
        );

        setComments(
          measurements.map(name => {
            const key = name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_|_$/g, "");
            return metrics[key + "_comment"] ?? "";
          })
        );

        setEmployeeData({
          name:
            evalData.employee?.full_name ||
            evalData.employee?.user?.full_name ||
            evalData.employee_name ||
            "",
          department: resolveDepartment(evalData.employee || evalData),
          manager:
            evalData.employee?.manager_name ||
            evalData.manager_name ||
            evalData.evaluator_name ||
            "",
          designation:
            evalData.employee?.designation ||
            evalData.employee?.role_name ||
            evalData.designation ||
            "",
          rank: evalData.rank || "-",
        });

      } catch (error) {
        console.error("Error fetching evaluation:", error);
        setValidationModal({
          show: true,
          message: "Failed to load evaluation data."
        });
        setScores(Array(measurements.length).fill(""));
        setComments(Array(measurements.length).fill(""));
      } finally {
        setLoading((prev) => ({ ...prev, page: false }));
      }
    };

    loadEmployeeEvaluation();
  }, [location.state?.evaluation_id, selectedWeek, mode]);

  

  useEffect(() => {
    if (validationModal.show) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [validationModal.show]);

  // 🔹 Backend error message extractor
  const extractBackendError = (err) => {
    const data = err?.response?.data;

    // DRF validation format: { errors: { field: "message" } }
    if (data?.errors && typeof data.errors === "object") {
      const firstKey = Object.keys(data.errors)[0];
      return data.errors[firstKey];
    }

    if (data?.detail) return data.detail;
    if (data?.message) return data.message;

    if (typeof data === "string") return data;

    return "Unable to process your request. Please try again.";
  };

  const handleSearch = async () => {

    if (!employeeId) {
      setValidationModal({ show: true, message: "Please enter Employee ID." });
      return;
    }

    setLoading(prev => ({ ...prev, search: true }));

    const cleanEmpId = employeeId.trim().toUpperCase();

    const { year, week } = parseWeek(selectedWeek);

    if (!year || !week) {
      setValidationModal({
        show: true,
        message: "Please select a valid week before searching."
      });
      setLoading(prev => ({ ...prev, search: false }));
      return;
    }

    try {
      // 1️⃣ FIRST load employee details
      const empRes = await axiosInstance.get(`employee/employees/${cleanEmpId}/`);
      const emp = empRes.data;

      setEmployeeId(emp.emp_id);   // <-- FIX: ensures duplicate API receives correct ID
      setEmployeeData({
        name: emp.full_name || "",
        department: resolveDepartment(emp),
        manager: emp.manager_name || "Not Assigned",
      });

    } catch (error) {
      console.error("Duplicate check failed:", error);
    } finally {
      setLoading(prev => ({ ...prev, search: false }));
    }
  };

  const handleChange = (e) => {
    setEmployeeData({ ...employeeData, [e.target.name]: e.target.value });
  };

  const handleScoreChange = (index, value) => {
    const updatedScores = [...scores];

    // Allow empty while typing
    if (value === "") {
      updatedScores[index] = "";
      setScores(updatedScores);
      return;
    }

    // Allow single zero
    if (value === "0") {
      updatedScores[index] = "0";
      setScores(updatedScores);
      return;
    }

    // Auto-remove leading zeros (e.g., 07 → 7, 050 → 50)
    if (value.length > 1 && value[0] === "0") {
      value = value.replace(/^0+/, "") || "0";
    }

    const num = Number(value);

    if (Number.isNaN(num) || num < 0) {
      setValidationModal({
        show: true,
        message: "Please enter a valid number between 0 and 100.",
      });
      return;
    }

    if (num > 100) {
      setValidationModal({
        show: true,
        message: "Score cannot exceed 100.",
      });
      return;
    }

    // Valid score
    updatedScores[index] = value;
    setScores(updatedScores);
  };


  const isValidEmpId = (value) => value.toUpperCase().startsWith("EMP");

  // VALID NAME format = alphabets + spaces only
  const isValidName = (value) => /^[A-Za-z ]+$/.test(value.trim());

  const isInvalidSearchInput = (value) => {
    const v = value.trim();

    if (!v) return false;

    // RULE: ANYTHING starting with EMP is valid
    if (v.toUpperCase().startsWith("EMP")) {
      return false;
    }

    // Name search allowed only A-Z and spaces
    if (!isValidName(v)) {
      return true;
    }

    return false;
  };

  const columns = ["Score", "Comments/Remarks"];

  const totalScore = scores
    .filter((s) => s !== "")
    .reduce((sum, val) => sum + Number(val), 0);
  const maxPossibleScore = measurements.length * 100;

  //PRINT HANDLER
  const handlePrint = () => {
    setLoading((prev) => ({ ...prev, print: true }));

    setTimeout(() => {
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head>
            <title>Employee Performance Review</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; color: #000; }
              .report-header {
                background-color: #FFD700;
                color: #000;
                text-align: center;
                font-weight: bold;
                padding: 10px;
                font-size: 22px;
                border: 2px solid #000;
              }
              .section-title {
                background-color: #000;
                color: #fff;
                padding: 6px 10px;
                font-size: 16px;
                font-weight: bold;
                margin-top: 20px;
                text-transform: uppercase;
              }
              .info-table td {
                padding: 4px 10px;
                vertical-align: middle;
                border: 1px solid #000;
              }
              .eval-table th, .eval-table td {
                border: 1px solid #000;
                text-align: center;
                font-size: 13px;
                padding: 6px;
              }
              .eval-table th {
                background-color: #f2f2f2;
                font-weight: bold;
              }
              .footer-summary td {
                background-color: #001f3f;
                color: white;
                font-weight: bold;
              }
              @media print {
                body { -webkit-print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="report-header">EMPLOYEE PERFORMANCE REVIEW REPORT</div>

            <div class="section-title">Employee Details</div>
            <table class="table table-bordered info-table mb-3">
              <tr>
                <td><strong>Employee Name:</strong> ${employeeData.name || ""}</td>
                <td><strong>Employee ID:</strong> ${employeeId || viewEmployeeId || ""}</td>
                <td><strong>Department:</strong> ${employeeData.department || ""}</td>
                <td><strong>Manager Assigned:</strong> ${employeeData.manager || ""}</td>
              </tr>
              <tr>
                <td><strong>Review Week:</strong> ${formatWeekRange(selectedWeek)}</td>
                <td><strong>Review Date:</strong> ${new Date().toLocaleDateString()}</td>
                <td><strong>Designation:</strong> ${employeeData.designation || ""}</td>
              </tr>
            </table>

            <div class="section-title">Employee Performance Evaluation</div>
            <table class="table table-bordered eval-table mb-3">
              <thead>
                <tr>
                  <th>Measurement</th>
                  <th>Score</th>
                  <th>Comments / Remarks</th>
                </tr>
              </thead>

              <tbody>
                ${measurements
                  .map(
                    (m, i) => `
                      <tr>
                        <td>${m}</td>
                        <td>${scores[i] || ""}</td>
                        <td>${comments[i] || ""}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>

              <tfoot>
                <tr class="footer-summary">
                  <td>Total</td>
                  <td>${totalScore}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            <div class="text-end mt-4">
              <strong>Total Score:</strong> ${totalScore} / ${maxPossibleScore}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
      setLoading((prev) => ({ ...prev, print: false }));
    }, 600);
  };

  // 🔹 SUBMIT HANDLER
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!employeeId) {
      setValidationModal({ show: true, message: "Please search and select an employee first." });
      return;
    }

    if (!employeeData.name) {
      setValidationModal({
        show: true,
        message: "Please search and load employee details before entering performance metrics."
      });
      return;
    }

    const allFilled =
      scores.length === measurements.length &&
      scores.every((s) => s !== "" && s !== undefined);
    if (!allFilled) {
      setValidationModal({ show: true, message: "Please fill all performance metrics before submitting." });
      return;
    }

    const invalid = scores.some((s) => isNaN(s) || s < 0 || s > 100);
    if (invalid) {
      setValidationModal({ show: true, message: "All scores must be valid numbers between 0 and 100." });
      return;
    }

    const role = getUserRole();
    if (!["admin", "manager"].includes(role)) {
      setValidationModal({
        show: true,
        message: "Only Admin or Manager can submit evaluations.",
      });
      return;
    }
    

    if (!selectedWeek) {
      setValidationModal({ show: true, message: "Please select a week for evaluation." });
      return;
    }

    const { year, week } = parseWeek(selectedWeek);

    const payload = {
      employee: employeeId.trim(),
      evaluation_type: "Manager",
      year: year,
      week_number: week, 
      review_date: new Date().toISOString().slice(0, 10),
      remarks: "",
    };


    const metrics = {};

    measurements.forEach((name, idx) => {
      const key = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");

      metrics[key] = Number(scores[idx]);
      metrics[key + "_comment"] = comments[idx] || "";
    });


    payload.metrics = metrics;
    payload.total_score = scores.reduce(
      (sum, val) => sum + (Number(val) || 0),
      0
    );


    setLoading((prev) => ({ ...prev, submit: true }));

    try {
      let res;
      if (evaluationId && mode === "edit") {
        // Update existing evaluation (Edit mode)
        res = await axiosInstance.put(`performance/evaluations/${evaluationId}/`, payload);
      } else {
        // Create new evaluation (Add mode)
        res = await axiosInstance.post("performance/evaluations/", payload);
      }

      if (res.status === 201 || res.status === 200) {
        setSuccessMessage(
          mode === "edit"
            ? "Evaluation updated successfully."
            : "Evaluation submitted successfully."
        );

        // AUTO-HIDE
        setTimeout(() => setSuccessMessage(""), 4000);

        // SCROLL TO TOP
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Redirect after 1.2s
        setTimeout(() => {
          navigate("/base/employeeperformance", {
            state: { returnWeek: selectedWeek }
          });
        }, 1200);
      } else {
        // Handle unexpected response status
        console.log("Server responded:", res.status, res.data);
        setValidationModal({ 
          show: true, 
          message: "Unexpected server response. Please try again." 
        });
      }
    } catch (err) {
  console.error("Submit error:", err.response || err);

  const serverMsg = extractBackendError(err);

  setValidationModal({
    show: true,
    message: serverMsg,
  });
  return;
} finally {
      setLoading((prev) => ({ ...prev, submit: false }));
    }
  };

  // 🔹 CANCEL HANDLER — reset only scores + comments
  const handleCancel = () => {
    setScores(Array(measurements.length).fill(""));
    setComments(Array(measurements.length).fill(""));
  };


  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setFilteredEmployees([]); // close dropdown
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  return (
    <div className="container mt-0">
      <style>
      {`
      input[type="week"] {
        color: #212529 !important;
      }

      input[type="week"]::-webkit-datetime-edit {
        color: #212529 !important;
      }

      input[type="week"]::-webkit-datetime-edit-text {
        color: #212529 !important;
      }

      input[type="week"]::-webkit-datetime-edit-year-field,
      input[type="week"]::-webkit-datetime-edit-week-field {
        color: #212529 !important;
      }
      `}
      </style>
      <div className="d-flex justify-content-between text-black">
        <h5>EMPLOYEE PERFORMANCE METRICS</h5>
      </div>
      {/* Week-based info alert (Dismissible + Auto fade) */}
      {showNoEmployeeAlert && (
        <div
          className="alert alert-info d-flex justify-content-between align-items-center shadow-sm fade show"
          style={{
            fontSize: "14px",
            borderRadius: "6px",
            marginBottom: "10px",
            transition: "opacity 0.4s ease-in-out",
          }}
        >
          <span>
            <i className="bi bi-info-circle-fill me-2"></i>
            No employees are available for this week.
          </span>

          {/* Close button */}
          <button
            type="button"
            className="btn-close"
            onClick={() => setShowNoEmployeeAlert(false)}
            aria-label="Close"
          ></button>
        </div>
      )}

      <div className="card">
        {successMessage && (
          <div className="px-3 pt-3">
            <div className="alert alert-success alert-dismissible fade show" role="alert">
              {successMessage}
              <button
                type="button"
                className="btn-close"
                onClick={() => setSuccessMessage("")}
              ></button>
            </div>
          </div>
        )}

        {scoreError && (
          <div className="px-3 pt-3">
            <div className="alert alert-warning alert-dismissible fade show" role="alert">
              <strong>Warning:</strong> {scoreError}
              <button
                type="button"
                className="btn-close"
                onClick={() => setScoreError("")}
              ></button>
            </div>
          </div>
        )}

        {/* Top toolbar: Search (left) + Back & Print (right) */}
        <div
          className={
            mode === "add"
              ? "d-flex justify-content-between align-items-center mb-2 mt-2 p-2"
              : "d-flex justify-content-end align-items-center mb-2 mt-2 p-2"
          }
        >

          {/* Searchable Employee Selector — show ONLY in ADD mode */}
          {mode === "add" && (
            <div
              style={{ width: "250px", position: "relative" }}
              ref={dropdownRef}
            >

            {/* Search/Typing Input */}
            <input
              type="text"
              className="form-control"
              placeholder="Type or select employee"
              value={employeeId}
              onChange={async (e) => {
                const value = e.target.value.trim();
                setEmployeeId(value);

                // Reset data when typing
                setEmployeeData({ name: "", department: "", manager: "" });

                if (!value) {
                  setFilteredEmployees([]);
                  return;
                }

                const upper = value.toUpperCase();

                // Anything starting with "EMP" is valid format
                if (upper.startsWith("EMP")) {
                  // Filter eligible employees by prefix
                  const filtered = eligibleEmployees.filter((emp) =>
                    emp.emp_id.toUpperCase().startsWith(upper)
                  );

                  if (filtered.length > 0) {
                    // Show matching eligible employees
                    setFilteredEmployees(filtered);
                    return;
                  }

                  // No match in eligible list → check if employee exists in DB
                  try {
                    const empRes = await axiosInstance.get(`/employee/employees/${upper}/`);
                    const emp = empRes.data;

                    // Employee exists but NOT eligible (already evaluated)
                    setFilteredEmployees([{ type: "evaluated" }]);
                    return;
                  } catch (err) {
                    // Employee does NOT exist in database
                    setFilteredEmployees([{ type: "not_found" }]);
                    return;
                  }
                }

                // NAME SEARCH (if NOT starting with EMP)
                if (!/^[A-Za-z ]+$/.test(upper)) {
                  setFilteredEmployees([{ type: "invalid" }]);
                  return;
                }

                const filtered = eligibleEmployees.filter((emp) =>
                  emp.full_name.toUpperCase().includes(upper)
                );
                setFilteredEmployees(filtered.length ? filtered : [{ type: "no_match" }]);
              }}
              onFocus={() => {
                const value = employeeId.trim().toUpperCase();
                
                if (!value) {
                  // No input → show all eligible employees
                  setFilteredEmployees(eligibleEmployees);
                  return;
                }

                // If user already typed something, filter based on current input
                if (value.startsWith("EMP")) {
                  const filtered = eligibleEmployees.filter((emp) =>
                    emp.emp_id.toUpperCase().startsWith(value)
                  );
                  setFilteredEmployees(filtered.length > 0 ? filtered : eligibleEmployees);
                } else {
                  // Name search
                  const filtered = eligibleEmployees.filter((emp) =>
                    emp.full_name.toUpperCase().includes(value)
                  );
                  setFilteredEmployees(filtered.length > 0 ? filtered : eligibleEmployees);
                }
              }}
              onBlur={() => {
                setTimeout(() => setFilteredEmployees([]), 200);
              }}
            />

            {/* Show message ONLY when typed pattern is invalid */}
            {employeeId.trim() &&
              filteredEmployees.length === 0 &&
              isInvalidSearchInput(employeeId.trim()) && (
                <ul
                  className="list-group position-absolute w-100"
                  style={{ maxHeight: "200px", overflowY: "auto", zIndex: 2000 }}
                >
                  <li className="list-group-item text-muted text-center">
                    No matching employees found
                  </li>
                </ul>
            )}

            <ul className="list-group position-absolute w-100"
              style={{ maxHeight: "200px", overflowY: "auto", zIndex: 2000 }}>

              {/* Show messages */}
              {filteredEmployees.length === 1 && filteredEmployees[0].type === "invalid" && (
                <li className="list-group-item text-muted text-center">
                  Invalid Employee ID Format
                </li>
              )}

              {filteredEmployees.length === 1 && filteredEmployees[0].type === "not_found" && (
                <li className="list-group-item text-muted text-center">
                  Employee does not exist
                </li>
              )}

              {filteredEmployees.length === 1 && filteredEmployees[0].type === "evaluated" && (
                <li className="list-group-item text-muted text-center">
                  Employee already evaluated for this week.
                </li>
              )}

              {filteredEmployees
                .filter(emp => !emp.type)
                .map(emp => (
                  <li
                    key={emp.emp_id}
                    className="list-group-item list-group-item-action"
                    style={{ cursor: "pointer" }}
                    onMouseDown={(e) => {
                      e.preventDefault(); // ✅ Prevents input blur
                      
                      setEmployeeId(emp.emp_id);

                      setEmployeeData({
                        name: emp.full_name || "",
                        department: resolveDepartment(emp),
                        manager: emp.manager_name || "Not Assigned",
                      });

                      setFilteredEmployees([]); // closes dropdown
                    }}
                  >
                    {emp.emp_id} — {emp.full_name}
                  </li>
                ))
              }
            </ul>
          </div>
          )}
          {/* RIGHT: Back + Print (conditional) */}
          <div className="d-flex align-items-center gap-2">

            <button
              className="btn btn-primary px-3"
              onClick={() =>
                navigate("/base/employeeperformance", {
                  state: { returnWeek: selectedWeek }
                })
              }
            >
              <i className="bi bi-arrow-left me-1"></i> Back
            </button>

            {/* SHOW PRINT ONLY IF NOT ADD MODE */}
            {mode !== "add" && (
              <CTooltip content="Print Evaluation" placement="top">
                <button
                  className="btn btn-outline-secondary d-flex align-items-center px-3"
                  style={{ borderRadius: "6px", fontWeight: "500" }}
                  onClick={handlePrint}
                  disabled={loading.print}
                >
                  {loading.print ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Printing...
                    </>
                  ) : (
                    <i className="bi bi-printer"></i>
                  )}
                </button>
              </CTooltip>
            )}
          </div>
        </div>
        {/* FORM START */}
        <form onSubmit={handleSubmit}>
          <div ref={printRef}>
            {/* Employee Basic Details */}
            <div className="p-2">
              <div className="row">

                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Week</label>
                  <input
                    type="week"
                    className="form-control week-input"
                    style={mode && mode !== "add" ? readOnlyStyle : {}}
                    value={selectedWeek}
                    onChange={async (e) => {
                      const newWeek = e.target.value;
                      setSelectedWeek(newWeek);

                      // Only fetch eligible employees in ADD mode
                      if (mode === "add") {

                      // fetch eligible employees
                      const { year, week } = parseWeek(newWeek);
                      if (year && week) {
                        try {
                          const res = await axiosInstance.get(
                            `/performance/eligible-employees/?week=${week}&year=${year}`
                          );
                          setEligibleEmployees(res.data || []);

                          // Show top info alert for zero employees
                          if ((res.data || []).length === 0) {
                            setShowNoEmployeeAlert(true);

                            // Fade out after 5 seconds
                            setTimeout(() => {
                              setShowNoEmployeeAlert(false);
                            }, 5000);
                          } else {
                            setShowNoEmployeeAlert(false);
                          }
                        } catch (err) {
                          console.error("Failed to fetch eligible employees", err);
                          setEligibleEmployees([]);
                        }
                      }

                      // run duplicate check if previously typed employee
                      if (employeeId.trim()) {
                        setTimeout(() => {
                          handleSearch();
                        }, 10);
                      }
                    }
                    }}
                    min="2000-W01"
                    max={selectedWeek}
                    disabled={false}
                  />
                </div>

                {mode !== "add" && (
                  <div className="col-md-3 mb-3">
                    <label className="form-label fw-bold">Employee ID</label>
                    <input
                      type="text"
                      className="form-control"
                      value={viewEmployeeId}
                      readOnly
                      disabled
                      style={readOnlyStyle}
                    />
                  </div>
                )}

                {/* Hidden Employee ID input — logic remains same */}
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  style={{ display: "none" }}
                  disabled
                />

                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Employee Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="name"
                    value={employeeData.name}
                    readOnly
                    style={readOnlyStyle}
                  />
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Department</label>
                  <input
                    type="text"
                    className="form-control"
                    name="department"
                    value={employeeData.department}
                    readOnly
                    style={readOnlyStyle}
                  />
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Manager Assigned</label>
                  <input
                    type="text"
                    className="form-control"
                    name="manager"
                    value={employeeData.manager}
                    readOnly
                    style={readOnlyStyle}
                  />
                </div>

              </div>

              {/* Section Title */}
              <div className="d-flex justify-content-between align-items-center mt-3 mb-3 p-2">
                <h5 className="text-start mb-0">EMPLOYEE PERFORMANCE EVALUATION</h5>
              </div>

              {/* TABLE */}
              <div className="table-responsive p-2" style={{ position: "relative", minHeight: "400px" }}>
                
                {/* Dynamic Loading Overlay */}
                {loading.page && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      background: "rgba(255, 255, 255, 0.85)",
                      backdropFilter: "blur(3px)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      zIndex: 10,
                      borderRadius: "8px"
                    }}
                  >
                    <div className="spinner-border text-primary mb-3" style={{ width: "3rem", height: "3rem" }}>
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="text-muted fw-bold mb-0">Loading evaluation data...</p>
                  </div>
                )}

                <table className="table table-bordered align-middle text-center">
                  <thead className="table-primary">
                    <tr>
                      <th>Measurement</th>
                      {columns.map((col, index) => (
                        <th key={index}>{col}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {measurements.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        <td className="fw-bold text-start">{row}</td>

                        <td>
                          <input
                            type="number"
                            className="form-control form-control-sm text-center"
                            min="0"
                            max="100"
                            value={scores[rowIndex] || ""}
                            onChange={(e) => handleScoreChange(rowIndex, e.target.value)}
                            readOnly={isReadOnly || !employeeData.name}
                          />
                        </td>

                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={comments[rowIndex] || ""}
                            onChange={(e) => {
                              const updated = [...comments];
                              updated[rowIndex] = e.target.value;
                              setComments(updated);
                            }}
                            readOnly={isReadOnly || !employeeData.name}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TOTAL SCORE */}
              <div className="text-end fw-bold mt-2 p-2">
                Total Score: {totalScore} / {maxPossibleScore}
              </div>
            </div>
          </div>

          {/* FORM BUTTONS */}
          <div className="mt-3 d-flex justify-content-between p-2">

            {/* LEFT SIDE — CANCEL (only in Add mode) */}
            {mode === "add" && (
              <button
                type="button"
                className="btn btn-secondary px-4 mb-2"
                onClick={handleCancel}
              >
                Cancel
              </button>
            )}

            {/* RIGHT SIDE — SUBMIT / UPDATE */}
            {mode !== "view" && (
              <button
                type="submit"
                className="btn btn-primary px-4 mb-2"
                disabled={loading.submit}
              >
                {loading.submit ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    {mode === "edit" ? "Updating..." : "Submitting..."}
                  </>
                ) : (
                  mode === "edit" ? "Update" : "Submit"
                )}
              </button>
            )}
          </div>
        </form>
    </div>
  
    {/* === UNIVERSAL VALIDATION MODAL (new industry standard) === */}
    <div
      className={`modal fade ${validationModal.show ? "show d-block" : ""}`}
      tabIndex="-1"
      role="dialog"
    >
      <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "420px" }}>
        <div className="modal-content">

          <div className="modal-header bg-warning text-dark">
            <h5 className="modal-title fw-bold d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              Warning
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={() => setValidationModal({ show: false, message: "" })}
            ></button>
          </div>

          <div className="modal-body">{validationModal.message}</div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-primary px-4"
              onClick={() => setValidationModal({ show: false, message: "" })}
            >
              OK
            </button>
          </div>

        </div>
      </div>
    </div>

    {validationModal.show && (
      <div className="modal-backdrop fade show"></div>
    )}
  </div>
);
};

export default PerformanceMetrics;