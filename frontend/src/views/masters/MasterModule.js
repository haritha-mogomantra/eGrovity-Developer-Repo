import React, { useEffect, useState, useMemo } from "react";
import { useParams, Navigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import axiosInstance from "../../utils/axiosInstance";
import { useMasterData } from "../../context/MasterDataContext";
import EmployeeLifecycleAPI 
  from "../../modules/employeeLifecycle/EmployeeLifecycleAPI";



// ============================================================================
// LOCAL MASTER API (TEMP – replaces MasterService)
// ============================================================================
const MasterAPI = {
  list: async (
    masterType,
    {
        status = "Active",
        page = 1,
        pageSize = 10,
        ordering = "-created_at",
    } = {}
  ) => {
    const params = {
      master_type: masterType,
      page,
      page_size: pageSize,
      ordering,
    };

    // OPTIONAL department filter – but only when object actually provides it
    if (typeof status === "object" && status.department_code) {
      params.department_code = status.department_code;
    }

    if (status !== "All") params.status = status;

    const res = await axiosInstance.get("/masters/", { params });


    return {
        results: res.data?.results ?? [],
        count: res.data?.count ?? 0,
        totalPages:
        res.data?.total_pages ??
        Math.ceil((res.data?.count ?? 0) / pageSize),
        currentPage: res.data?.current_page ?? page,
    };
    },

  create: async (masterType, payload) => {
    const res = await axiosInstance.post("/masters/", {
      master_type: masterType,
      ...payload,
    });
    return res.data;
  },

  update: async (id, payload) => {
    const res = await axiosInstance.patch(`/masters/${id}/`, payload);
    return res.data;
  },
};


// ============================================================================
// EMPLOYEE ROLE ASSIGNMENT API (RBAC)
// ============================================================================
const EmployeeRoleAPI = {
  list: async ({
    status = "Active",
    page = 1,
    pageSize = 10,
    ordering = "-created_at",
  } = {}) => {
    const res = await axiosInstance.get(
      "/masters/employee-role-assignments/",
      {
        params: {
          status,
          page,
          page_size: pageSize,
          ordering,
        },
      }
    );

    return {
      results: res.data?.results ?? [],
      count: res.data?.count ?? 0,
      totalPages: res.data?.total_pages ?? 1,
      currentPage: res.data?.current_page ?? page,
    };
  },

  create: async (payload) => {
    const res = await axiosInstance.post(
      "/masters/employee-role-assignments/",
      payload
    );
    return res.data;
  },

  update: async (id, payload) => {
    const res = await axiosInstance.patch(
      `/masters/employee-role-assignments/${id}/`,
      payload
    );
    return res.data;
  },
};


// ============================================================================
// SHARED COMPONENTS
// ============================================================================
function PageLayout({ children }) {
  return <div className="card shadow-sm p-3">{children}</div>;
}

function AlertMessage({ type, message, onClose }) {
  if (!message) return null;

  return (
    <div className={`alert alert-${type} alert-dismissible fade show mb-3`} role="alert">
      {message}
      <button className="btn-close" onClick={onClose}></button>
    </div>
  );
}

function TablePanel({
  data, columns, loading,
  searchPlaceholder = "Search...",
  onAddNew, onEdit, onDelete,
  statusFilter, setStatusFilter,
  sortOrder,
  onToggleSort,
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((r) =>
      columns.some((c) => {
        const v = String(r[c.key] ?? "").toLowerCase();
        return v.includes(q);
      })
    );
  }, [data, search, columns]);

  return (
    <>
      <div className="row mb-3 align-items-center">
        <div className="col-md-6">
            <div className="input-group shadow-sm">
                <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search"></i>
                </span>
                <input
                className="form-control border-start-0"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            </div>

        <div className="col-md-6 text-end">
          {statusFilter && setStatusFilter && (
            <select
            className="form-select form-select-sm d-inline-block me-2"
            style={{ width: "130px" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="All">All</option>
            </select>
          )}

            <button
              className="btn btn-outline-secondary btn-sm me-2"
              onClick={onToggleSort}
            >
              <i className="bi bi-arrow-down-up me-1"></i>
              Sort: {sortOrder === "desc" ? "Newest" : "Oldest"}
            </button>

            {onAddNew && (
              <button
                className="btn btn-primary btn-sm shadow-sm"
                onClick={onAddNew}
              >
                <i className="bi bi-plus-lg me-1"></i>Add New
              </button>
            )}
        </div>
        </div>

      <div className="table-responsive">
        <table
          className="table align-middle table-hover shadow-sm w-100"
          style={{
            borderRadius: "10px",
            overflow: "hidden",
            width: "100%",
            tableLayout: "fixed",
          }}
        >
          <thead
            style={{
              background: "#f1f3f5",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="py-3 px-3 text-secondary text-uppercase small text-wrap"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-4">
                  <div className="spinner-border spinner-border-sm text-primary"></div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-4 text-muted">
                  No records found
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr
                  key={row.id ?? idx}
                  style={{
                    background: idx % 2 === 0 ? "#fff" : "#f8f9fa",
                  }}
                >
                  {columns.map((c) => (
                    <td key={c.key} className="py-3 px-3 text-wrap">
                      {renderCell(row, c.key, onEdit, onDelete)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function renderCell(row, key, onEdit, onDelete) {
  if (key === "status") {
    const st = row.status || "-";
    return (
      <span
        className={`badge px-3 py-2 rounded-pill ${st === "Active" ? "bg-success" : "bg-secondary"}`}
      >
        {st}
      </span>
    );
  }

  if (key === "actions") {
    return (
      <div className="d-flex gap-2">
        {onEdit && (
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => onEdit(row)}
          >
            <i className="bi bi-pencil"></i>
          </button>
        )}

        {onDelete && (
          <button
            className={`btn btn-sm ${
                row.status === "Active"
                ? "btn-outline-warning"
                : "btn-outline-success"
            }`}
            title={row.status === "Active" ? "Deactivate" : "Activate"}
            onClick={() => onDelete(row)}
            >
            <i
                className={`bi ${
                row.status === "Active"
                    ? "bi-slash-circle"
                    : "bi-check-circle"
                }`}
            ></i>
            </button>
        )}
      </div>
    );
  }

    if (key === "managers") {
      if (!Array.isArray(row.managers) || row.managers.length === 0) {
        return "-";
      }
      return row.managers.join(", ");
    }


  if (key === "created_at") return formatDate(row.created_at);
  return typeof row[key] === "object"
    ? JSON.stringify(row[key])
    : row[key] ?? "-";
}

function AddNewModal({ title, fields, onSave, onCancel, initialData, onDepartmentChange }) {
  const [form, setForm] = useState(initialData || {});
  const [fieldKey, setFieldKey] = useState(0);

  useEffect(() => {
    const newForm = initialData || {};
    setForm(newForm);
    
    if (newForm.department_id && onDepartmentChange) {
        onDepartmentChange(newForm.department_id);
    }
    }, [initialData]);

  useEffect(() => {
    setFieldKey(prev => prev + 1);
  }, [fields]);

  return (
    <div
      className="modal fade show"
      style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content master-modal">
          <div className="modal-header">
            <h6 className="modal-title">{title}</h6>
            <button className="btn-close" onClick={onCancel}></button>
          </div>

          <div className="modal-body" key={fieldKey}>
            {fields.map((f) => (
              <div key={f.key} className="mb-3">
                {/* ✅ LABEL (Always visible in Add/Edit) */}
                <label className="form-label fw-semibold">
                  {f.label}
                </label>

                {/* ✅ SELECT FIELD */}
                {f.type === "select" ? (
                  <select
                    className="form-select"
                    value={
                      f.key === "managers"
                        ? (form[f.key]?.[0] || "")
                        : (form[f.key] || "")
                    }
                    onChange={(e) => {
                      const value = Number(e.target.value);

                      const updatedForm = {
                        ...form,
                        [f.key]: f.key === "managers"
                          ? (value ? [value] : [])
                          : value,
                      };

                      if (f.key === "department_id") {
                        updatedForm.managers = [];
                        if (onDepartmentChange) {
                          onDepartmentChange(value);
                        }
                      }

                      setForm(updatedForm);
                    }}
                  >
                    {!initialData && (
                      <option value="">Select {f.label}</option>
                    )}
                    {f.options?.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  /* ✅ INPUT FIELD */
                  <input
                    className="form-control"
                    disabled={Boolean(initialData)}
                    placeholder={`Enter ${f.label}`}
                    value={form[f.key] || ""}
                    onChange={(e) =>
                      setForm({ ...form, [f.key]: e.target.value })
                    }
                  />
                )}
              </div>
            ))}
          </div>

          <div className="modal-footer d-flex justify-content-end gap-2">
            <button
                className="btn btn-secondary btn-sm master-modal-btn"
                onClick={onCancel}
            >
                Cancel
            </button>

            <button
              className="btn btn-primary btn-sm master-modal-btn"
              onClick={() => onSave(form, { fromModal: true })}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function ConfirmDeleteModal({ title, message, onConfirm, onCancel, loading, actionLabel }) {
  return (
    <div
      className="modal fade show"
      style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered modal-sm">
        <div className="modal-content">
          <div className="modal-header">
            <h6 className="modal-title">{title}</h6>
            <button className="btn-close" onClick={onCancel}></button>
          </div>

          <div className="modal-body text-center">
            <p className="mb-0">{message}</p>
          </div>

          <div className="modal-footer">
            <button
              className="btn btn-secondary btn-sm px-4" style={{ minWidth: "120px" }}
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
                className="btn btn-warning btn-sm px-4"
                style={{ minWidth: "120px" }}
                onClick={onConfirm}
                disabled={loading}
                >
                {loading && (
                    <span className="spinner-border spinner-border-sm me-1"></span>
                )}
                {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function DeactivateDepartmentModal({
  department,
  onConfirm,
  onCancel,
  loading,
}) {
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
      if (!department?.id) return;

      setPreviewLoading(true);
      EmployeeLifecycleAPI
        .previewDepartmentDeactivation(department.id)
        .then(setPreview)
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, [department]);

  const [reason, setReason] = useState("");

  return (
    <div
      className="modal fade show"
      style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h6 className="modal-title">
              Deactivate Department{department?.name ? ` – ${department.name}` : ""}
            </h6>
            <button className="btn-close" onClick={onCancel}></button>
          </div>

          <div className="modal-body">
            <p className="mb-2">
              All employees will be moved to the default department.
            </p>
          
          {previewLoading && (
            <div className="text-muted small mb-2">
              Fetching impact summary...
            </div>
          )}

          {preview && (
            <div className="alert alert-warning py-2 small mb-2">
              <strong>{preview.employee_count}</strong> active employee(s) will be affected.
            </div>
          )}


            <label className="form-label fw-semibold">
              Deactivation Reason <span className="text-danger">*</span>
            </label>

            <textarea
              className="form-control"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason"
            />
          </div>

          <div className="modal-footer">
            <button
              className="btn btn-secondary btn-sm"
              onClick={onCancel}
            >
              Cancel
            </button>

            <button
              className="btn btn-danger btn-sm"
              disabled={!reason || loading || previewLoading || !confirmed}
              onClick={() => onConfirm(reason)}
            >
              {loading && (
                <span className="spinner-border spinner-border-sm me-1"></span>
              )}
              Deactivate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// GENERIC CRUD PAGE COMPONENT
// ============================================================================
function GenericCRUDPage({
  masterType,
  columns,
  formFields,
  searchPlaceholder,
  singularName,
  disableStatus = false,
  onDepartmentChange,
  departmentMasters = [],
  allManagers = [],
  fetchManagers,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deptDeactivateTarget, setDeptDeactivateTarget] = useState(null);
  const [deptDeactivateLoading, setDeptDeactivateLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [sortOrder, setSortOrder] = useState("desc"); // desc = Newest

  const { reloadMasters } = useMasterData();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);


  const loadItems = React.useCallback(async () => {
    try {
        setLoading(true);
        const res = await MasterAPI.list(masterType, {
          status: disableStatus ? "All" : statusFilter,
          page: currentPage,
          pageSize,
          ordering: sortOrder === "desc" ? "-created_at" : "created_at",
        });

            setItems(res.results);
            setTotalPages(res.totalPages);
            setTotalRecords(res.count);
    } catch (error) {
        console.error(`Error loading ${masterType}:`, error);
        setAlert({
        type: "danger",
        message: `Failed to load ${masterType.toLowerCase()}`
        });
    } finally {
        setLoading(false);
    }
  }, [masterType, statusFilter, currentPage, pageSize, sortOrder]);


    useEffect(() => {
      loadItems();
    }, [loadItems]);

    useEffect(() => {
      setCurrentPage(1);
    }, [statusFilter, pageSize, sortOrder]);


  const deleteItem = (row) => {
    if (masterType === "DEPARTMENT" && row.status === "Active") {
      setDeptDeactivateTarget(row);
    } else {
      setDeleteTarget(row);
    }
  };

  const confirmDelete = async () => {
    try {
        setDeleteLoading(true);

        const newStatus =
          deleteTarget?.status === "Active" ? "Inactive" : "Active";

        await MasterAPI.update(deleteTarget.id, { status: newStatus });
        reloadMasters(true);
        await loadItems();

        setAlert({
        type: "success",
        message: `${singularName} ${
            newStatus === "Inactive" ? "deactivated" : "activated"
        } successfully`
        });
    } catch (error) {
        setAlert({
        type: "danger",
        message: `Failed to update ${singularName.toLowerCase()} status`
        });
    } finally {
        setDeleteLoading(false);
        setDeleteTarget(null);
    }
  };

  const confirmDepartmentDeactivation = async (reason) => {
    try {
      setDeptDeactivateLoading(true);

      await EmployeeLifecycleAPI.deactivateDepartment({
        departmentId: deptDeactivateTarget.id,
        reason,
      });

      reloadMasters(true);
      await loadItems();

      setAlert({
        type: "success",
        message: "Department deactivated and employees transferred successfully",
      });
    } catch (error) {
      setAlert({
        type: "danger",
        message: "Failed to deactivate department",
      });
    } finally {
      setDeptDeactivateLoading(false);
      setDeptDeactivateTarget(null);
    }
  };


  const editItemHandler = (row) => {
    fetchManagers?.(); 
    // 🔹 find department id from department_name
    const dept = departmentMasters.find(
      d => d.name === row.department_name
    );

    if (dept?.id && onDepartmentChange) {
      onDepartmentChange(dept.id);
    }

    // 🔹 find manager ids from names
    const managerIds = Array.isArray(row.managers)
      ? row.managers
          .map(name =>
            allManagers.find(m => {
              const fullName =
                m.full_name ||
                `${m.user?.first_name || ""} ${m.user?.last_name || ""}`.trim();
              return fullName === name;
            })?.id
          )
          .filter(Boolean)
      : [];

    const normalized = {
      ...row,
      department_id: dept?.id || null,
      managers: managerIds,
    };

    setEditItem(normalized);
    setShowForm(true);
  };

  const saveItem = async (data, meta = {}) => {

    // =====================================================
    // PROJECT-SPECIFIC FRONTEND VALIDATION
    // =====================================================
    if (masterType === "PROJECT") {
        if (!data.department_id) {
            setAlert({ type: "danger", message: "Department is required" });
            return;
        }
      }

    try {
      if (editItem) {
        await MasterAPI.update(editItem.id, data);
        reloadMasters(true);
        await loadItems();
        setAlert({
            type: "success",
            message: `${singularName} updated successfully`
        });
        } else {
          await MasterAPI.create(masterType, {
            ...data,
            status: "Active",
          });
          reloadMasters(true);
          await loadItems();
          setAlert({
            type: "success",
            message: `${singularName} created successfully`
          });
        }
      setShowForm(false);
      setEditItem(null);
    } catch (error) {
      console.error(`Error saving ${masterType}:`, error);
      setAlert({
        type: "danger",
        message: `Failed to save ${masterType.toLowerCase()}`
      });
    }
  };

  return (
    <PageLayout>
      <AlertMessage
        type={alert.type}
        message={alert.message}
        onClose={() => setAlert({ type: "", message: "" })}
      />

      <TablePanel
        data={items}
        columns={columns}
        loading={loading}
        searchPlaceholder={searchPlaceholder}
        onAddNew={() => {
          fetchManagers?.();

          // ✅ RESET department filter for Add mode
          if (onDepartmentChange) {
            onDepartmentChange(null);
          }

          setEditItem(null);
          setShowForm(true);
        }}
        onEdit={disableStatus ? null : editItemHandler}
        onDelete={disableStatus ? null : deleteItem}
        statusFilter={disableStatus ? null : statusFilter}
        setStatusFilter={disableStatus ? null : setStatusFilter}
        sortOrder={sortOrder}
        onToggleSort={() =>
          setSortOrder((p) => (p === "desc" ? "asc" : "desc"))
        }
      />

      {/* Pagination */}
        {totalRecords > 0 && (
        <div className="d-flex justify-content-between align-items-center mt-3">

            {/* Left info */}
            <div className="text-muted">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, totalRecords)} of{" "}
            {totalRecords} records
            </div>

            {/* Controls */}
            <div className="d-flex align-items-center gap-2">

            <select
                className="form-select form-select-sm"
                style={{ width: "90px" }}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
            >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
            </select>

            <ul className="pagination pagination-sm mb-0">

                <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(1)}>
                    «
                </button>
                </li>

                <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                <button
                    className="page-link"
                    onClick={() => setCurrentPage((p) => p - 1)}
                >
                    ‹
                </button>
                </li>

                {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                return (
                    <li
                    key={page}
                    className={`page-item ${
                        page === currentPage ? "active" : ""
                    }`}
                    >
                    <button
                        className="page-link"
                        onClick={() => setCurrentPage(page)}
                    >
                        {page}
                    </button>
                    </li>
                );
                })}

                <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                <button
                    className="page-link"
                    onClick={() => setCurrentPage((p) => p + 1)}
                >
                    ›
                </button>
                </li>

                <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                <button
                    className="page-link"
                    onClick={() => setCurrentPage(totalPages)}
                >
                    »
                </button>
                </li>

            </ul>
            </div>
        </div>
        )}

      {showForm && (
        <AddNewModal
          onDepartmentChange={onDepartmentChange}
          title={editItem ? `Edit ${singularName}` : `Add ${singularName}`}
          fields={formFields}
          initialData={editItem}
          onSave={saveItem}
          onCancel={() => {
            setShowForm(false);
            setEditItem(null);
          }}
        />
      )}

      {deleteTarget && !disableStatus && (
        <ConfirmDeleteModal
          title={
            deleteTarget?.status === "Active"
                ? "Confirm Deactivation"
                : "Confirm Activation"
            }
          message={`Are you sure you want to ${
            deleteTarget?.status === "Active" ? "deactivate" : "activate"
          } this ${singularName.toLowerCase()}?`}
          actionLabel={deleteTarget?.status === "Active" ? "Deactivate" : "Activate"}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {deptDeactivateTarget && (
        <DeactivateDepartmentModal
          department={deptDeactivateTarget}
          loading={deptDeactivateLoading}
          onCancel={() => setDeptDeactivateTarget(null)}
          onConfirm={confirmDepartmentDeactivation}
        />
      )}

    </PageLayout>
  );
}

// ============================================================================
// PAGE IMPLEMENTATIONS (All Dynamic)
// ============================================================================

function RolesPage() {
  return (
    <GenericCRUDPage
      masterType="ROLE"
      singularName="Role"
      searchPlaceholder="Search roles..."
      columns={[
        { key: "name", label: "Role Name" },
        { key: "created_at", label: "Created On" },
        { key: "status", label: "Status" },
        { key: "actions", label: "Actions" },
      ]}
      formFields={[
        { key: "name", label: "Role Name" }
      ]}
    />
  );
}

function DepartmentsPage() {
  return (
    <GenericCRUDPage
      masterType="DEPARTMENT"
      singularName="Department"
      searchPlaceholder="Search departments..."
      columns={[
        { key: "name", label: "Department" },
        { key: "status", label: "Status" },
        { key: "actions", label: "Actions" },
      ]}
      formFields={[
        { key: "name", label: "Department Name" },
      ]}
    />
  );
}

function MeasurementsPage() {
  return (
    <GenericCRUDPage
      masterType="METRIC"
      singularName="Measurement"
      searchPlaceholder="Search measurements..."
      columns={[
        { key: "name", label: "Measurement" },
        { key: "status", label: "Status" },
        { key: "actions", label: "Actions" },
      ]}
      formFields={[
        { key: "name", label: "Measurement Name" }
      ]}
    />
  );
}

function ProjectsPage() {
  const { masters, reloadMasters } = useMasterData();

  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [managers, setManagers] = useState([]);

  const fetchManagers = () => {
    axiosInstance
      .get("/employee/employees/", {
        params: {
          role: "Manager",
          status: "Active",
          page_size: 1000, 
        },
      })
      .then((res) => {
        const data = res.data?.results ?? res.data ?? [];
        setManagers(data);
      })
      .catch(() => setManagers([]));
  };

  useEffect(() => {
    fetchManagers();
  }, []);

  const filteredManagers = useMemo(() => {
    if (!selectedDepartment) {
        return managers.map((m) => ({
        id: m.id,
        name: m.full_name || `${m.user?.first_name || ''} ${m.user?.last_name || ''}`.trim() || 'Unknown'
        }));
    }

    const selectedDept = masters.DEPARTMENT?.find(d => d.id === selectedDepartment);
    const selectedDeptName = selectedDept?.name;

    if (!selectedDeptName) {
        return [];
    }

    const filtered = managers
        .filter((m) => {
            const deptName = m.department?.name;
            return deptName === selectedDeptName;
        })
        .map((m) => ({
            id: m.id,
            name: m.full_name || `${m.user?.first_name || ''} ${m.user?.last_name || ''}`.trim() || 'Unknown'
        }));
    
    return filtered;
    }, [managers, selectedDepartment, masters.DEPARTMENT]);

  const formFields = useMemo(() => {
    return [
      { key: "name", label: "Project Name" },
      {
        key: "department_id",
        label: "Department",
        type: "select",
        options: masters.DEPARTMENT || [],
      },
      {
        key: "managers",
        label: "Manager",
        type: "select",
        options: filteredManagers,
      },
    ];
  }, [masters.DEPARTMENT, filteredManagers]);



  return (
    <GenericCRUDPage
      masterType="PROJECT"
      singularName="Project"
      searchPlaceholder="Search projects..."
      fetchManagers={fetchManagers}
      onDepartmentChange={(deptId) => {

        const validDeptId =
          deptId && !isNaN(deptId) ? Number(deptId) : null;

        setSelectedDepartment(validDeptId);
      }}
      columns={[
        { key: "name", label: "Project" },
        { key: "department_name", label: "Department" },
        { key: "managers", label: "Manager" },
        { key: "status", label: "Status" },
        { key: "actions", label: "Actions" }, 
        ]}
      formFields={formFields}
      departmentMasters={masters.DEPARTMENT || []}
      allManagers={managers}
    />
  );
}


function EmployeeRoleAssignmentsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [statusFilter, setStatusFilter] = useState("Active");

  const { masters } = useMasterData();
  const [employees, setEmployees] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const filteredManagers = useMemo(() => {
    if (!selectedDepartment) return [];

    return employees
      .filter(
        e =>
          e.role === "Manager" &&
          e.department?.id === selectedDepartment
      )
      .map(e => ({
        id: e.id,
        name: e.full_name || e.username,
      }));
  }, [employees, selectedDepartment]);

  // -------------------------
  // Load employees
  // -------------------------
  useEffect(() => {
    axiosInstance
      .get("/employee/employees/", { params: { status: "Active" } })
      .then((res) => setEmployees(res.data?.results ?? []))
      .catch(() => setEmployees([]));
  }, []);

  // -------------------------
  // Load assignments
  // -------------------------
  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await EmployeeRoleAPI.list({ status: statusFilter });
      setItems(res.results);
    } catch {
      setAlert({ type: "danger", message: "Failed to load role assignments" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [statusFilter]);

  // -------------------------
  // Save
  // -------------------------
  const saveItem = async (data) => {
    try {
      if (editItem) {
        await EmployeeRoleAPI.update(editItem.id, data);
      } else {
        await EmployeeRoleAPI.create({
          ...data,
          status: "Active",
        });
      }
      setAlert({ type: "success", message: "Saved successfully" });
      setShowForm(false);
      setEditItem(null);
      loadItems();
    } catch {
      setAlert({ type: "danger", message: "Save failed" });
    }
  };

  return (
    <PageLayout>
      <AlertMessage
        type={alert.type}
        message={alert.message}
        onClose={() => setAlert({})}
      />

      <TablePanel
        data={items}
        loading={loading}
        searchPlaceholder="Search role assignments..."
        columns={[
          { key: "employee_name", label: "Employee" },
          { key: "role_name", label: "Role" },
          { key: "department_name", label: "Department" },
          { key: "reporting_manager_name", label: "Reporting Manager" },
          { key: "status", label: "Status" },
          { key: "actions", label: "Actions" },
        ]}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onAddNew={() => setShowForm(true)}
        onEdit={(row) => {
          setEditItem({
            id: row.id,
            employee: row.employee,
            role: row.role,
            department: row.department,
            reporting_manager: row.reporting_manager,
          });
          setSelectedDepartment(row.department);
          setShowForm(true);
        }}
        onDelete={null} 
      />

      {showForm && (
        <AddNewModal
          title={editItem ? "Edit Role Assignment" : "Add Role Assignment"}
          initialData={editItem}
          onSave={saveItem}
          onCancel={() => {
            setShowForm(false);
            setEditItem(null);
          }}
          onDepartmentChange={(deptId) => setSelectedDepartment(deptId)}
          fields={[
            {
              key: "employee",
              label: "Employee",
              type: "select",
              options: employees.map((e) => ({
                id: e.id,
                name: e.full_name || e.username,
              })),
            },
            {
              key: "role",
              label: "Role",
              type: "select",
              options: masters.ROLE || [],
            },
            {
              key: "department_id",
              label: "Department",
              type: "select",
              options: masters.DEPARTMENT || [],
            },
            {
              key: "reporting_manager",
              label: "Reporting Manager",
              type: "select",
              options: filteredManagers,
            },
          ]}
        />
      )}
    </PageLayout>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function formatDate(v) {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (isNaN(d)) return v;
    return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return v;
  }
}

// ============================================================================
// MAIN ROUTER COMPONENT
// ============================================================================
export default function MasterModule() {
  const { type } = useParams();

  switch (type) {
    case "roles":
      return <RolesPage />;

    case "departments":
      return <DepartmentsPage />;

    case "projects":
      return <ProjectsPage />;

    case "measurements":
      return <MeasurementsPage />;

    case "employee-role-assignments":
      return <EmployeeRoleAssignmentsPage />;

    default:
      return <Navigate to="/404" replace />;
  }
}