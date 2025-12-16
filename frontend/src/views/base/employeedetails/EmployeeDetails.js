import React, { useEffect, useState, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import { Tooltip } from "bootstrap";



function EmployeeTables() {
  const API_URL = "http://127.0.0.1:8000/api/employee/employees/";
  const CSV_UPLOAD_URL = "http://127.0.0.1:8000/api/employee/upload_csv/";
  const MANAGER_LIST_URL = "http://127.0.0.1:8000/api/employee/employees/managers/";
  const DEPARTMENT_LIST_URL = "http://127.0.0.1:8000/api/employee/departments/";


  const [employees, setEmployees] = useState([]);
  const [managers, setManagers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchPage, setSearchPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ message: "", type: "" });
  const [isSearching, setIsSearching] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);

  const [formData, setFormData] = useState({
    id: null,
    emp_id: "",
    first_name: "",
    last_name: "",
    email: "",
    department_code: "",
    role: "",
    designation: "",
    project_name: "",
    joining_date: "",
    manager: "",
  });

  const [errors, setErrors] = useState({});
  const [mode, setMode] = useState("add");
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const searchTimeoutRef = useRef(null);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });
  const [pageLoading, setPageLoading] = useState(true);
  const headerRefs = useRef({});
  const initialLoadRef = useRef(true);

  const token = localStorage.getItem("access_token");
  const loggedInEmpId = localStorage.getItem("emp_id");

  const authHeaders = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };


  const managerLabel = (m) => {
    return (
      m.full_name ||
      `${m.user?.first_name || ""} ${m.user?.last_name || ""}`.trim() ||
      "Unknown"
    );
  };

  const fetchManagers = async (deptCode = "") => {
    try {
      const url = deptCode
        ? `${MANAGER_LIST_URL}?department_code=${deptCode}`
        : MANAGER_LIST_URL; // ✅ ALL managers if no dept

      const res = await fetch(url, { headers: authHeaders });
      const data = await res.json();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.results)
        ? data.results
        : [];

      setManagers(
        list.map((m) => ({
          emp_id: m.emp_id,
          full_name:
            m.full_name ||
            `${m.user?.first_name || ""} ${m.user?.last_name || ""}`.trim(),
        }))
      );
    } catch (error) {
      console.error("Error fetching managers:", error);
      setManagers([]);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch(DEPARTMENT_LIST_URL, {
        headers: authHeaders
      });

      const data = await res.json();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.results)
        ? data.results
        : [];

      setDepartments(list);
    } catch (error) {
      console.error("Error fetching departments:", error);
      setDepartments([]);
    }
  };


  const fetchEmployees = async (page = 1, orderingParam = "", search = "") => {
    
    setLoading(true);

    try {
      const url = `${API_URL}?page=${page}&page_size=${pageSize}${orderingParam}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
      const res = await fetch(url, { headers: authHeaders });
      const data = await res.json();

      setEmployees(data.results || []);
      setTotalPages(data.total_pages || Math.ceil((data.count || 0) / pageSize));
      setCurrentPage(data.current_page || page);
      setTotalRecords(data.count || 0);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSearchResults = async (page, value) => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_URL}?search=${encodeURIComponent(value)}&page=${page}&page_size=${pageSize}`,
        { headers: authHeaders }
      );

      const data = await res.json();

      setEmployees(data.results || []);
      setTotalPages(data.total_pages || Math.ceil((data.count || 0) / pageSize));
      setSearchPage(page);
      setTotalRecords(data.count || 0);
    } catch (error) {
      console.error("Search pagination error:", error);
    } finally {
      setLoading(false);
    }
  };


  const fetchAllEmployees = async () => {
    try {
      let allEmployees = [];
      let page = 1;
      while (true) {
        const res = await fetch(`${API_URL}?page=${page}`, {
          headers: authHeaders,
        });
        const data = await res.json();

        if (!data.results || data.results.length === 0) break;

        allEmployees = [...allEmployees, ...data.results];
        if (!data.next) break;
        page++;
      }
      return allEmployees;
    } catch (err) {
      console.error("Error fetching all employees for search:", err);
      return [];
    }
  };


  useEffect(() => {
    const savedPage = sessionStorage.getItem("emp_page");
    const savedSearch = sessionStorage.getItem("emp_search");

    initialLoadRef.current = true;  // 🔥 begin protected initial load

    if (savedSearch) {
      setSearchTerm(savedSearch);
      setIsSearching(true);
      loadSearchResults(savedPage || 1, savedSearch).finally(() => {
        initialLoadRef.current = false;
        setPageLoading(false);   // ← ADD THIS
    });
    } else {
      fetchEmployees(savedPage || 1, "").finally(() => {
        initialLoadRef.current = false;
        setPageLoading(false);   // ← ADD THIS
    });
    }

    fetchDepartments();
  }, []);



  // When sort changes → always reset to page 1
  useEffect(() => {
    if (initialLoadRef.current) return;

    if (!isSearching && sortConfig.key) {
      const ordering = `&ordering=${sortConfig.direction === "asc"
        ? sortConfig.key
        : "-" + sortConfig.key}`;

      setCurrentPage(1);  // 🔥 reset page
      fetchEmployees(1, ordering);  // 🔥 reload sorted data from page 1
    }
  }, [sortConfig]);

  // Normal page change (sorting already applied)
  useEffect(() => {
    if (initialLoadRef.current) return;

    if (!isSearching && sortConfig.key) {
      const ordering = `&ordering=${sortConfig.direction === "asc"
        ? sortConfig.key
        : "-" + sortConfig.key}`;

      fetchEmployees(currentPage, ordering);
    } else if (!isSearching) {
      fetchEmployees(currentPage, "");
    }
  }, [currentPage]);

  useEffect(() => {
    if (initialLoadRef.current) return;  // 🔥 stop blinking on refresh

    let ordering = "";
    if (sortConfig.key) {
      ordering = `&ordering=${
        sortConfig.direction === "asc" ? sortConfig.key : "-" + sortConfig.key
      }`;
    }

    fetchEmployees(currentPage, ordering);
  }, [pageSize]);

  useEffect(() => {
    if (alert.message) {
      const timer = setTimeout(() => setAlert({ message: "", type: "" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // ✅ AUTO-REFRESH MANAGERS WHEN DEPARTMENT CHANGES
  useEffect(() => {
    if (!showModal) return;

    if (formData.department_code) {
      fetchManagers(formData.department_code); // filter by department
    } else {
      fetchManagers(); // load all managers
    }
  }, [formData.department_code, showModal]);


  const handleSearchChange = (e) => {
    const value = e.target.value.trim();
    setSearchTerm(value);

    // Clear any previous debounce timer
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce API call by 500ms after typing stops
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // If search box is empty, restore paginated data (no reload flicker)
        if (!value) {
          setIsSearching(false);
          setSearchPage(1);
          setCurrentPage(1);

          let ordering = "";
          if (sortConfig.key) {
            ordering = `&ordering=${
              sortConfig.direction === "asc"
                ? sortConfig.key
                : "-" + sortConfig.key
            }`;
          }

          await fetchEmployees(1, ordering);
          return;
        }

        // Avoid redundant refresh
        if (value === searchTerm && employees.length > 0 && isSearching) return;

        setIsSearching(true);
        setSearchPage(1);
        loadSearchResults(1, value);

      } catch (error) {
        console.error("Error searching employees:", error);
        setAlert({ message: "Failed to search employees", type: "danger" });
      }
    }, 500);
  };

  let filteredEmployees = [...employees];


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleAdd = () => {
    fetchManagers([]);

    setFormData({
      id: null,
      emp_id: "",
      first_name: "",
      last_name: "",
      email: "",
      department_code: "",
      role: "",
      designation: "",
      project_name: "",
      joining_date: "",
      manager: "",
    });
    setErrors({});
    setMode("add");
    setShowModal(true);
  };

  const handleEdit = (emp) => {
    setManagers([]);

    setFormData({
      id: emp.id,
      emp_id: emp.emp_id,
      first_name:
        emp.first_name ||
        emp.user?.first_name ||
        emp.full_name?.split(" ")[0] ||
        "",
      last_name:
        emp.last_name ||
        emp.user?.last_name ||
        emp.full_name?.split(" ")[1] ||
        "",
      email: emp.email,
      department_code: emp.department_code || emp.department?.code || "",
      role: emp.role_name || emp.role || "",
      designation: emp.designation || "",
      project_name: emp.project_name || "",
      joining_date: emp.joining_date || "",
      manager:
        emp.manager_emp_id ||
        emp.manager_id ||
        managers.find((m) => m.full_name === emp.manager_name)?.emp_id ||
        "",
    });

    setErrors({});
    setMode("edit");
    setShowModal(true);
  };

  const handleDelete = async (empId) => {

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}${empId}/`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (!res.ok) throw new Error("Failed to delete employee");

      // Update UI instantly
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.emp_id === empId  // 🟢 FIXED: compare using emp.emp_id
            ? { ...emp, status: "Inactive" }
            : emp
        )
      );

      setAlert({ message: "Employee deleted successfully", type: "success" });

    } catch (error) {
      console.error("Error deleting employee", error);
      setAlert({ message: "Failed to delete employee", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleView = (emp) => {
    handleEdit(emp);
    setMode("view");
  };

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSave = async () => {
    setLoading(true);
    setErrors({});

    const method = mode === "edit" ? "PATCH" : "POST";
    const url = mode === "edit" ? `${API_URL}${formData.emp_id}/` : API_URL;

    const payload = { ...formData };
    delete payload.emp_id;
    delete payload.id;

    const requiredFields = ["first_name", "last_name", "email", "role", "department_code", "joining_date"];
    const newErrors = {};

    requiredFields.forEach((field) => {
      if (!payload[field]?.trim()) {
        newErrors[field] = "This field is required";
      }
    });

    if (payload.email && !validateEmail(payload.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    // Allow alphabets + spaces (match backend validation)
    if (payload.last_name && !/^[A-Za-z ]+$/.test(payload.last_name)) {
      newErrors.last_name = "Last name can only contain letters and spaces.";
    }


    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      setAlert({
        message: "Please fill all mandatory fields before saving.",
        type: "warning",
      });
      return;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const data = await res.json();


      if (!res.ok) {
        if (data?.errors && typeof data.errors === "object") {
          const backendErrors = {};
          Object.entries(data.errors).forEach(([key, val]) => {
            backendErrors[key] = Array.isArray(val) ? val[0] : val;
          });

          setErrors(backendErrors);
          setLoading(false);
          return;
        }

        setAlert({ message: data?.error || "Failed to save employee.", type: "danger" });
        setLoading(false);
        return;
      }

      if (mode === "add") {
      setIsSearching(false);
      setSearchTerm("");

      //  Get updated total count after successful insert
      const resAll = await fetch(`${API_URL}?page=1`, { headers: authHeaders });
      const dataAll = await resAll.json();

      const totalCount = dataAll.count || 0;
      const lastPage = Math.ceil(totalCount / pageSize);

      //  Jump to the page where last employee exists
      setCurrentPage(lastPage);
      await fetchEmployees(lastPage);
    } else {
        if (isSearching) {
          const allEmployees = await fetchAllEmployees();
          const filtered = allEmployees.filter(
            (emp) =>
              emp.emp_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
          );
          setEmployees(filtered);
        } else {
          await fetchEmployees(currentPage);
        }
      }

      setFormData({
        id: null,
        emp_id: "",
        first_name: "",
        last_name: "",
        email: "",
        department_code: "",
        role: "",
        designation: "",
        project_name: "",
        joining_date: "",
        manager: "",
      });

      setShowModal(false);

      setAlert({
        message: mode === "edit" ? "Employee Updated Successfully!" : "Employee Added Successfully!",
        type: "success",
      });

      window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (error) {
      console.error("Error saving employee:", error);
      setAlert({ message: "Something went wrong while saving.", type: "danger" });
    } finally {
      setLoading(false);
    }
  };


  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);

    const formDataCSV = new FormData();
    formDataCSV.append("file", file);

    try {
      const res = await fetch(CSV_UPLOAD_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formDataCSV,
      });

      const data = await res.json();

      if (!res.ok) {
        setAlert({ message: data.error || "CSV Upload Failed", type: "danger" });
        return;
      }

      // If backend has error rows → show RED alert
      if (data.errors && data.errors.length > 0) {
        setAlert({
          message: `CSV upload failed. ${data.errors.length} errors found.`,
          type: "danger",
        });
        console.error("CSV Upload Errors:", data.errors);
        return;
      }

      // If some rows uploaded
      if (data.uploaded_count > 0) {
        setAlert({
          message: `CSV Uploaded Successfully! ${data.uploaded_count} employees added.`,
          type: "success",
        });
      } else {
        setAlert({
          message: "No records were uploaded.",
          type: "warning",
        });
      }

      // Refresh employee list
      setIsSearching(false);
      setSearchTerm("");
      await fetchEmployees(1);
      setCurrentPage(1);

    } catch (error) {
      console.error("CSV upload error:", error);
      setAlert({ message: "Failed to upload CSV", type: "danger" });
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };


  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    // Scroll focused column into view AFTER table refresh
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
  
  
  const SortIcon = ({ sortState, onClick }) => {
    return (
      <button 
        onClick={onClick}
        className="inline-flex items-center justify-center ml-1 cursor-pointer hover:opacity-70 transition-opacity p-1"
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

  const getVisiblePages = () => {
    const activePage = isSearching ? searchPage : currentPage;
    const maxVisible = 3;

    let start = Math.max(activePage - Math.floor(maxVisible / 2), 1);
    let end = start + maxVisible - 1;

    if (end > totalPages) {
      end = totalPages;
      start = Math.max(end - maxVisible + 1, 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const activePage = isSearching ? searchPage : currentPage;

  useEffect(() => {
      sessionStorage.setItem("emp_page", activePage);
      sessionStorage.setItem("emp_search", searchTerm);
    }, [activePage, searchTerm]);

  const highlightText = (text, keyword) => {
    if (!keyword) return text;

    const regex = new RegExp(`(${keyword})`, "gi");
    return text.toString().split(regex).map((part, index) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={index} style={{ background: "#ffe066", padding: "2px 4px" }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };


  const csvInputRef = useRef(null);

  const handleImportClick = () => {
    if (csvInputRef.current) {
      csvInputRef.current.click();
    }
  };

  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');

    tooltipTriggerList.forEach((el) => {
      try {
        new Tooltip(el);
      } catch (e) {
        console.warn("Tooltip init failed:", e);
      }
    });
  }, []);

  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach((el) => new Tooltip(el));
  }, [employees]);


  return (
    <div className="container py-3 employee-table-page">
      <h5 className="mb-3">EMPLOYEE DETAILS</h5>

      {alert.message && (
        <div className={`custom-alert alert-${alert.type}`}>
          <div className="alert-icon">
            {alert.type === "success" && <i className="bi bi-check-circle-fill"></i>}
            {alert.type === "danger" && <i className="bi bi-x-octagon-fill"></i>}
            {alert.type === "warning" && <i className="bi bi-exclamation-triangle-fill"></i>}
            {alert.type === "info" && <i className="bi bi-info-circle-fill"></i>}
          </div>

          <div className="alert-content">
            <strong>
              {alert.type === "success" && "Success! "}
              {alert.type === "danger" && "Error! "}
              {alert.type === "warning" && "Warning! "}
              {alert.type === "info" && "Info! "}
            </strong>
            {alert.message}
          </div>

          <button
            className="alert-close"
            onClick={() => setAlert({ message: "", type: "" })}
          >
            &times;
          </button>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-body">
          {/* ===== DATATABLE TOOLBAR ===== */}
          <div className="dt-toolbar">

            {/* FIXED WRAPPER - PREVENTS SHIFTING */}
            <div className="dt-toolbar-inner">
              {/* LEFT SIDE */}
              <div className="dt-left">

                <div className="entries-block">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const size = parseInt(e.target.value);
                      setPageSize(size);
                      setCurrentPage(1);
                      setSearchPage(1);
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
                    value={searchTerm}
                    onChange={handleSearchChange}
                    placeholder="Search employees..."
                  />

                  {searchTerm && (
                    <span
                      className="search-clear"
                      onClick={() => {
                        setSearchTerm("");
                        setIsSearching(false);
                        setSearchPage(1);
                        fetchEmployees(1);
                      }}
                    >
                      ✕
                    </span>
                  )}
                </div>

                <div className="search-info">
                  <span style={{ visibility: isSearching ? "visible" : "hidden" }}>
                    {totalRecords} result(s) found for "{searchTerm}"
                  </span>
                </div>

              </div>

              {/* RIGHT SIDE - FIXED POSITION */}
              <div className="dt-right d-flex align-items-center gap-2">
                <button
                  className="btn btn-outline-secondary csv-upload-btn"
                  onClick={handleImportClick}
                  data-bs-toggle="tooltip"
                  title="CSV Upload"
                >
                  <i className="bi bi-upload me-1"></i> Import
                </button>

                <input
                  type="file"
                  accept=".csv"
                  ref={csvInputRef}
                  onChange={handleCSVUpload}
                  style={{ display: "none" }}
                />

                <button className="btn btn-primary" onClick={handleAdd}>
                  <i className="bi bi-plus-circle me-1"></i> Add Employee
                </button>
              </div>

            </div>
          </div>
          <div className="dt-wrapper">
            <div className="table-responsive">
            <table
              className="table dt-table text-center align-middle"
              style={{ whiteSpace: "nowrap", tableLayout: "auto" }}
            >
              <thead>
                <tr>

                  {/* EMP ID */}
                  <th ref={(el) => (headerRefs.current["user__emp_id"] = el)} style={{ cursor: "default" }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Emp ID</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); handleSort("user__emp_id"); }}
                        style={{ cursor: "pointer" }}
                      >
                        <SortIcon
                          sortState={
                            sortConfig.key !== "user__emp_id"
                              ? "none"
                              : sortConfig.direction === "asc"
                              ? "asc"
                              : "desc"
                          }
                        />
                      </span>
                    </div>
                  </th>

                  {/* NAME */}
                  <th ref={(el) => (headerRefs.current["full_name"] = el)} style={{ cursor: "default" }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Name</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); handleSort("full_name"); }}
                        style={{ cursor: "pointer" }}
                      >
                        <SortIcon
                          sortState={
                            sortConfig.key !== "full_name"
                              ? "none"
                              : sortConfig.direction === "asc"
                              ? "asc"
                              : "desc"
                          }
                        />
                      </span>
                    </div>
                  </th>

                  {/* EMAIL */}
                  <th ref={(el) => (headerRefs.current["user__email"] = el)} style={{ cursor: "default" }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Email</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); handleSort("user__email"); }}
                        style={{ cursor: "pointer" }}
                      >
                        <SortIcon
                          sortState={
                            sortConfig.key !== "user__email"
                              ? "none"
                              : sortConfig.direction === "asc"
                              ? "asc"
                              : "desc"
                          }
                        />
                      </span>
                    </div>
                  </th>

                  {/* DESIGNATION */}
                  <th ref={(el) => (headerRefs.current["designation"] = el)} style={{ cursor: "default" }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Designation</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); handleSort("designation"); }}
                        style={{ cursor: "pointer" }}
                      >
                        <SortIcon
                          sortState={
                            sortConfig.key !== "designation"
                              ? "none"
                              : sortConfig.direction === "asc"
                              ? "asc"
                              : "desc"
                          }
                        />
                      </span>
                    </div>
                  </th>

                  {/* PROJECT */}
                  <th ref={(el) => (headerRefs.current["project_name"] = el)} style={{ cursor: "default" }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Project</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); handleSort("project_name"); }}
                        style={{ cursor: "pointer" }}
                      >
                        <SortIcon
                          sortState={
                            sortConfig.key !== "project_name"
                              ? "none"
                              : sortConfig.direction === "asc"
                              ? "asc"
                              : "desc"
                          }
                        />
                      </span>
                    </div>
                  </th>

                  {/* MANAGER */}
                  <th ref={(el) => (headerRefs.current["manager_name"] = el)} style={{ cursor: "default" }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Manager</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); handleSort("manager_name"); }}
                        style={{ cursor: "pointer" }}
                      >
                        <SortIcon
                          sortState={
                            sortConfig.key !== "manager_name"
                              ? "none"
                              : sortConfig.direction === "asc"
                              ? "asc"
                              : "desc"
                          }
                        />
                      </span>
                    </div>
                  </th>

                  {/* JOINING DATE */}
                  <th ref={(el) => (headerRefs.current["joining_sort"] = el)} style={{ cursor: "default" }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Joining Date</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); handleSort("joining_sort"); }}
                        style={{ cursor: "pointer" }}
                      >
                        <SortIcon
                          sortState={
                            sortConfig.key !== "joining_sort"
                              ? "none"
                              : sortConfig.direction === "asc"
                              ? "asc"
                              : "desc"
                          }
                        />
                      </span>
                    </div>
                  </th>

                  {/* DEPARTMENT */}
                  <th ref={(el) => (headerRefs.current["department__name"] = el)} style={{ cursor: "default" }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Department</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); handleSort("department__name"); }}
                        style={{ cursor: "pointer" }}
                      >
                        <SortIcon
                          sortState={
                            sortConfig.key !== "department__name"
                              ? "none"
                              : sortConfig.direction === "asc"
                              ? "asc"
                              : "desc"
                          }
                        />
                      </span>
                    </div>
                  </th>

                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(pageSize)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan="10">
                        <div className="skeleton-row"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center py-5">
                      <i className="bi bi-inbox" style={{ fontSize: "3rem", color: "#ccc" }}></i>
                      <p className="mt-3 text-muted mb-0">
                        {searchTerm ? "No employees match your search" : "No employees found"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td>{emp.emp_id || emp.user?.emp_id || "-"}</td>
                      <td>
                        {highlightText(
                          emp.full_name ||
                            `${emp.user?.first_name || ""} ${emp.user?.last_name || ""}`.trim(),
                          searchTerm
                        )}
                      </td>
                      <td>{emp.email}</td>
                      <td>{emp.designation}</td>
                      <td>{emp.project_name || "-"}</td>
                      <td className="text-start">{emp.manager_name || "Not Assigned"}</td>
                      <td>{emp.joining_date}</td>
                      <td>{emp.department_name}</td>
                      <td>
                        <span
                          className={
                            emp.status === "Active" ? "badge bg-success" : "badge bg-danger"
                          }
                        >
                          {emp.status}
                        </span>
                      </td>
                      <td className="text-nowrap" style={{ minWidth: "120px" }}>

                        {/* EDIT BUTTON — wrapped in span for tooltip */}
                        <span
                          data-bs-toggle="tooltip"
                          data-bs-placement="top"
                          title={
                            emp.status === "Inactive"
                              ? "Cannot edit deleted employee"
                              : "Edit Employee"
                          }
                        >
                          <button
                            className="btn btn-sm btn-info me-2"
                            onClick={() => handleEdit(emp)}
                            disabled={emp.status === "Inactive"}
                            style={{ pointerEvents: emp.status === "Inactive" ? "none" : "auto" }}
                          >
                            <i className="bi bi-pencil-square text-white"></i>
                          </button>
                        </span>

                        {/* VIEW BUTTON — always enabled */}
                        <span
                          data-bs-toggle="tooltip"
                          data-bs-placement="top"
                          title="View Employee"
                        >
                          <button
                            className="btn btn-sm btn-warning me-2"
                            onClick={() => handleView(emp)}
                          >
                            <i className="bi bi-eye text-white"></i>
                          </button>
                        </span>

                        {/* DELETE BUTTON — also wrapped in span */}
                        <span
                          data-bs-toggle="tooltip"
                          data-bs-placement="top"
                          title={
                            emp.emp_id === loggedInEmpId
                              ? "You cannot delete your own account"
                              : emp.status === "Inactive"
                              ? "Employee already inactive"
                              : "Delete Employee"
                          }
                        >
                          <button
                            className={`btn btn-sm ${
                              emp.emp_id === loggedInEmpId ? "btn-secondary" : "btn-danger"
                            }`}
                            disabled={emp.status === "Inactive" || emp.emp_id === loggedInEmpId}
                            onClick={() => {
                              if (emp.status !== "Inactive" && emp.emp_id !== loggedInEmpId) {
                                document.querySelectorAll(".tooltip.show").forEach((t) => t.remove());
                                setDeleteTarget(emp);
                              }
                            }}
                            style={{
                              pointerEvents:
                                emp.status === "Inactive" || emp.emp_id === loggedInEmpId
                                  ? "none"
                                  : "auto",
                            }}
                          >
                            <i className="bi bi-trash text-white"></i>
                          </button>
                        </span>

                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
              </div>
          </div>

          {/* Pagination */}
          {true && (
            <div className="dt-pagination d-flex justify-content-between align-items-center mt-3">

              {/* LEFT TEXT */}
              <div className="text-muted">
                Showing {(activePage - 1) * pageSize + 1} to{" "}
                {Math.min(activePage * pageSize, totalRecords)} of {totalRecords} records
              </div>

              {/* RIGHT CONTROLS */}
              <ul className="pagination mb-0">

                {/* First */}
                <li className={`page-item ${activePage === 1 ? "disabled" : ""}`}>
                  <button
                    className="page-link"
                    onClick={() => {
                      if (isSearching) {
                        setSearchPage(1);
                        loadSearchResults(1, searchTerm);
                      } else {
                        setCurrentPage(1);
                      }
                      window.scrollTo({ top: 200, behavior: "smooth" });
                    }}
                  >
                    «
                  </button>
                </li>

                {/* Previous */}
                <li className={`page-item ${activePage === 1 ? "disabled" : ""}`}>
                  <button
                    className="page-link"
                    onClick={() => {
                      if (isSearching) {
                        const prev = searchPage - 1;
                        setSearchPage(prev);
                        loadSearchResults(prev, searchTerm);
                      } else {
                        setCurrentPage(currentPage - 1);
                      }
                      window.scrollTo({ top: 200, behavior: "smooth" });
                    }}
                  >
                    ‹
                  </button>
                </li>

                {/* LIMITED PAGE NUMBERS */}
                {getVisiblePages().map((page) => (
                  <li
                    key={page}
                    className={`page-item ${
                      page === (isSearching ? searchPage : currentPage) ? "active" : ""
                    }`}
                  >
                    <button
                      className="page-link"
                      onClick={() => {
                        if (isSearching) {
                          setSearchPage(page);
                          loadSearchResults(page, searchTerm);
                        } else {
                          setCurrentPage(page);
                        }
                        window.scrollTo({ top: 200, behavior: "smooth" });
                      }}
                    >
                      {page}
                    </button>
                  </li>
                ))}

                {/* Next */}
                <li className={`page-item ${activePage === totalPages ? "disabled" : ""}`}>
                  <button
                    className="page-link"
                    onClick={() => {
                      if (isSearching) {
                        const next = searchPage + 1;
                        setSearchPage(next);
                        loadSearchResults(next, searchTerm);
                      } else {
                        setCurrentPage(currentPage + 1);
                      }
                      window.scrollTo({ top: 200, behavior: "smooth" });
                    }}
                  >
                    ›
                  </button>
                </li>

                {/* Last */}
                <li className={`page-item ${activePage === totalPages ? "disabled" : ""}`}>
                  <button
                    className="page-link"
                    onClick={() => {
                      if (isSearching) {
                        setSearchPage(totalPages);
                        loadSearchResults(totalPages, searchTerm);
                      } else {
                        setCurrentPage(totalPages);
                      }
                      window.scrollTo({ top: 200, behavior: "smooth" });
                    }}
                  >
                    »
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header bg-primary text-white">
                  <h5>
                    {mode === "add"
                      ? "Add New Employee"
                      : mode === "edit"
                      ? "Edit Employee"
                      : "View Employee"}
                  </h5>
                  <button
                    className="btn-close btn-close-white"
                    onClick={() => setShowModal(false)}
                  />
                </div>

                <div className="modal-body">
                  <div className="row g-3">
                    {/* First Name */}
                    <div className="col-md-6">
                      <label className="form-label">
                        First Name <span style={{ color: "red" }}>*</span>
                      </label>
                      <input
                        className={`form-control ${mode === "view" ? "view-disabled" : ""} ${errors.first_name ? "is-invalid" : ""}`}
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleInputChange}
                        readOnly={mode === "view"}
                      />
                      {errors.first_name && (
                        <div className="invalid-feedback">{errors.first_name}</div>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">
                        Last Name <span style={{ color: "red" }}>*</span>
                      </label>
                      <input
                        className={`form-control ${mode === "view" ? "view-disabled" : ""} ${errors.last_name ? "is-invalid" : ""}`}
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleInputChange}
                        readOnly={mode === "view"}
                        placeholder={errors.last_name || ""}
                      />
                      {errors.last_name && (
                        <div className="invalid-feedback">{errors.last_name}</div>
                      )}
                    </div>

                    {/* Email */}
                    <div className="col-md-6">
                      <label className="form-label">
                        Email <span style={{ color: "red" }}>*</span>
                      </label>
                      <input
                        className={`form-control ${mode === "view" ? "view-disabled" : ""} ${errors.email ? "is-invalid" : ""}`}
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        readOnly={mode === "view"}
                        placeholder={errors.email || ""}
                      />
                      {errors.email && (
                        <div className="invalid-feedback">{errors.email}</div>
                      )}
                    </div>

                    {/* Department */}
                    <div className="col-md-6">
                      <label className="form-label">
                        Department <span style={{ color: "red" }}>*</span>
                      </label>
                      <select
                        className={`form-select ${mode === "view" ? "view-disabled" : ""} ${errors.department_code ? "is-invalid" : ""}`}
                        name="department_code"
                        value={formData.department_code}
                        onChange={handleInputChange}   // ✅ only update state
                        disabled={mode === "view"}
                      >
                        <option value="">Select Department</option>

                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.code}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                      {errors.department_code && (
                        <div className="invalid-feedback">
                          {errors.department_code}
                        </div>
                      )}
                    </div>

                    {/* Role */}
                    <div className="col-md-6">
                      <label className="form-label">
                        Role <span style={{ color: "red" }}>*</span>
                      </label>
                      <select
                        className={`form-select ${mode === "view" ? "view-disabled" : ""} ${errors.role ? "is-invalid" : ""}`}
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        disabled={mode === "view"}
                      >
                        <option value="">Select Role</option>
                        <option value="Manager">Manager</option>
                        <option value="Employee">Employee</option>
                      </select>
                      {errors.role && (
                        <div className="invalid-feedback">{errors.role}</div>
                      )}
                    </div>

                    {/* Designation */}
                    <div className="col-md-6">
                      <label className="form-label">Designation</label>
                      <input
                        className={`form-control ${mode === "view" ? "view-disabled" : ""}`}
                        name="designation"
                        value={formData.designation}
                        onChange={handleInputChange}
                        readOnly={mode === "view"}
                      />
                    </div>

                    {/* Project */}
                    <div className="col-md-6">
                      <label className="form-label">Project Name</label>
                      <input
                        className={`form-control ${mode === "view" ? "view-disabled" : ""}`}
                        name="project_name"
                        value={formData.project_name}
                        onChange={handleInputChange}
                        readOnly={mode === "view"}
                      />
                    </div>

                    {/* Joining Date */}
                    <div className="col-md-6">
                      <label className="form-label">
                        Joining Date <span style={{ color: "red" }}>*</span>
                      </label>
                      <div className="input-group">
                        <input
                          type="date"
                          name="joining_date"
                          className={`form-control ${mode === "view" ? "view-disabled" : ""} ${errors.joining_date ? "is-invalid" : ""}`}
                          value={
                            formData.joining_date
                              ? (() => {
                                  const parts = formData.joining_date.split("-");
                                  if (parts.length === 3 && parts[2].length === 4)
                                    return `${parts[2]}-${parts[1]}-${parts[0]}`;
                                  return formData.joining_date;
                                })()
                              : ""
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              const [y, m, d] = val.split("-");
                              setFormData({
                                ...formData,
                                joining_date: `${d}-${m}-${y}`,
                              });
                            } else {
                              setFormData({ ...formData, joining_date: "" });
                            }
                            setErrors((prev) => ({ ...prev, joining_date: "" }));
                          }}
                          max={new Date().toISOString().split("T")[0]}
                          placeholder={errors.joining_date || "dd-mm-yyyy"}
                          readOnly={mode === "view"}
                        />
                        {errors.joining_date && (
                          <div className="invalid-feedback d-block">
                            {errors.joining_date}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Manager */}
                    <div className="col-md-6">
                      <label className="form-label">Manager</label>
                      <select
                        className={`form-select ${mode === "view" ? "view-disabled" : ""}`}
                        name="manager"
                        value={formData.manager}
                        onChange={handleInputChange}
                        disabled={mode === "view"}
                      >
                        <option value="">Select Manager</option>
                        {managers.map((m) => (
                          <option key={m.emp_id} value={m.emp_id}>
                            {managerLabel(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-between modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Close
                  </button>
                  {mode !== "view" && (
                    <button className="btn btn-primary" onClick={handleSave}>
                      {mode === "add" ? "Save" : "Update"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-backdrop fade show"></div>
        </>
      )}
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">

                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title">Confirm Delete</h5>
                  <button
                    className="btn-close btn-close-white"
                    onClick={() => setDeleteTarget(null)}
                  ></button>
                </div>

                <div className="modal-body text-center">
                  <p className="mb-2">Are you sure you want to delete this employee?</p>
                  <h6>
                    <strong>
                      {deleteTarget.full_name ||
                        `${deleteTarget.first_name || ""} ${deleteTarget.last_name || ""}`}{" "}
                      ({deleteTarget.emp_id})
                    </strong>
                  </h6>
                </div>

                <div className="modal-footer d-flex justify-content-between">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setDeleteTarget(null)}
                  >
                    Cancel
                  </button>

                  <button
                    className="btn btn-danger"
                    onClick={async () => {
                      await handleDelete(deleteTarget.emp_id);
                      setDeleteTarget(null);
                    }}
                  >
                    Delete
                  </button>
                </div>

              </div>
            </div>
          </div>

          <div className="modal-backdrop fade show"></div>
        </>
      )}
      {pageLoading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(255, 255, 255, 0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
        >
          <div
            className="spinner-border text-primary"
            style={{ width: "3rem", height: "3rem" }}
          ></div>
        </div>
      )}
    </div>
  );
}

export default EmployeeTables;