import React, { useEffect, useRef, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import * as bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js";
window.bootstrap = bootstrap;
import axiosInstance from "../../../utils/axiosInstance";
import { useNavigate, useLocation } from 'react-router-dom'
import { useMasterData } from "../../../context/MasterDataContext";


function DynamicPerformanceReport() {
  const navigate = useNavigate()
  const { masters } = useMasterData();
  const departments = masters?.DEPARTMENT || [];

  // ===============================
  // Department display helper
  // ===============================
  const getDepartmentName = (rawDept) => {
    if (!rawDept) return "-";

    // If backend already sends plain name, keep it
    const cleanName = String(rawDept).split("(")[0].trim();

    // Match with master data for safety
    const masterDept = departments.find(
      d => d.name?.toLowerCase() === cleanName.toLowerCase()
    );

    return masterDept ? masterDept.name : cleanName;
  };


  const location = useLocation()

  const [reportType, setReportType] = useState("weekly");

  // ===============================
  // URL → REPORT TYPE SYNC (Breadcrumb Fix)
  // ===============================
  useEffect(() => {
    if (location.pathname === '/reports/weekly') {
      setReportType('weekly')
    } else if (location.pathname === '/reports/manager') {
      setReportType('manager')
    } else if (location.pathname === '/reports/department') {
      setReportType('department')
    }
  }, [location.pathname])
  
  const [selectedOption, setSelectedOption] = useState("");

  const [selectedWeek2, setSelectedWeek2] = useState("");
  const [maxSelectableWeek, setMaxSelectableWeek] = useState("");
  const [initialWeek, setInitialWeek] = useState("");
  const [isWeekChanged, setIsWeekChanged] = useState(false);

  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [hasManagerInteracted, setHasManagerInteracted] = useState(false);
  const [hasDepartmentInteracted, setHasDepartmentInteracted] = useState(false);

  const [filteredData, setFilteredData] = useState([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

 
  const reportRef = useRef(null);
 
  const API_BASE = {
    weekly: "reports/weekly/",
    manager: "reports/manager/",
    department: "reports/department/"
  };

  const getCurrentWeek = () => {
    const today = new Date();
    const onejan = new Date(today.getFullYear(), 0, 1);
    const numberOfDays = Math.floor((today - onejan) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((today.getDay() + 1 + numberOfDays) / 7);
    return `${today.getFullYear()}-W${String(week).padStart(2, "0")}`;
  };

    
  useEffect(() => {
    // WAIT until bootstrap is loaded
    if (!window.bootstrap || !window.bootstrap.Tooltip) return;

    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');

    tooltipTriggerList.forEach((el) => {
      try {
        new window.bootstrap.Tooltip(el);
      } catch (err) {
        console.error("Tooltip init failed:", err);
      }
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInitialReport = async () => {
      setLoading(true);

      try {
        const storedWeek = localStorage.getItem("selectedWeek");

        if (storedWeek) {
          setSelectedWeek2(storedWeek);
          setInitialWeek(storedWeek);

          setHasUserInteracted(true);
          setIsWeekChanged(true);

          const { year, week } = parseWeek(storedWeek);
          await fetchReport("weekly", "", "", week, year);
          setLoading(false);
          return;
        }
        const res = await axiosInstance.get("/reports/latest-week/");

        if (res?.data?.week && res?.data?.year) {
          const backendWeek = `${res.data.year}-W${String(res.data.week).padStart(2, "0")}`;
          setSelectedWeek2(backendWeek);

          setMaxSelectableWeek(getCurrentWeek());

          setInitialWeek(backendWeek);
          setIsWeekChanged(false);

          const { year, week } = parseWeek(backendWeek);
          await fetchReport("weekly", "", "", week, year);
        }

      } catch (e) {
        console.error("Failed to load latest week:", e);
      } finally {
        setLoading(false);
      }
    };

    loadInitialReport();

    return () => {
      isMounted = false;

      // CLEAR WEEK ONLY WHEN USER LEAVES REPORTS PAGE
      localStorage.removeItem("selectedWeek");
    };
  }, []);

    useEffect(() => {
      if (reportType === "manager") {
        fetchManagers();
        setSelectedOption("ALL_MGR");
        
        // ✅ Auto-load data for "All Managers" when radio button is clicked
        const { year, week } = parseWeek(selectedWeek2);
        if (year && week) {
          fetchReport("manager", "ALL_MGR", null, week, year);
        }
      }
    }, [reportType]);


    useEffect(() => {
      if (reportType === "department") {
        setSelectedOption("ALL_DEPT");
        
        // Auto-load data for "All Departments" when radio button is clicked
        const { year, week } = parseWeek(selectedWeek2);
        if (year && week) {
          fetchReport("department", null, "ALL_DEPT", week, year);
        }
      }
    }, [reportType]);


  const parseWeek = (weekValue) => {
    // weekValue = "2025-W46"
    if (!weekValue || !weekValue.includes("-W")) return { year: null, week: null };

    const [year, weekStr] = weekValue.split("-W");
    return { year: parseInt(year), week: parseInt(weekStr) };
  };

  const getWeekDateRange = (weekValue) => {
    if (!weekValue) return "";

    const [year, week] = weekValue.split("-W").map(Number);

    const start = new Date(year, 0, (week - 1) * 7 + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const fmt = (d) =>
      d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    return `${fmt(start)} to ${fmt(end)}`;
  };

 
  const fetchReport = async (type, manager = "", department = "", week = "", year = "") => {
    try {
      setLoading(true);
      setError("");
 
      const params = {};
      // Manager filter
      if (manager === "ALL_MGR") {
          params.manager = "";             // send empty → backend returns all managers
      } else if (manager) {
          params.manager = manager;        // specific manager
      }

      // Department filter
      if (department === "ALL_DEPT") {
          params.department = "";          // send empty → backend returns all departments
      } else if (department) {
          params.department = department;  // specific department
      }

      if (week) params.week = week;
      if (year) params.year = year;
 
      const res = await axiosInstance.get(API_BASE[type], { params });
      const data = res.data;

      // If backend returned a message or empty data → show no rows
      if (!data.records || !Array.isArray(data.records)) {
        setFilteredData([]);
        setLoading(false);
        return;
      }


      const normalized = data.records.map((item) => ({
        id: item.emp_id ?? item.id ?? "-",
        name: item.employee_full_name ?? item.full_name ?? item.name ?? "-",
        department: getDepartmentName(
          item.department ?? item.department_name ?? "-"
        ),
        manager:
          item.manager_full_name ??
          item.manager ??
          item.manager_name ??
          item.evaluator_name ??         
          item.evaluator_full_name ??   
          item.reviewer_name ??          
          item.reviewer_full_name ??     
          item.evaluator ??
          item.reviewer ??
          "-",
        score:
          item.score ??
          item.total_score ??
          item.average_score ??
          item.avg_score ??
          0,
        rank: item.rank ?? "-",
      }));


      // ---------------- DENSE RANK COMPUTATION BASED ON SCORE ----------------

      // Sort by score DESC (higher score first)
      const sorted = [...normalized].sort((a, b) => {
        const s1 = Number(a.score ?? 0);
        const s2 = Number(b.score ?? 0);

        if (s1 !== s2) return s2 - s1; // DESC

        return (a.name || "").localeCompare(b.name || "");
      });

      // Dense ranking: 1, 2, 2, 3
      let prevScore = null;
      let currentRank = 0;

      for (const item of sorted) {
        const score = Number(item.score ?? 0);

        if (prevScore === null || score !== prevScore) {
          currentRank += 1;   // Increment rank only on score change
          prevScore = score;
        }

        item.rank = currentRank;
      }

      setFilteredData(sorted);
      setCurrentPage(1);



    } catch (err) {
      setError("Failed to load data from server");
    } finally {
      setLoading(false);
    }
  };

 
  const handleSubmit = (e) => {
    e.preventDefault();
 
    if (!selectedWeek2) {
      alert("Please select week");
      return;
    }
 
    const { year, week } = parseWeek(selectedWeek2);

    if (!week || !year) {
      alert("Invalid week selection");
      return;
    }

    if (reportType === "manager") {
      fetchReport("manager", selectedOption, null, week, year);
  }
  else if (reportType === "department") {
      fetchReport("department", null, selectedOption, week, year);
  }
  else {
      fetchReport("weekly", null, null, week, year);
  }
  };


 
  const exportExcel = async (rows, columns, filename = "report.xlsx") => {
    if (!rows.length) return alert("No data to export");

    const XLSX = await import("xlsx");

    // Reorder data based on column config
    const formatted = rows.map((row, index) => {
      const obj = {};
      columns.forEach(col => {
        obj[col.label] = col.key === "slno" ? index + 1 : row[col.key];
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");

    XLSX.writeFile(wb, filename);
  };

  const getReportTitle = () => {
    const range = getWeekDateRange(selectedWeek2);

    if (reportType === "weekly") {
      return `Rank-Wise Employee Performance Report from ${range}`;
    }

    if (reportType === "manager") {
      if (selectedOption === "ALL_MGR") {
        return `Manager Wise Employee Performance Report from ${range}`;
      }
      const mgr = managers.find(m => m.emp_id === selectedOption);
      return `Rank-Wise Employee Performance Report – Managed by ${mgr?.full_name || ""}`;
    }

    if (reportType === "department") {
      if (selectedOption === "ALL_DEPT") {
        return `Department Wise Employee Performance Report from ${range}`;
      }
      const dept = departments.find(d => d.code === selectedOption);
      return `Rank-Wise Employee Performance Report – ${dept?.name || ""}`;
    }

    return "Employee Performance Report";
  };


  // ======================================================
  // DYNAMIC COLUMN CONFIG BASED ON REPORT TYPE
  // ======================================================
  const getColumnConfig = () => {
    switch (reportType) {
      case "weekly":
        return [
          { key: "slno", label: "Sl.No" },
          { key: "id", label: "Emp ID" },
          { key: "name", label: "Employee Name" },
          { key: "department", label: "Department" },
          { key: "manager", label: "Manager" },
          { key: "score", label: "Score" },
          { key: "rank", label: "Rank" }
        ];

      case "manager":
        return [
          { key: "slno", label: "Sl.No" },
          { key: "manager", label: "Manager" },
          { key: "department", label: "Department" },
          { key: "id", label: "Emp ID" },
          { key: "name", label: "Employee Name" },
          { key: "score", label: "Score" },
          { key: "rank", label: "Rank" }
        ];

      case "department":
        return [
          { key: "slno", label: "Sl.No" },
          { key: "department", label: "Department" },
          { key: "id", label: "Emp ID" },
          { key: "name", label: "Employee Name" },
          { key: "manager", label: "Manager" },
          { key: "score", label: "Score" },
          { key: "rank", label: "Rank" }
        ];

      default:
        return [];
    }
  };
 
  const handlePrint = () => {
    const dataToPrint = sortedData;  // ALWAYS full sorted + filtered dataset

    if (!dataToPrint.length) {
      alert("No data available to print");
      return;
    }

    const title = getReportTitle();

    const buildHeader = () => {
      const cols = getColumnConfig();
      return cols.map(c => `<th>${c.label}</th>`).join("");
    };

    const buildRows = () => {
      const cols = getColumnConfig();
      return dataToPrint
        .map((emp, index) => `
          <tr>
            ${cols.map(c =>
              c.key === "slno"
                ? `<td>${index + 1}</td>`
                : `<td>${emp[c.key]}</td>`
            ).join("")}
          </tr>`)
        .join("");
    };

    const html = `
      <h3 class="text-center mb-4">${title}</h3>
      <table class="table table-bordered">
        <thead><tr>${buildHeader()}</tr></thead>
        <tbody>${buildRows()}</tbody>
      </table>
    `;

    const win = window.open("", "_blank", "width=900,height=600");
    win.document.write(`
      <html>
      <head>
        <title>${title}</title>
        <link rel="stylesheet"
              href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
      </head>
      <body style="padding:20px;">
        ${html}
      </body>
      </html>
    `);
    win.document.close();

    win.onload = () => {
      win.print();
      win.close();
    };
  };
 
  const reportTitleMap = {
    weekly: "Weekly Report",
    manager: "Manager Wise Report",
    department: "Department Wise Report",
  };
 

  const LoadingOverlay = () => (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(255,255,255,0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        backdropFilter: "blur(2px)",
      }}
    >
      <div className="spinner-border text-primary" style={{ width: "4rem", height: "4rem" }}></div>
    </div>
  );

  const [managers, setManagers] = useState([]);

  const fetchManagers = async () => {
    try {
      const res = await axiosInstance.get("employee/employees/managers/");
      
      let list = [];

      if (Array.isArray(res.data.results)) {
        list = res.data.results;
      } else if (Array.isArray(res.data)) {
        list = res.data;
      } else {
        console.warn("Managers API returned unexpected format:", res.data);
      }

      const mappedManagers = list.map((m) => ({
        emp_id: m.emp_id || m.user?.emp_id || "",
        full_name:
          m.full_name ||
          `${m.user?.first_name || ""} ${m.user?.last_name || ""}`.trim(),
      }));

      setManagers(mappedManagers);
    } catch (error) {
      console.error("❌ Failed to load managers:", error);
    }
  };


  const parseEmpId = (id) => {
    if (!id) return 0;

    // Extract numeric part (EMP0012 → 12)
    const numeric = id.match(/\d+/);

    // If no number found → treat it as very large to push to bottom
    if (!numeric) return Number.MAX_SAFE_INTEGER;

    return parseInt(numeric[0], 10);
  };

  const sortedData = React.useMemo(() => {
    let data = [...filteredData];

    // -----------------------------------------
    // SEARCH FILTER
    // -----------------------------------------
    data = data.filter(item =>
      Object.values(item).some(val =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    // -----------------------------------------
    // SORTING (without rank recalculation)
    // -----------------------------------------
    if (sortConfig.key) {
      data.sort((a, b) => {
        let x = a[sortConfig.key];
        let y = b[sortConfig.key];

        // Employee ID numeric sorting
        if (sortConfig.key === "id") {
          x = parseEmpId(x);
          y = parseEmpId(y);
        }

        // Numeric sorting for score & rank
        if (["score", "rank"].includes(sortConfig.key)) {
          x = Number(x);
          y = Number(y);
        }

        if (x < y) return sortConfig.direction === "asc" ? -1 : 1;
        if (x > y) return sortConfig.direction === "asc" ? 1 : -1;

        return (a.name || "").localeCompare(b.name || "");
      });
    }

    return data;
  }, [filteredData, sortConfig, searchTerm]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const paginatedData = sortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const requestSort = (key) => {
    // If clicking same column → toggle ASC/DESC
    if (sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === "asc" ? "desc" : "asc"
      });
    } else {
      // New column click → always start ASC
      setSortConfig({ key, direction: "asc" });
    }
  };

  const SortIcon = ({ state, onClick }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center justify-center ms-1 p-0"
      style={{ background: "transparent", border: "none", cursor: "pointer" }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        {state === "asc" ? (
          <>
            <path d="M3 13L3 3M3 3L1 5M3 3L5 5" />
            <line x1="9" y1="3" x2="13" y2="3" />
            <line x1="9" y1="8" x2="16" y2="8" />
            <line x1="9" y1="13" x2="19" y2="13" />
          </>
        ) : state === "desc" ? (
          <>
            <path d="M3 3L3 13M3 13L1 11M3 13L5 11" />
            <line x1="9" y1="3" x2="19" y2="3" />
            <line x1="9" y1="8" x2="16" y2="8" />
            <line x1="9" y1="13" x2="13" y2="13" />
          </>
        ) : (
          <>
            <path d="M3 3L1 5M3 3L5 5M3 13L1 11M3 13L5 11" />
            <line x1="9" y1="3" x2="14" y2="3" />
            <line x1="9" y1="8" x2="17" y2="8" />
            <line x1="9" y1="13" x2="14" y2="13" />
          </>
        )}
      </svg>
    </button>
  );

  const getSortState = (col) => {
    if (sortConfig.key !== col) return "none";
    return sortConfig.direction === "asc" ? "asc" : "desc";
  };

  // Ensure tooltips initialize AFTER DOM updates
  useEffect(() => {
    if (!window.bootstrap || !window.bootstrap.Tooltip) return;

    // Delay until React finishes rendering DOM
    requestAnimationFrame(() => {
      // Remove old tooltips
      document.querySelectorAll(".tooltip").forEach((t) => t.remove());

      // Initialize new tooltips
      document.querySelectorAll("[data-bs-toggle='tooltip']").forEach((el) => {
        try {
          new window.bootstrap.Tooltip(el);
        } catch (e) {
          console.warn("Tooltip failed:", e);
        }
      });
    });
  }, [filteredData, currentPage, pageSize, sortConfig]);


  return (
    <div className="container py-4">
      {loading && <LoadingOverlay />}

      <h5 className="fw-bold mb-4 text-dark">EMPLOYEE PERFORMANCE REPORTS</h5>

      <div className="card shadow-sm border-0 p-4">

        {/* ---------------- FORM ---------------- */}
        <form onSubmit={handleSubmit} className="card shadow-sm border-0 p-3 mb-4">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <label className="fw-semibold me-2">Report Type:</label>

            {["weekly", "manager", "department"].map((type) => (
              <div key={type} className="form-check form-check-inline">
                <input
                  className="form-check-input"
                  type="radio"
                  name="reportType"
                  id={`type-${type}`}
                  value={type}
                  checked={reportType === type}
                  onChange={async (e) => {
                    const type = e.target.value;
                    setReportType(type)

                    if (type === 'weekly') navigate('/reports/weekly')
                    if (type === 'manager') navigate('/reports/manager')
                    if (type === 'department') navigate('/reports/department')

                    setHasUserInteracted(false);
                    setHasManagerInteracted(false);
                    setHasDepartmentInteracted(false);
                    setIsWeekChanged(false);

                    setSelectedOption(type === "manager" ? "ALL_MGR" :
                                      type === "department" ? "ALL_DEPT" : "");

                    // ✅ Clear search term when switching report types
                    setSearchTerm("");

                    // ✅ Auto-load data based on report type
                    const { year, week } = parseWeek(selectedWeek2);
                    if (year && week) {
                      if (type === "manager") {
                        await fetchReport("manager", "ALL_MGR", null, week, year);
                      } else if (type === "department") {
                        await fetchReport("department", null, "ALL_DEPT", week, year);
                      } else if (type === "weekly") {
                        await fetchReport("weekly", null, null, week, year);
                      }
                    }
                  }}
                />
                <label className="form-check-label text-capitalize">
                  {reportTitleMap[type]}
                </label>
              </div>
            ))}
          </div>

          <div className="row align-items-end mt-4">
            <div className="col-md-3">
              <label className="form-label fw-semibold">Select Week</label>
              <input
                type="week"
                className="form-control"
                value={selectedWeek2}
                max={maxSelectableWeek}
                onChange={(e) => {
                  const value = e.target.value;

                  setSelectedWeek2(value);
                  localStorage.setItem("selectedWeek", value);

                  setHasUserInteracted(true);
                  setIsWeekChanged(true);

                }}
              />
            </div>

            {(reportType === "manager" || reportType === "department") && (
              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  {reportType === "manager" ? "Manager:" : "Department:"}
                </label>

                {reportType === "manager" ? (
                  <select
                    className="form-select"
                    value={selectedOption}
                    onChange={(e) => {
                      setSelectedOption(e.target.value);
                      
                      // ✅ Clear search when changing manager selection
                      setSearchTerm("");
                      
                      // Enable Submit button when dropdown changes (including back to "All Managers")
                      setHasManagerInteracted(true);
                    }}
                  >
                    <option value="ALL_MGR">All Managers</option>
                    
                    {managers.length === 0 ? (
                      <option value="" disabled>Loading managers...</option>
                    ) : (
                      (managers || []).map((m) => (
                        <option key={m.emp_id} value={m.emp_id}>
                          {m.full_name} ({m.emp_id})
                        </option>
                      ))
                    )}
                  </select>
                ) : (
                  <select
                    className="form-select"
                    value={selectedOption}
                    onChange={(e) => {
                      setSelectedOption(e.target.value);
                      
                      // ✅ Clear search when changing department selection
                      setSearchTerm("");
                      
                      // Enable Submit button when dropdown changes (including back to "All Departments")
                      setHasDepartmentInteracted(true);
                    }}
                  >
                    <option value="ALL_DEPT">All Departments</option>
                    
                    {departments.length === 0 ? (
                      <option value="" disabled>Loading departments...</option>
                    ) : (
                      departments.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.name}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>
            )}

            <div className="col-md-3">
              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={
                  !(
                    hasUserInteracted ||
                    hasManagerInteracted ||
                    hasDepartmentInteracted
                  )
                }
              >
                Submit
              </button>
            </div>
          </div>
        </form>

        {/* ---------------- REPORT TABLE ---------------- */}
        {!loading && (
          <div ref={reportRef}>

            <div className="dt-toolbar">
              <div className="dt-toolbar-inner">

                <div className="dt-left">
                  <div>
                    Show{" "}
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="form-select d-inline-block mx-2"
                      style={{ width: "70px" }}
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                    </select>
                    entries
                  </div>

                  <div className="search-input-wrapper">
                    <input
                      type="text"
                      placeholder="Search report..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                </div>

                <div className="dt-right d-flex align-items-center gap-3">

                  <i
                    className="bi bi-file-earmark-excel text-success fs-4"
                    role="button"
                    data-bs-toggle="tooltip"
                    data-bs-placement="top"
                    data-bs-title="Export Excel"
                    onClick={() => exportExcel(sortedData, getColumnConfig(), `${getReportTitle()}.xlsx`)}
                  ></i>

                  <i
                    className={`bi bi-printer fs-4 ${isPrinting ? "text-secondary" : "text-primary"}`}
                    role="button"
                    data-bs-toggle="tooltip"
                    data-bs-placement="top"
                    data-bs-title="Print Report"
                    onClick={handlePrint}
                  ></i>

                </div>

              </div>
            </div>

            {/* Table */}
            <div className="dt-wrapper" style={{ minHeight: "300px" }}>
              <div className="table-responsive">
              <table
                className="table dt-table align-middle"
                style={{ whiteSpace: "nowrap", width: "100%" }}
              >
                <thead className="custom-table-header">
                  <tr>
                    {reportType === "weekly" && (
                      <>
                        <th onClick={() => requestSort("id")} style={{ cursor: "pointer" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Emp ID</span>
                            <SortIcon 
                              state={getSortState("id")}
                              onClick={() => requestSort("id")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("name")} style={{ cursor: "pointer" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Employee Name</span>
                            <SortIcon 
                              state={getSortState("name")}
                              onClick={() => requestSort("name")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("department")} style={{ cursor: "pointer" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Department</span>
                            <SortIcon 
                              state={getSortState("department")}
                              onClick={() => requestSort("department")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("manager")} style={{ cursor: "pointer" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Manager</span>
                            <SortIcon 
                              state={getSortState("manager")}
                              onClick={() => requestSort("manager")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("score")} style={{ cursor: "pointer", textAlign:"right" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Score</span>
                            <SortIcon 
                              state={getSortState("score")}
                              onClick={() => requestSort("score")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("rank")} style={{ cursor: "pointer", textAlign:"center" }}>
                          <div className="d-flex justify-content-between align-items-center w-100">
                            <span className="mx-auto">Rank</span>
                            <SortIcon 
                              state={getSortState("rank")}
                              onClick={() => requestSort("rank")}
                            />
                          </div>
                        </th>
                      </>
                    )}

                    {reportType === "department" && (
                      <>
                        <th onClick={() => requestSort("department")} style={{ cursor:"pointer" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Department</span>
                            <SortIcon 
                              state={getSortState("department")}
                              onClick={() => requestSort("department")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("id")} style={{ cursor:"pointer" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Emp ID</span>
                            <SortIcon 
                              state={getSortState("id")}
                              onClick={() => requestSort("id")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("name")} style={{ cursor:"pointer" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Employee Name</span>
                            <SortIcon 
                              state={getSortState("name")}
                              onClick={() => requestSort("name")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("manager")} style={{ cursor:"pointer" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Manager</span>
                            <SortIcon 
                              state={getSortState("manager")}
                              onClick={() => requestSort("manager")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("score")} style={{ cursor:"pointer", textAlign:"right" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Score</span>
                            <SortIcon 
                              state={getSortState("score")}
                              onClick={() => requestSort("score")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("rank")} style={{ cursor:"pointer", textAlign:"center" }}>
                          <div className="d-flex justify-content-between align-items-center w-100">
                            <span className="mx-auto">Rank</span>
                            <SortIcon 
                              state={getSortState("rank")}
                              onClick={() => requestSort("rank")}
                            />
                          </div>
                        </th>
                      </>
                    )}

                    {reportType === "manager" && (
                      <>
                        <th onClick={() => requestSort("manager")} style={{ cursor:"pointer" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Manager</span>
                            <SortIcon 
                              state={getSortState("manager")}
                              onClick={() => requestSort("manager")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("department")} style={{ cursor:"pointer" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Department</span>
                            <SortIcon 
                              state={getSortState("department")}
                              onClick={() => requestSort("department")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("id")} style={{ cursor:"pointer" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Emp ID</span>
                            <SortIcon 
                              state={getSortState("id")}
                              onClick={() => requestSort("id")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("name")} style={{ cursor:"pointer" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Employee Name</span>
                            <SortIcon 
                              state={getSortState("name")}
                              onClick={() => requestSort("name")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("score")} style={{ cursor:"pointer", textAlign:"right" }}>
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Score</span>
                            <SortIcon 
                              state={getSortState("score")}
                              onClick={() => requestSort("score")}
                            />
                          </div>
                        </th>

                        <th onClick={() => requestSort("rank")} style={{ cursor:"pointer", textAlign:"center" }}>
                          <div className="d-flex justify-content-between align-items-center w-100">
                            <span className="mx-auto">Rank</span>
                            <SortIcon 
                              state={getSortState("rank")}
                              onClick={() => requestSort("rank")}
                            />
                          </div>
                        </th>
                      </>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {sortedData.length === 0 ? (
                    <tr className="empty-state-row">
                      <td colSpan="6" className="empty-state-row">
                        <div style={{ fontSize: "3rem", color: "#ccc" }}>
                          <i className="bi bi-inbox"></i>
                        </div>
                        <p className="mt-3 text-muted mb-0" style={{ fontSize: "1.1rem" }}>
                          No data available for the selected filters
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((emp) => (
                      <tr key={emp.id}>
                        {reportType === "weekly" && (
                          <>
                            <td>{emp.id}</td>
                            <td>{emp.name}</td>
                            <td>{emp.department}</td>
                            <td>{emp.manager}</td>

                            <td style={{ cssText: "text-align: right !important;" }}>{emp.score}</td>
                            <td style={{ textAlign: "center" }}>{emp.rank}</td>
                          </>
                        )}

                        {reportType === "department" && (
                          <>
                            <td>{emp.department}</td>
                            <td>{emp.id}</td>
                            <td>{emp.name}</td>
                            <td>{emp.manager}</td>

                            <td style={{ cssText: "text-align: right !important;" }}>{emp.score}</td>
                            <td style={{ textAlign: "center" }}>{emp.rank}</td>
                          </>
                        )}

                        {reportType === "manager" && (
                          <>
                            <td>{emp.manager}</td>
                            <td>{emp.department}</td>
                            <td>{emp.id}</td>
                            <td>{emp.name}</td>

                            <td style={{ cssText: "text-align: right !important;" }}>{emp.score}</td>
                            <td style={{ textAlign: "center" }}>{emp.rank}</td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </div>

            <div className="dt-pagination d-flex justify-content-between align-items-center mt-3">

              <div className="text-muted" style={{ fontWeight: "normal", margin: 0 }}>
                Showing {(currentPage - 1) * pageSize + 1} – 
                {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} records
              </div>

              <nav>
                <ul className="pagination mb-0">

                  {/* FIRST */}
                  <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                    <button className="page-link" onClick={() => setCurrentPage(1)}>«</button>
                  </li>

                  {/* PREVIOUS */}
                  <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                    <button className="page-link" onClick={() => setCurrentPage(currentPage - 1)}>‹</button>
                  </li>

                  {/* DYNAMIC PAGE NUMBERS */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p >= currentPage - 2 && p <= currentPage + 2)
                    .map(p => (
                      <li key={p} className={`page-item ${currentPage === p ? "active" : ""}`}>
                        <button className="page-link" onClick={() => setCurrentPage(p)}>{p}</button>
                      </li>
                    ))}

                  {/* NEXT */}
                  <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                    <button className="page-link" onClick={() => setCurrentPage(currentPage + 1)}>›</button>
                  </li>

                  {/* LAST */}
                  <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                    <button className="page-link" onClick={() => setCurrentPage(totalPages)}>»</button>
                  </li>

                </ul>
              </nav>
            </div>
          </div>
        )}
      </div> 
    </div>
  );
}

export default DynamicPerformanceReport;