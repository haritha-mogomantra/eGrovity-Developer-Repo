import React, { useState, useEffect, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import axiosInstance from "../../../utils/axiosInstance";

const LoginDetails = () => {
  const API_URL = "http://127.0.0.1:8000/api/users/login-details/";
  const REGENERATE_URL = "http://127.0.0.1:8000/api/users/regenerate-password/";

  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [alert, setAlert] = useState({ show: false, message: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(null); // ✅ track per-row regen loading
  const [currentPage, setCurrentPage] = useState(1);
  const [entries, setEntries] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [allEmployees, setAllEmployees] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const headerRefs = useRef({});

  const fetchAllEmployees = async () => {
    try {
      let all = [];
      let page = 1;

      while (true) {
        const res = await axiosInstance.get(`users/login-details/?page=${page}`);
        const data = res.data;

        if (!data.results || data.results.length === 0) break;

        all.push(...data.results);

        if (!data.next) break;
        page++;
      }

      return all;
    } catch (error) {
      console.error("Error fetching all employees:", error);
      return [];
    }
  };

  // ==================================================
  // FETCH EMPLOYEES — Use backend temp_password only
  // ==================================================
  const fetchEmployees = async (page = 1, pageSize) => {
    setLoading(true);

    try {
      const res = await axiosInstance.get(
        `users/login-details/?page=${page}&page_size=${pageSize}`
      );
      const data = res.data;

      const employeesList = (data.results || []).map((emp) => ({
        ...emp,
        password: emp.temp_password || "",
      }));

      setEmployees(employeesList);
      setTotalRecords(data.count || 0);

    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setMenuLoading(true);

        const all = await fetchAllEmployees();
        setAllEmployees(all);

      } catch (err) {
        console.error(err);
      } finally {
        setMenuLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    
  }, [entries, currentPage, search]);

  
  // ==================================================
  // PASSWORD REGENERATION (Backend Only)
  // ==================================================
  const regeneratePassword = async (empId) => {
    setRegenLoading(empId); // show loader for specific row
    try {
      const response = await axiosInstance.post(
        `users/regenerate-password/${empId}/`
      );
      const data = response.data;

      const newPass = data.temp_password || data.password || "";

      // Update employees (paginated view)
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.emp_id === empId ? { ...emp, password: newPass, temp_password: newPass } : emp
        )
      );

      // Update ALL employees (search/sorting view)
      setAllEmployees((prev) =>
        prev.map((emp) =>
          emp.emp_id === empId ? { ...emp, password: newPass, temp_password: newPass } : emp
        )
      );

      setAlert({
        show: true,
        type: "success",
        message: data.message || `Password regenerated for ${empId}`,
      });

      setTimeout(() => setAlert({ show: false, message: "", type: "" }), 3000);
    } catch (error) {
      console.error("Error regenerating password:", error);
      setAlert({
        show: true,
        type: "danger",
        message: `Failed to regenerate password for ${empId}.`,
      });
    } finally {
      setRegenLoading(null); // ✅ stop loader
    }
  };

  // ==================================================
  // SORTING
  // ==================================================
  const getSortIcon = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === "asc" ? "▲" : "▼";
    }
    return "";
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    setCurrentPage(1);

    // Scroll clicked column into view
    setTimeout(() => {
      if (headerRefs.current[key]) {
        headerRefs.current[key].scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    }, 300);
  };

  // 1️⃣ Base data depends on search
  let baseData = allEmployees.filter((emp) => {
    if (search.trim() === "") return true;
    
    const term = search.trim().toLowerCase();
    return (
      emp.emp_id?.toLowerCase().startsWith(term) ||
      emp.full_name?.toLowerCase().startsWith(term) ||
      emp.username?.toLowerCase().startsWith(term)
    );
  });

  // 2️⃣ Apply global sorting
  let sortedData = [...baseData];
  if (sortConfig.key) {
    sortedData.sort((a, b) => {
      const aVal = a[sortConfig.key] ?? "";
      const bVal = b[sortConfig.key] ?? "";

      if (String(aVal).toLowerCase() < String(bVal).toLowerCase())
        return sortConfig.direction === "asc" ? -1 : 1;

      if (String(aVal).toLowerCase() > String(bVal).toLowerCase())
        return sortConfig.direction === "asc" ? 1 : -1;

      return 0;
    });
  }

  // 3️⃣ GLOBAL PAGINATION (applies to sortedData)
  const startIndex = (currentPage - 1) * entries;
  const endIndex = startIndex + entries;
  const displayData = sortedData.slice(startIndex, endIndex);

  useEffect(() => {
    setTotalRecords(sortedData.length);
  }, [baseData]);

  // ==================================================
  // PAGINATION
  // ==================================================
  const handlePageClick = (page) => {
    setCurrentPage(page);
  };

  const handleNextPage = () => {
    handlePageClick(currentPage + 1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) handlePageClick(currentPage - 1);
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


  // ==================================================
  // RENDER UI
  // ==================================================
  return (
    <div className="container">
      {menuLoading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(255,255,255,0.85)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 99999,
            pointerEvents: "auto"
          }}
        >
          <div className="text-center">
            <div
              className="spinner-border text-primary"
              style={{ width: "4rem", height: "4rem" }}
              role="status"
            ></div>
            <div className="mt-2 fw-semibold text-primary">Loading…</div>
          </div>
        </div>
      )}
      <div className="text-dark mb-3">
        <h5>LOGIN CREDENTIALS</h5>
      </div>

      <div className="card shadow border-0">
        <div className="card-body">
          {/* Alert Message */}
          {alert.show && (
            <div
              className={`alert alert-${alert.type} alert-dismissible fade show`}
              role="alert"
            >
              {alert.message}
              <button
                type="button"
                className="btn-close"
                onClick={() => setAlert({ show: false, message: "", type: "" })}
              ></button>
            </div>
          )}

          {/* DATATABLES TOOLBAR */}
          <div className="dt-toolbar">
            <div className="dt-toolbar-inner">

              <div className="dt-left">
                <div>
                  Show{" "}
                  <select
                    value={entries}
                    onChange={(e) => {
                      setEntries(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="form-select d-inline-block mx-2"
                    style={{ width: "60px", paddingRight: "28px" }}
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
                    placeholder="Search login details..."
                    value={search}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearch(value);
                      setCurrentPage(1); 

                      if (value.trim() !== "" && allEmployees.length === 0) {
                        fetchAllEmployees().then((all) => setAllEmployees(all));
                      }
                    }}
                  />
                </div>

              </div>

              <div className="dt-right"></div>

            </div>
          </div>

          {/* Table */}
          <div className="dt-wrapper">
            <div className="table-responsive">
              <table
                className="table dt-table text-center align-middle"
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
                      <span>Name</span>
                      <SortIcon
                        state={getSortState("full_name")}
                        onClick={() => handleSort("full_name")}
                      />
                    </div>
                  </th>

                  {/* ROLE */}
                  <th
                    ref={(el) => (headerRefs.current["role"] = el)}
                    onClick={() => handleSort("role")}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Role</span>
                      <SortIcon
                        state={getSortState("role")}
                        onClick={() => handleSort("role")}
                      />
                    </div>
                  </th>

                  <th
                    ref={(el) => (headerRefs.current["username"] = el)}
                    onClick={() => handleSort("emp_id")}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Username</span>
                      <SortIcon
                        state={getSortState("emp_id")}
                        onClick={() => handleSort("emp_id")}
                      />
                    </div>
                  </th>
                  <th>Password</th>
                  <th>Action</th>

                </tr>
              </thead>
              <tbody>

                {loading ? (
                  <>
                    {[...Array(6)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan="5" className="placeholder-glow py-3">
                          <span className="placeholder col-12"></span>
                        </td>
                      </tr>
                    ))}
                  </>
                ) : sortedData.length > 0 ? (

                  displayData.map((emp) => (
                    <tr key={emp.emp_id}>
                      <td>{emp.emp_id}</td>
                      <td>{emp.full_name || "-"}</td>
                      <td>{emp.role || "-"}</td>
                      <td>{emp.emp_id}</td>
                      <td className="text-start">
                        <input
                          type="text"
                          value={emp.password || emp.temp_password || ""}
                          className="form-control"
                          style={{ width: "150px" }}
                          readOnly
                        />
                      </td>
                      <td>
                        {regenLoading === emp.emp_id ? (
                          <div
                            className="spinner-border spinner-border-sm text-warning"
                            role="status"
                          ></div>
                        ) : (
                          <button
                            className="btn btn-warning btn-sm text-white"
                            onClick={() => regeneratePassword(emp.emp_id)}
                          >
                            Regenerate Password
                          </button>
                        )}
                      </td>
                    </tr>
                  ))

                ) : (
                  <tr>
                    <td colSpan="5" className="text-muted py-4">
                      No employees found
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>
        </div>

          {/* RECORD COUNT + PAGINATION */}
          <div className="d-flex justify-content-between align-items-center mt-3">

            <div className="text-muted" style={{ fontWeight: "normal", margin: 0 }}>
              Showing{" "}
              {totalRecords === 0 ? 0 : (currentPage - 1) * entries + 1}
              {" "}to{" "}
              {Math.min(currentPage * entries, totalRecords)}
              {" "}of {totalRecords} records
            </div>

            <nav>
              <ul className="pagination mb-0">

                <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                  <button className="page-link" onClick={() => handlePageClick(1)}>«</button>
                </li>

                <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                  <button className="page-link" onClick={handlePreviousPage}>‹</button>
                </li>

                {(() => {
                  const totalPages = Math.ceil(totalRecords / entries);
                  const current = currentPage;

                  let start = current - 1;
                  let end = current + 1;

                  // Ensure at least page 1 is visible
                  if (current === 1) {
                    start = 1;
                    end = Math.min(3, totalPages);
                  }

                  // Ensure last pages visible
                  if (current === totalPages) {
                    end = totalPages;
                    start = Math.max(1, totalPages - 2);
                  }

                  // Safety limits
                  start = Math.max(1, start);
                  end = Math.min(totalPages, end);

                  const pages = [];
                  for (let i = start; i <= end; i++) pages.push(i);

                  return pages.map((num) => (
                    <li key={num} className={`page-item ${num === current ? "active" : ""}`}>
                      <button className="page-link" onClick={() => handlePageClick(num)}>
                        {num}
                      </button>
                    </li>
                  ));
                })()}
                <li className={`page-item ${currentPage * entries >= totalRecords ? "disabled" : ""}`}>
                  <button className="page-link" onClick={handleNextPage}>›</button>
                </li>

                <li className={`page-item ${currentPage * entries >= totalRecords ? "disabled" : ""}`}>
                  <button className="page-link"
                    onClick={() => {
                      const totalPages = Math.ceil(totalRecords / entries);
                      handlePageClick(totalPages);
                    }}
                  >
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
};

export default LoginDetails;
