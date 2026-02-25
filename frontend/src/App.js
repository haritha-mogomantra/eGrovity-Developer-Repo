import React, { Suspense, useEffect } from "react";
import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { CSpinner } from "@coreui/react";
import "./scss/style.scss";
import "./scss/examples.scss";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import { MasterDataProvider } from "./context/MasterDataContext";


const DefaultLayout = React.lazy(() => import("./layout/DefaultLayout"));
const Login = React.lazy(() => import("./views/pages/login/Login"));
const Register = React.lazy(() => import("./views/pages/register/Register"));
const Page404 = React.lazy(() => import("./views/pages/page404/Page404"));
const Page500 = React.lazy(() => import("./views/pages/page500/Page500"));

const isTokenValid = () => {
  const token = localStorage.getItem("access_token");
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")?.[1] || ""));
    const expiry = payload.exp * 1000;
    return Date.now() < expiry;
  } catch {
    return false;
  }
};

const App = () => {
  // ✅ Clear auth data ONLY when app is closed and reopened
  useEffect(() => {
    // Check if this is a fresh browser session (not just a refresh)
    const isNewSession = !sessionStorage.getItem("app_initialized");
    
    if (isNewSession) {
      console.log("🔄 New browser session detected - clearing auth data");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("role");
      localStorage.removeItem("emp_id");
      localStorage.removeItem("employee_name");
      localStorage.removeItem("department");
      localStorage.removeItem("manager");
      
      // Mark session as initialized
      sessionStorage.setItem("app_initialized", "true");
    }
  }, []);

  // ✅ PROTECTED ROUTE COMPONENT
  const ProtectedRoute = ({ children, allowedRoles }) => {
    const tokenValid = isTokenValid();
    const role = localStorage.getItem("role")?.toLowerCase().trim();

    if (!tokenValid) {
      return <Navigate to="/login" replace />;
    }

    if (!role) {
      localStorage.clear();
      return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(role)) {
      return <Navigate to="/login" replace />;
    }

    return children;
  };

  return (
    <MasterDataProvider>
      <HashRouter>
        <Suspense
          fallback={
            <div className="pt-3 text-center">
              <CSpinner color="primary" variant="grow" />
            </div>
          }
        >
          <Routes>
            {/* ROOT ROUTE */}
            <Route
              path="/"
              element={
                isTokenValid() && localStorage.getItem("role") ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* PUBLIC ROUTES */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/404" element={<Page404 />} />
            <Route path="/500" element={<Page500 />} />

            {/* PROTECTED ROUTES */}
            <Route
              path="/*"
              element={
                <ProtectedRoute allowedRoles={["admin", "manager", "employee"]}>
                  <DefaultLayout />
                </ProtectedRoute>
              }
            />

            {/* FALLBACK */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </MasterDataProvider>
  );
};

export default App;