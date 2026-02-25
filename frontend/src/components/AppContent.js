import React, { Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { CContainer, CSpinner } from "@coreui/react";

// routes config
import routes from "../routes";

const AppContent = () => {
  const role = localStorage.getItem("role");

  const getDefaultRoute = () => {
    if (!role) return "/login";
    if (role.toLowerCase() === "employee") return "/employee-dashboard";
    return "/dashboard";
  };

  return (
    <CContainer className="px-4" lg>
      <Suspense fallback={<CSpinner color="primary" />}>
        <Routes>
          <Route
            index
            element={
              (() => {
                const token = localStorage.getItem("access_token");

                if (!token) return <Navigate to="/login" replace />;

                try {
                  const payload = JSON.parse(atob(token.split(".")[1]));
                  const expiry = payload.exp * 1000;

                  if (Date.now() >= expiry) {
                    localStorage.clear();
                    return <Navigate to="/login" replace />;
                  }

                  return <Navigate to={getDefaultRoute()} replace />;
                } catch {
                  localStorage.clear();
                  return <Navigate to="/login" replace />;
                }
              })()
            }
          />
          {routes.map((route, idx) => {
            if (!route.element) return null;

            const Element = route.element;

            return (
              <Route
                key={idx}
                path={route.path}
                exact={route.exact}
                name={route.name}
                element={<Element />}
              />
            );
          })}
        </Routes>
      </Suspense>
    </CContainer>
  );
};

export default React.memo(AppContent);