import React, { useEffect, useState } from "react";
import EmployeeLifecycleAPI from "./EmployeeLifecycleAPI";

export default function EmployeeLifecycleHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [ordering, setOrdering] = useState("-joined_at");
  const [employee, setEmployee] = useState("");
  const [department, setDepartment] = useState("");
  const [movementType, setMovementType] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await EmployeeLifecycleAPI.getLifecycleHistory({
        page,
        page_size: pageSize,
        ordering,
        employee: employee || undefined,
        department: department || undefined,
        movement_type: movementType || undefined,
      });

      setRows(res.results);
      setTotalPages(res.total_pages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, pageSize, ordering, employee, department, movementType]);

  const toggleSort = () => {
    setOrdering((prev) =>
      prev === "-joined_at" ? "joined_at" : "-joined_at"
    );
  };

  return (
    <div className="card shadow-sm p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Employee Lifecycle History</h5>

        <div className="d-flex gap-2">
          <select
            className="form-select form-select-sm"
            style={{ width: "90px" }}
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>

          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={toggleSort}
          >
            Sort: {ordering === "-joined_at" ? "Newest" : "Oldest"}
          </button>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-4">
            <input
            className="form-control form-control-sm"
            placeholder="Employee ID"
            value={employee}
            onChange={(e) => {
                setPage(1);
                setEmployee(e.target.value);
            }}
            />
        </div>

        <div className="col-md-4">
            <input
            className="form-control form-control-sm"
            placeholder="Department ID"
            value={department}
            onChange={(e) => {
                setPage(1);
                setDepartment(e.target.value);
            }}
            />
        </div>

        <div className="col-md-4">
            <select
            className="form-select form-select-sm"
            value={movementType}
            onChange={(e) => {
                setPage(1);
                setMovementType(e.target.value);
            }}
            >
            <option value="">All Movements</option>
            <option value="DEPT_DEACTIVATION">Department Deactivation</option>
            <option value="AUTO_TRANSFER">Auto Transfer</option>
            </select>
        </div>
        </div>


      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Role</th>
              <th>Designation</th>
              <th>Joined At</th>
              <th>Left At</th>
              <th>Movement</th>
              <th>Reason</th>
              <th>Action By</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="text-center">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center text-muted">
                  No lifecycle records found
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.employee}</td>
                  <td>{r.department}</td>
                  <td>{r.role}</td>
                  <td>{r.designation}</td>
                  <td>{r.joined_at || "-"}</td>
                  <td>{r.left_at || "-"}</td>
                  <td>{r.movement_type}</td>
                  <td>{r.reason || "-"}</td>
                  <td>{r.action_by || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center mt-3">
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage(1)}>
                «
              </button>
            </li>

            <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
              <button
                className="page-link"
                onClick={() => setPage((p) => p - 1)}
              >
                ‹
              </button>
            </li>

            {[...Array(totalPages)].map((_, i) => {
              const p = i + 1;
              return (
                <li
                  key={p}
                  className={`page-item ${p === page ? "active" : ""}`}
                >
                  <button className="page-link" onClick={() => setPage(p)}>
                    {p}
                  </button>
                </li>
              );
            })}

            <li
              className={`page-item ${
                page === totalPages ? "disabled" : ""
              }`}
            >
              <button
                className="page-link"
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </button>
            </li>

            <li
              className={`page-item ${
                page === totalPages ? "disabled" : ""
              }`}
            >
              <button
                className="page-link"
                onClick={() => setPage(totalPages)}
              >
                »
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
