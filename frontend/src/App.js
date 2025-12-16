import React, { Suspense, useEffect } from "react";
import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { CSpinner } from "@coreui/react";
import "./scss/style.scss";
import "./scss/examples.scss";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

const DefaultLayout = React.lazy(() => import("./layout/DefaultLayout"));
const Login = React.lazy(() => import("./views/pages/login/Login"));
const Register = React.lazy(() => import("./views/pages/register/Register"));
const Page404 = React.lazy(() => import("./views/pages/page404/Page404"));
const Page500 = React.lazy(() => import("./views/pages/page500/Page500"));

const App = () => {
  

  React.useEffect(() => {
    const checkLoginRoute = () => {
      const currentHash = window.location.hash;
      const token = localStorage.getItem("access_token");

      if (currentHash === "#/login" && !token) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("role");
        localStorage.removeItem("emp_id");
        localStorage.removeItem("employee_name");
        localStorage.removeItem("department");
        localStorage.removeItem("manager");
      }
    };

    checkLoginRoute();
    window.addEventListener("hashchange", checkLoginRoute);
    return () => window.removeEventListener("hashchange", checkLoginRoute);
  }, []);

  
//  ProtectedRoute
  const ProtectedRoute = ({ children, allowedRoles }) => {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("role")?.toLowerCase();

    if (!token) {
      return <Navigate to="/login" replace />;
    }

    if (allowedRoles && role && !allowedRoles.includes(role)) {
      return <Navigate to="/login" replace />;
    }

    return children;
  };

  const RootRedirect = () => {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("role")?.toLowerCase();

    if (!token) {
      return <Navigate to="/login" replace />;
    }

    if (role === "employee") {
      return <Navigate to="/employee-dashboard" replace />;
    }

    return <Navigate to="/admin-dashboard" replace />;
  };

  return (
    <HashRouter>
      <Suspense
        fallback={
          <div className="pt-3 text-center">
            <CSpinner color="primary" variant="grow" />
          </div>
        }
      >
        <Routes>
          <Route index element={<RootRedirect />} />

          <Route exact path="/login" element={<Login />} />
          <Route exact path="/register" element={<Register />} />
          <Route exact path="/404" element={<Page404 />} />
          <Route exact path="/500" element={<Page500 />} />

          <Route
            path="/*"
            element={
              <ProtectedRoute allowedRoles={["admin", "manager", "employee"]}>
                <DefaultLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

export default App;