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
              !localStorage.getItem("access_token")
                ? <Navigate to="/login" replace />
                : <Navigate to={getDefaultRoute()} replace />
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