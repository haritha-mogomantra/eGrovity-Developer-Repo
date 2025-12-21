import React, { useEffect, useState, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import * as bootstrap from "bootstrap";
window.bootstrap = bootstrap;
import { exportExcel } from "../../utils/exportExcel";
import { Bar } from "react-chartjs-2";
import axiosInstance from "../../utils/axiosInstance";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,

} from "chart.js";

import { LineElement, PointElement } from "chart.js";
ChartJS.register(
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);

  // Darker, strong department color
  return `hsl(${hue}, 75%, 38%)`;  
}



function PerformanceDashboard() {

  const headerRefs = useRef({});
  const [employees, setEmployees] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const DEFAULT_PROFILE = "/images/default-profile.png";
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("all");
  const [headerEmployee, setHeaderEmployee] = useState(null);
  const [deptColors, setDeptColors] = useState({});



  const loggedInEmpId = localStorage.getItem("emp_id");
  const loggedInName = localStorage.getItem("employee_name");
  const loggedInDept = localStorage.getItem("department");
  const loggedInManager = localStorage.getItem("manager");


  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        //Get latest completed week
        const latestWeekRes = await axiosInstance.get("performance/latest-week/");
        const { week, year } = latestWeekRes.data;
        localStorage.setItem("latest_week", `Week-${week}`);
        localStorage.setItem("latest_year", year);

        const role = localStorage.getItem("role");

        // Only employees should load their personal dashboard header
        if (role === "Employee" && loggedInEmpId) {
          const empRes = await axiosInstance.get(
            `performance/evaluation-by-emp/${loggedInEmpId}/`
          );

          setHeaderEmployee({
            name: empRes.data.employee.employee_name,
            department: empRes.data.employee.department_name,
            manager: empRes.data.evaluations[0]?.manager_name || "-"
          });
        }
        let performanceURL = "performance/summary/";

        // If latest completed week exists use it
        if (week && year) {
          performanceURL = `performance/summary/?week=${week}&year=${year}`;
        } 
        // ELSE fallback to most recent data automatically
        else {
          console.warn("No completed week found, falling back to latest available data");
        }

        let allRecords = [];
        let nextUrl = performanceURL;

        while (nextUrl) {
          const response = await axiosInstance.get(nextUrl);
          const data = response.data;

          allRecords = [...allRecords, ...(data.results?.records || [])];

          // Convert absolute URL to relative for axiosInstance baseURL
          nextUrl = data.next
            ? data.next.replace(/^.*\/api\//, "")
            : null;
        }

        const records = allRecords;

        const formatted = records.map(item => {

          //  REMOVE backend primary key
          if ("id" in item) {
            delete item.id;
          }

          return {
            emp_id: item.emp_id,
            name:
              item.full_name ||
              item.employee_name ||
              item.name ||
              `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
              "Unknown",
            department: item.department_name || "N/A",
            score: item.total_score || 0,
            rank: item.rank,
            profile_picture: item.profile_picture || "",
            designation: item.designation || "Not Assigned",
          };
        });

        // ✅ USE BACKEND RANK AS-IS (DO NOT RECALCULATE)
        setEmployees(formatted);

        const uniqueDepartments = [...new Set(formatted.map(emp => emp.department))];

        const departmentObjects = uniqueDepartments.map((dept, index) => ({
          id: index + 1,
          name: dept
        }));

        setDepartments(departmentObjects);

        const colors = {};
        uniqueDepartments.forEach(dept => {
          colors[dept] = stringToColor(dept); 
        });
        setDeptColors(colors);


      } catch (error) {
        console.error("Dashboard load error:", error);
      }
    };

    fetchDashboard();
    
  }, [loggedInEmpId]);

  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(el => new window.bootstrap.Tooltip(el));
  }, []);


  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    // Scroll column into view just like EmployeeTables
    setTimeout(() => {
      if (headerRefs.current[key]) {
        headerRefs.current[key].scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }, 300);
  };

  const getSortState = (col) => {
    if (sortConfig.key !== col) return "none";
    return sortConfig.direction === "asc" ? "asc" : "desc";
  };


  // FILTERING LIKE EMPLOYEE PERFORMANCE
  const filteredEmployees = employees.filter(emp => {
    const deptMatch =
      selectedDept === "all" ? true : emp.department === selectedDept;

    const term = searchTerm.toLowerCase();

    const searchMatch =
      String(emp.emp_id).toLowerCase().includes(term) ||
      emp.name.toLowerCase().includes(term) ||
      emp.department.toLowerCase().includes(term);

    return deptMatch && searchMatch;
  });

  // ================= DEPARTMENT-WISE RANK (STABLE & CORRECT) =================
  const departmentRankMap = {};

  if (selectedDept !== "all") {
    const deptEmployees = employees
      .filter(emp => emp.department === selectedDept)
      .sort((a, b) => b.score - a.score);

    deptEmployees.forEach((emp, index) => {
      departmentRankMap[emp.emp_id] = index + 1;
    });
  }

  const maxRank =
    employees.length > 0
      ? Math.max(...employees.map(e => e.rank))
      : 0;

  const bottom3Ranks = [...new Set(employees.map(e => e.rank))]
    .sort((a, b) => b - a)
    .slice(0, 3);

  const topPerformers = employees.filter(
    emp => emp.rank <= 3 && emp.score > 0
  );

  const lowPerformers = employees.filter(
    emp => emp.rank >= maxRank - 2 && emp.score > 0
  );

  // ================= DEPARTMENT-WISE TOP 3 =================
  const departmentTop3 = {};

  filteredEmployees.forEach((emp) => {
    if (!departmentTop3[emp.department]) {
      departmentTop3[emp.department] = [];
    }
    departmentTop3[emp.department].push(emp);
  });

  Object.keys(departmentTop3).forEach((dept) => {
    departmentTop3[dept] = departmentTop3[dept]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  });


// SORTING LIKE EMPLOYEE PERFORMANCE
let displayEmployees = [...filteredEmployees];

if (sortConfig.key) {
  displayEmployees.sort((a, b) => {
    const key = sortConfig.key;
    const direction = sortConfig.direction;

    let valA = a[key] ?? "";
    let valB = b[key] ?? "";

    if (typeof valA === "number" && typeof valB === "number") {
      return direction === "asc" ? valA - valB : valB - valA;
    }

    return direction === "asc"
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });
} else {
  // Default sorting:
  // 1️⃣ Ranked employees first
  // 2️⃣ Absent employees (rank === null or score === 0) at bottom
  displayEmployees.sort((a, b) => {
    if ((a.rank === null || a.score === 0) && (b.rank === null || b.score === 0)) return 0;
    if (a.rank === null || a.score === 0) return 1;
    if (b.rank === null || b.score === 0) return -1;
    return a.rank - b.rank;
  });
}

// ============ GROUPED BAR CHART DATA ==============

// X-axis labels = departments
const chartLabels = Object.keys(departmentTop3);

// Create a dataset for each employee rank (1st, 2nd, 3rd)
const chartDatasets = [0, 1, 2].map((rankIndex) => {
  return {
    label: `Rank ${rankIndex + 1}`,
    data: chartLabels.map((dept) => {
      const emp = departmentTop3[dept][rankIndex];
      return emp ? emp.score : 0;
    }),
    backgroundColor:
      rankIndex === 0 ? "#8e44ad" :   // Purple - Rank 1
      rankIndex === 1 ? "#2980b9" :   // Blue   - Rank 2
      "#d4ac0d",                      // Gold   - Rank 3

    borderRadius: 5,
    barThickness: 30,
  };
});

const chartData = {
  labels: chartLabels,
  datasets: chartDatasets,
};


  // ============ GROUPED BAR CHART OPTIONS ==============
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: { font: { size: 12, weight: "bold" } }
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const dept = chartLabels[context.dataIndex];
            const emp = departmentTop3[dept]?.[context.datasetIndex];
            if (!emp) return "";
            return `${emp.name}: ${emp.score}`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: false,
        barPercentage: 0.65,
        categoryPercentage: 0.55,
        ticks: {
          autoSkip: false,          // <--- IMPORTANT: Show all labels
          maxRotation: 0,
          minRotation: 0,
          callback: function (value) {
            const label = this.getLabelForValue(value);

            // Word-wrap into multiple lines (max 2 words per line)
            const words = label.split(" ");
            const maxWordsPerLine = 2;
            let lines = [];

            for (let i = 0; i < words.length; i += maxWordsPerLine) {
              lines.push(words.slice(i, i + maxWordsPerLine).join(" "));
            }

            return lines;
          },
          font: { size: 12, weight: "600" },
        },
        title: {
          display: true,
          text: "Departments",
          font: { size: 14, weight: "bold" },
        },
      },
      y: {
        beginAtZero: true,
        min: 0,
        max: 1500,
        ticks: { stepSize: 250 },
        title: {
          display: true,
          text: "Performance Score",
          font: { weight: "bold" },
        },
      },
    },
  };

const getDeptColor = (dept) => {
  const bg = deptColors[dept] || "hsl(0, 0%, 40%)"; // fallback dark gray

  return {
    backgroundColor: bg,
    color: "white",           // WHITE TEXT
    padding: "4px 14px",
    borderRadius: "14px",
    fontWeight: "700",        // bold
    fontSize: "12px",
    display: "inline-block",
  };
};


  const openEmployeeModal = (emp) => {
    setSelectedEmployee(emp);
    setShowModal(true);
  };

  const totalPages = Math.ceil(filteredEmployees.length / pageSize);

  // CHANGE PAGE FUNCTION
  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  
  const indexOfLast = currentPage * pageSize;
  const indexOfFirst = indexOfLast - pageSize;
  const currentEmployees = displayEmployees.slice(indexOfFirst, indexOfLast);

  const dashboardEmployee = selectedEmployee || headerEmployee || {
    name: "-",
    department: "-",
    manager: "-",
  };

  const printTable = () => {
    const rowsPerPage = 25;

    const latestWeek = localStorage.getItem("latest_week") || "Week";
    const latestYear = localStorage.getItem("latest_year") || new Date().getFullYear();

    const headingTitle = `EMPLOYEE PERFORMANCE REPORT – ${latestWeek} (${latestYear})`;
    const printedOn = `Printed on: ${new Date().toLocaleString()}`;

    let pagesHTML = "";
    let currentPageRows = [];

    filteredEmployees.forEach((emp, index) => {
      const isTop = emp.rank <= 3;
      const isLow = emp.rank >= maxRank - 2;

      currentPageRows.push(`
        <tr class="${isTop ? "top-performer" : isLow ? "low-performer" : ""}">
          <td>${emp.emp_id}</td>
          <td>${emp.name}</td>
          <td>${emp.department}</td>
          <td>${emp.score}</td>
          <td>${emp.rank}</td>
        </tr>
      `);

      if (currentPageRows.length === rowsPerPage || index === filteredEmployees.length - 1) {
        pagesHTML += `
          <div class="print-page">
            <h2 class="text-center fw-bold mb-1">${headingTitle}</h2>
            <p class="text-center text-muted mb-4" style="font-size: 14px;">${printedOn}</p>

            <table class="table table-bordered table-sm">
              <thead class="header-row">
                <tr>
                  <th>Emp ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Score</th>
                  <th>Rank</th>
                </tr>
              </thead>
              <tbody>
                ${currentPageRows.join("")}
              </tbody>
            </table>

            <div class="text-center mt-3 text-muted" style="font-size: 12px;">
              Page ${Math.ceil(index / rowsPerPage) + 1}
            </div>
          </div>
        `;

        currentPageRows = [];
      }
    });

    const printWindow = window.open("", "_blank");
    printWindow.document.open();

    printWindow.document.write(`
      <html>
        <head>
          <title>Performance Report</title>

          <link rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" />

          <style>
            body { margin: 20px; font-family: Arial, sans-serif; }

            .print-page {
              page-break-after: always;
              padding: 10px 20px;
            }

            table {
              width: 100%;
              border-collapse: collapse !important;
              font-size: 13px;
            }

            th {
              background: #f0f0f0 !important;
              font-weight: bold !important;
              padding: 8px !important;
            }

            td {
              padding: 8px !important;
            }

            .top-performer td {
              background-color: #e8f7ee !important;
            }

            .low-performer td {
              background-color: #fdeaea !important;
            }

            @media print {
              thead { display: table-header-group !important; }
              tfoot { display: table-footer-group !important; }
              tr { page-break-inside: avoid !important; }
            }
          </style>
        </head>

        <body>${pagesHTML}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };


  const exportEmployeePerformanceExcel = (data) => {
    if (!data || data.length === 0) return;

    const latestWeek = localStorage.getItem("latest_week") || "Week";
    const latestYear = localStorage.getItem("latest_year") || new Date().getFullYear();

    const fileName = `Employee-Performance-Report-${latestWeek}-${latestYear}.xlsx`;

    const cleaned = data.map(emp => ({
      "Emp ID": emp.emp_id,
      "Name": emp.name,
      "Department": emp.department,
      "Score": emp.score,
      "Rank": emp.rank
    }));

    const headingText = `EMPLOYEE PERFORMANCE REPORT – ${latestWeek} (${latestYear})`;
    const heading = [[headingText], [""]];

    import("xlsx").then((XLSX) => {
      const worksheet = XLSX.utils.json_to_sheet([]);

      XLSX.utils.sheet_add_aoa(worksheet, heading, { origin: "A1" });
      XLSX.utils.sheet_add_json(worksheet, cleaned, { origin: "A3" });

      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
      ];

      worksheet["A1"].s = {
        font: { bold: true, sz: 16 },
        alignment: { horizontal: "center" }
      };

      worksheet["!cols"] = [
        { wch: 12 },
        { wch: 22 },
        { wch: 28 },
        { wch: 10 },
        { wch: 10 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Performance");

      XLSX.writeFile(workbook, fileName);
    });
  };

  // --- Sort Icon Component (Same as EmployeeTables) ---
  const SortIcon = ({ sortState, onClick }) => {
    return (
      <button 
        onClick={onClick}
        className="inline-flex items-center justify-center ms-1 cursor-pointer hover-opacity p-1"
        aria-label="Sort"
        style={{ background: "transparent", border: "none" }}
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
          {sortState === "asc" ? (
            <>
              <path d="M3 13L3 3M3 3L1 5M3 3L5 5" />
              <line x1="9" y1="3" x2="13" y2="3" />
              <line x1="9" y1="8" x2="16" y2="8" />
              <line x1="9" y1="13" x2="19" y2="13" />
            </>
          ) : sortState === "desc" ? (
            <>
              <path d="M3 3L3 13M3 13L1 11M3 13L5 11" />
              <line x1="9" y1="3" x2="19" y2="3" />
              <line x1="9" y1="8" x2="16" y2="8" />
              <line x1="9" y1="13" x2="13" y2="13" />
            </>
          ) : (
            <>
              <path d="M3 13L3 3M3 3L1 5M3 3L5 5" />
              <path d="M3 13L1 11M3 13L5 11" />
              <line x1="9" y1="3" x2="14" y2="3" />
              <line x1="9" y1="8" x2="17" y2="8" />
              <line x1="9" y1="13" x2="14" y2="13" />
            </>
          )}
        </svg>
      </button>
    );
  };


  return (
    <div>
      <div className=" text-dark">
        <h5 className="">DASHBOARD</h5>
      </div>

      {/* ============== TOP & WEAK MEMBERS ROW ============== */}
      <div className="row mt-4 mb-4">

        {/* TOP MEMBERS */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header fw-bold">Top 3 Employees</div>
            <div className="card-body">

              {topPerformers?.length > 0 ? (
                topPerformers.map((emp) => (
                <div 
                  key={emp.emp_id}
                  onClick={() => openEmployeeModal(emp)}
                  className="employee-card d-flex align-items-center justify-content-between py-2">

                  <div className="d-flex align-items-center">
                    <img
                      src={emp.profile_picture || DEFAULT_PROFILE}
                      alt="profile"
                      className="rounded-circle me-2"
                      style={{ width: "38px", height: "38px", objectFit: "cover" }}
                    />

                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <strong>{emp.name}</strong>
              
                        <span className="badge" style={getDeptColor(emp.department)}>
                          {emp.department}
                        </span>
                      </div>
                      <small className="text-muted">{emp?.designation || "Not Assigned"}</small>
                    </div>
                  </div>

                  <div className="text-end">
                    <small className="text-muted">Score</small>
                    <div className="fw-bold fs-5">{emp.score}</div>
                  </div>

                </div>
                ))
              ) : (
                <div className="text-muted">No top performers</div>
              )}

            </div>
          </div>
        </div>

        {/* WEAK MEMBERS */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header fw-bold">Bottom 3 Employees</div>
            <div className="card-body">

              {lowPerformers?.length > 0 ? (
                lowPerformers.map((emp) => (
                <div 
                  key={emp.emp_id}
                  onClick={() => openEmployeeModal(emp)}
                  className="employee-card d-flex align-items-center justify-content-between py-2">

                  <div className="d-flex align-items-center">
                    <img
                      src={emp.profile_picture || DEFAULT_PROFILE}
                      alt="profile"
                      className="rounded-circle me-2"
                      style={{ width: "38px", height: "38px", objectFit: "cover" }}
                    />

                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <strong>{emp.name}</strong>
                        <span className="badge" style={getDeptColor(emp.department)}>
                          {emp.department}
                        </span>
                      </div>
                      <small className="text-muted">{emp?.designation || "Not Assigned"}</small>
                    </div>
                  </div>

                  <div className="text-end">
                    <small className="text-muted">Score</small>
                    <div className="fw-bold fs-5">{emp.score}</div>
                  </div>

                </div>
                ))
              ) : (
                <div className="text-muted">No bottom performers</div>
              )}

            </div>
          </div>
        </div>

      </div>

      {/* ================= CHART ROW ================= */}
      <div className="row">

        <div className="col-md-12 mt-3">
          <div className="card shadow-sm">

            <div className="card-header text-white bg-info fw-bold">
              <h5>Department-Wise Weekly Performance Chart</h5>
            </div>

            {/* CHART GOES HERE */}
            <div className="p-4" style={{ height: "420px", overflowX: "auto", whiteSpace: "nowrap" }}>
              {chartLabels?.length > 0 ? (
                <Bar data={chartData} options={chartOptions} />
              ) : (
                <div className="text-center text-muted mt-5">
                  <i className="bi bi-bar-chart fs-1"></i>
                  <p className="mt-2">No data available to display the chart</p>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      

      {/* ========== TABLE CARD (DATATABLE VERSION) ========== */}
      <div className="card mt-5 shadow-sm p-3" id="print-area">
    
        {/* --- HEADER + DROPDOWN (MOVED FROM ABOVE CARD) --- */}
        <div className="d-flex justify-content-between align-items-center mb-0">

          <div>
            <h5 className="mb-0 fw-semibold text-dark">
              All Employee Performance
            </h5>
            <small className="text-muted">
              Weekly ranking overview of all employees
            </small>
          </div>

          <div style={{ minWidth: "220px" }}>
            <select
              className="form-select"
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setCurrentPage(1);
                }}
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3"></div>

        {/* Toolbar */}
        <div className="dt-toolbar">
          <div className="dt-toolbar-inner">

            {/* LEFT SIDE */}
            <div className="dt-left">
              <div className="entries-block">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
                <span>entries</span>
              </div>

              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />

                {searchTerm && (
                  <span
                    className="search-clear"
                    onClick={() => {
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                  >
                    ✕
                  </span>
                )}
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="dt-right d-flex align-items-center gap-3">
              <i
                className="bi bi-file-earmark-excel fs-4 text-success"
                role="button"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                title="Export to Excel"
                onClick={() => exportEmployeePerformanceExcel(filteredEmployees)}
              />
              <i
                className="bi bi-printer fs-4 text-primary"
                role="button"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                title="Print Table"
                onClick={printTable}
              />
            </div>

          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table
            className="table dt-table performance-table performance-dashboard-table align-middle"
            style={{ tableLayout: "fixed", width: "100%" }}
          >
            <thead>
              <tr>

                {/* EMP ID */}
                <th
                  ref={(el) => (headerRefs.current["emp_id"] = el)}
                  onClick={() => handleSort("emp_id")}
                  style={{ cursor: "pointer" }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Emp ID</span>
                    <SortIcon
                      sortState={getSortState("emp_id")}
                      onClick={(e) => { e.stopPropagation(); handleSort("emp_id"); }}
                    />
                  </div>
                </th>

                {/* NAME */}
                <th
                  ref={(el) => (headerRefs.current["name"] = el)}
                  onClick={() => handleSort("name")}
                  style={{ cursor: "pointer" }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Name</span>
                    <SortIcon
                      sortState={getSortState("name")}
                      onClick={(e) => { e.stopPropagation(); handleSort("name"); }}
                    />
                  </div>
                </th>

                {/* DEPARTMENT */}
                <th
                  ref={(el) => (headerRefs.current["department"] = el)}
                  onClick={() => handleSort("department")}
                  style={{ cursor: "pointer" }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Department</span>
                    <SortIcon
                      sortState={getSortState("department")}
                      onClick={(e) => { e.stopPropagation(); handleSort("department"); }}
                    />
                  </div>
                </th>

                {/* SCORE */}
                <th
                  ref={(el) => (headerRefs.current["score"] = el)}
                  onClick={() => handleSort("score")}
                  style={{ cursor: "pointer", textAlign: "right" }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Score</span>
                    <SortIcon
                      sortState={getSortState("score")}
                      onClick={(e) => { e.stopPropagation(); handleSort("score"); }}
                    />
                  </div>
                </th>

                {/* RANK */}
                <th
                  ref={(el) => (headerRefs.current["rank"] = el)}
                  onClick={() => handleSort("rank")}
                  style={{ cursor: "pointer", textAlign: "center" }}
                >
                  <div className="d-flex justify-content-between align-items-center w-100">
                    <span className="mx-auto">Rank</span>
                    <SortIcon
                      sortState={getSortState("rank")}
                      onClick={(e) => { e.stopPropagation(); handleSort("rank"); }}
                    />
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {currentEmployees.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-muted">
                    <i className="bi bi-inbox fs-1"></i>
                    <p className="mb-0 mt-2">No employees found</p>
                  </td>
                </tr>
              ) : (
                currentEmployees.map((emp) => {
                  const isTop = emp.rank !== null && emp.score > 0 && emp.rank <= 3;
                  const isLow = emp.rank !== null && emp.score > 0 && bottom3Ranks.includes(emp.rank);

                  const rowBg =
                    isTop ? "#ecfdf5" : isLow ? "#fef2f2" : "transparent";
                  return (
                    <tr key={emp.emp_id} className="performance-row py-1">
                      <td className="text-center" style={{ backgroundColor: rowBg }}>
                        {emp.emp_id}
                      </td>

                      <td className="text-start" style={{ backgroundColor: rowBg }}>
                        <div className="fw-normal m-0 p-0 lh-1">{emp.name}</div>
                      </td>

                      <td className="text-start" style={{ backgroundColor: rowBg }}>
                        <div className="fw-normal m-0 p-0 lh-1">{emp.department}</div>
                      </td>

                      <td
                        className="col-score text-end fw-normal"
                        style={{ backgroundColor: rowBg, paddingRight: "10px" }}
                      >
                        {emp.score}
                      </td>

                      <td
                        className="col-rank text-center fw-semibold"
                        style={{ backgroundColor: rowBg }}
                      >
                        {emp.score === 0
                          ? "—"
                          : selectedDept === "all"
                            ? emp.rank
                            : departmentRankMap[emp.emp_id]
                        }
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>

        {/* Pagination */}
        <div className="dt-pagination d-flex justify-content-between align-items-center mt-3">

          <div className="text-muted">
            Showing {(currentPage - 1) * pageSize + 1} –{" "}
            {Math.min(currentPage * pageSize, filteredEmployees.length)} of{" "}
            {filteredEmployees.length} records
          </div>

          <nav>
            <ul className="pagination mb-0">

              <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(1)}>«</button>
              </li>

              <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(currentPage - 1)}>‹</button>
              </li>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p >= currentPage - 2 && p <= currentPage + 2)
                .map((p) => (
                  <li key={p} className={`page-item ${currentPage === p ? "active" : ""}`}>
                    <button className="page-link" onClick={() => setCurrentPage(p)}>
                      {p}
                    </button>
                  </li>
                ))}

              <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(currentPage + 1)}>›</button>
              </li>

              <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(totalPages)}>»</button>
              </li>

            </ul>
          </nav>
        </div>

      </div>
      {showModal && selectedEmployee && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">

              <div className="modal-header">
                <h5 className="modal-title">Employee Details</h5>
                <button className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <div className="modal-body text-center">

                <img
                  src={selectedEmployee.profile_picture || DEFAULT_PROFILE}
                  className="rounded-circle mb-3 shadow"
                  width="90"
                  height="90"
                  style={{ objectFit: "cover" }}
                />

                <h4 className="fw-bold mb-1">{selectedEmployee.name}</h4>
                <div className="d-flex justify-content-center align-items-center gap-3 mt-1 mb-2">

                <small className="text-muted" style={{ fontSize: "15px" }}>
                  {selectedEmployee?.designation || "Not Assigned"}
                </small>

                <span
                  className="badge"
                  style={{
                    ...getDeptColor(selectedEmployee.department),
                    padding: "6px 14px",
                    fontSize: "13px"
                  }}
                >
                  {selectedEmployee.department}
                </span>

              </div>

                <hr className="my-3" />

                <div className="row text-start px-3">

                  <div className="col-6 mb-3">
                    <div className="text-uppercase text-muted small fw-semibold">
                      Employee ID
                    </div>
                    <div className="fw-bold">
                      {selectedEmployee.emp_id}
                    </div>
                  </div>

                  <div className="col-6 mb-3">
                    <div className="text-uppercase text-muted small fw-semibold">
                      Department
                    </div>
                    <div className="fw-bold">
                      {selectedEmployee?.department || "-"}
                    </div>
                  </div>

                  <div className="col-6 mb-3">
                    <div className="text-uppercase text-muted small fw-semibold">
                      Score
                    </div>
                    <div className="fw-bold">
                      {selectedEmployee.score}
                    </div>
                  </div>

                  <div className="col-6 mb-3">
                    <div className="text-uppercase text-muted small fw-semibold">
                      Rank
                    </div>
                    <div className="fw-bold">
                      {selectedEmployee.rank}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PerformanceDashboard;