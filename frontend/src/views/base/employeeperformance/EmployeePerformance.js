import React, { useState, useEffect, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";
import { CTooltip } from "@coreui/react";
import { useNavigate, useLocation } from "react-router-dom";
import axiosInstance from "../../../utils/axiosInstance";
import { useMasterData } from "../../../context/MasterDataContext";


const weekInputStyle = {
  fontFamily: "Segoe UI, Arial, sans-serif",
  fontSize: "14px",
  fontWeight: "400",
  color: "#212529",
};

const getISOWeek = (date) => {
  const temp = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  temp.setDate(temp.getDate() - dayNumber + 3);

  const firstThursday = temp.valueOf();
  temp.setMonth(0, 1);

  const week =
    Math.ceil((((firstThursday - temp) / 86400000) + temp.getDay() + 1) / 7);

  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

const today = new Date();
const maxWeek = getISOWeek(today);

const minWeek = "2000-W01";


 
function EmployeePerformance() {
  const navigate = useNavigate();
  const location = useLocation();
  const { masters } = useMasterData();

  const [employees, setEmployees] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [autoWeekLoaded, setAutoWeekLoaded] = useState(false);
  const [maxSelectableWeek, setMaxSelectableWeek] = useState("");
  const headerRefs = useRef({});


  useEffect(() => {

    if (location.state?.returnWeek) {
      setSelectedWeek(location.state.returnWeek);
      setAutoWeekLoaded(true);
      return;
    }
    else if (location.state?.selectedWeek) {
      setSelectedWeek(location.state.selectedWeek);
      setAutoWeekLoaded(true);
      return;
    }

    if (autoWeekLoaded) return;

    const today = new Date();
    const lastCompletedWeek = new Date(today);
    lastCompletedWeek.setDate(today.getDate() - 7);

    const formatted = getISOWeek(lastCompletedWeek);

    setSelectedWeek(formatted);
    setPage(1);
    setAutoWeekLoaded(true);
    setLoading(true);

  }, [location.state?.returnWeek, autoWeekLoaded]);
 

  // Fetch Performance Data
  useEffect(() => {
    const fetchPerformanceData = async () => {
      
      if (!selectedWeek) return;

      setEmployees([]);
      setLoading(true);
      setPageLoading(true);

      try {
        let url = "http://127.0.0.1:8000/api/performance/summary/?";

        // include sorting params when present
        if (sortConfig.key) {
          url += `sort_by=${sortConfig.key}&order=${sortConfig.direction}&`;
        }

        // Add search
        if (searchQuery) {
          url += `search=${encodeURIComponent(searchQuery)}&`;
        }

        if (selectedWeek && selectedWeek.includes("-W")) {
          let [year, wk] = selectedWeek.split("-W");
          year = parseInt(year);
          wk = parseInt(wk);

          if (!isNaN(year) && !isNaN(wk)) {
            url += `week=${wk}&year=${year}&`;
          }
        }

        // Pagination
        let paginatedUrl = `${url}page=${page}&page_size=${pageSize}`;

        const response = await axiosInstance.get(paginatedUrl);

        const backend = response.data;

        let finalRecords = [];

        if (backend.results?.records) {
          finalRecords = backend.results.records;
        }
        // Fallback
        else if (backend.records) {
          finalRecords = backend.records;
        }

        console.log("Extracted Records:", finalRecords);

        const sanitized = finalRecords.map(emp => ({
          ...emp,
          total_score: Number(emp.total_score),
          rank: Number(emp.rank),

          // Ensures consistent evaluation period display
          display_period:
            emp.display_period ||
            emp.evaluation_period ||
            emp.week_label ||
            "-"
        }));

        setEmployees(sanitized);
        setVisibleCount(finalRecords.length);
        setTotalRecords(backend.count || 0);
        setTotalPages(Math.ceil((backend.count || 0) / pageSize));
      } catch (error) {
        console.error("Error fetching performance data:", error);
        setEmployees([]);
        setTotalRecords(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    };

    fetchPerformanceData();
    // include sortConfig.key & sortConfig.direction so effect re-runs on sort changes
  }, [selectedWeek, page, pageSize, searchQuery, sortConfig.key, sortConfig.direction]);


 
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    setPage(1);

    // Scroll the clicked column into view AFTER table reload
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
 
  const getSortIcon = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === "asc" ? "▲" : "▼";
    }
    return "";
  };
 
  const handleNavigate = (emp, mode) => {
    const evalId =
      emp.evaluation_id ??
      emp.evaluation?.id ??
      emp.id;

    if (!evalId) {
      alert("No evaluation ID found for this record.");
      return;
    }

    navigate("/theme/performancemetrics", {
      state: {
        employee: emp,
        mode: mode === "edit" ? "edit" : "view", 
        evaluation_id: evalId,
        selectedWeek: selectedWeek
      }
    });
  };



  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(startRecord + visibleCount - 1, totalRecords);

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

 
  return (
    <div className="container">

      {pageLoading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(2px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            className="spinner-border text-primary"
            style={{ width: "4rem", height: "4rem" }}
          ></div>
        </div>
      )}
      <div className="text-dark">
        <h5>PERFORMANCE DETAILS</h5>
      </div>
 
      <div className="card shadow-sm">
        <div className="card-body p-3">

          <div className="dt-toolbar">
            <div className="dt-toolbar-inner">

              {/* LEFT SIDE */}
              <div className="dt-left">
                <div>
                  Show{" "}
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1); // reset to first page
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
                    value={searchQuery}
                    placeholder="Search performance..."
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                      setTotalRecords(0);
                      setTotalPages(1);
                    }}
                  />
                </div>

                <div className="week-wrapper">
                  <input
                    type="week"
                    style={weekInputStyle}
                    value={selectedWeek}
                    onChange={(e) => {
                      setSelectedWeek(e.target.value);
                      setPage(1);
                    }}
                    min="2000-W01"
                    max={maxWeek}
                  />
                </div>

              </div>

              {/* RIGHT SIDE */}
              <div className="dt-right d-flex align-items-center gap-2">
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    navigate("/theme/performancemetrics", {
                      state: { mode: "add", selectedWeek }
                    })
                  }
                >
                  <i className="bi bi-plus-circle me-1"></i> Add Performance
                </button>
              </div>

            </div>
          </div>
 
          <div className="dt-wrapper">
            <div className="table-responsive">
            <table
              className="table dt-table align-middle performance-table"
              style={{ whiteSpace: "nowrap", tableLayout: "auto" }}
            >
              <thead className="custom-table-header">
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
                        state={getSortState("emp_id")} 
                        onClick={() => handleSort("emp_id")} 
                      />
                    </div>
                  </th>

                  {/* FULL NAME */}
                  <th
                    ref={(el) => (headerRefs.current["full_name"] = el)}
                    onClick={() => handleSort("full_name")}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Full Name</span>
                      <SortIcon 
                        state={getSortState("full_name")} 
                        onClick={() => handleSort("full_name")} 
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
                        state={getSortState("department")} 
                        onClick={() => handleSort("department")} 
                      />
                    </div>
                  </th>

                  {/* EVALUATION PERIOD – NOT SORTABLE */}
                  <th>Evaluation Period</th>

                  {/* SCORE */}
                  <th
                    ref={(el) => (headerRefs.current["total_score"] = el)}
                    onClick={() => handleSort("total_score")}
                    className="col-score text-end"
                    style={{ cursor: "pointer" }}
                  >

                    <div className="d-flex justify-content-between align-items-center">
                      <span>Score</span>
                      <SortIcon 
                        state={getSortState("total_score")} 
                        onClick={() => handleSort("total_score")} 
                      />
                    </div>
                  </th>

                  {/* RANK */}
                  <th
                    ref={(el) => (headerRefs.current["rank"] = el)}
                    onClick={() => handleSort("rank")}
                    className="col-rank" style={{ cursor: "pointer" }}
                  >
                    <div className="d-flex justify-content-between align-items-center w-100">
                      <span className="mx-auto">Rank</span>
                      <SortIcon 
                        state={getSortState("rank")} 
                        onClick={() => handleSort("rank")} 
                      />
                    </div>
                  </th>

                  {/* ACTIONS – NOT SORTABLE */}
                  <th>Actions</th>

                </tr>
              </thead>
              <tbody>
                {loading && selectedWeek ? (
                  <>
                    {[...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan="7" className="placeholder-glow py-3">
                          <span className="placeholder col-12"></span>
                        </td>
                      </tr>
                    ))}
                  </>
                ) : employees.length > 0 ? (
                  employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>{emp.employee_emp_id || emp.emp_id || "-"}</td>
                      <td>{emp.employee_name || emp.full_name || "-"}</td>
                      <td>
                        {
                          masters?.DEPARTMENT?.find(
                            d =>
                              d.id === emp.department_id ||
                              d.name === emp.department ||
                              d.name === emp.department_name
                          )?.name || "-"
                        }
                      </td>
                      <td>
                        {emp.display_period ||
                        emp.evaluation_period ||
                        emp.week_label ||
                        "-"}
                      </td>

                      <td className="col-score text-end">{emp.total_score}</td>
                      <td className="col-rank">{emp.rank || "-"}</td>
                      <td>

                        <CTooltip content="Edit Performance" placement="top">
                          <button
                            className="btn btn-sm btn-info me-2"
                            onClick={() => handleNavigate(emp, "edit")}
                          >
                            <i className="bi bi-pencil-square text-white"></i>
                          </button>
                        </CTooltip>

                        <CTooltip content="View Performance" placement="top">
                          <button
                            className="btn btn-sm btn-warning"
                            onClick={() => handleNavigate(emp, "view")}
                          >
                            <i className="bi bi-eye text-white"></i>
                          </button>
                        </CTooltip>

                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="empty-state-row">
                    <td colSpan="7" className="text-center py-5">
                      <i className="bi bi-inbox" style={{ fontSize: "3rem", color: "#ccc" }}></i>
                      <p className="mt-3 text-muted mb-0">
                        No performance records found
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="dt-pagination d-flex justify-content-between align-items-center mt-3">

          <div className="text-muted" style={{ fontWeight: "normal", margin: 0}}>
            Showing {startRecord} – {endRecord} of {totalRecords} records
          </div>

          <nav>
            <ul className="pagination mb-0">

              {/* FIRST PAGE */}
              <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setPage(1)}>
                  «
                </button>
              </li>

              {/* PREVIOUS */}
              <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setPage(page - 1)}>
                  ‹
                </button>
              </li>

              {/* DYNAMIC PAGE NUMBERS */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p =>
                  p >= page - 2 && p <= page + 2
                )
                .map(p => (
                  <li key={p} className={`page-item ${page === p ? "active" : ""}`}>
                    <button className="page-link" onClick={() => setPage(p)}>
                      {p}
                    </button>
                  </li>
                ))}

              {/* NEXT */}
              <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setPage(page + 1)}>
                  ›
                </button>
              </li>

              {/* LAST PAGE */}
              <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setPage(totalPages)}>
                  »
                </button>
              </li>

            </ul>
          </nav>
        </div>
      </div>
    </div>
    </div>
  );
}

export default EmployeePerformance;