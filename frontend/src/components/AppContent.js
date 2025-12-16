import React, { Suspense } from "react";
import { Route, Routes } from "react-router-dom";
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
          {routes.map((route, idx) => {
            return (
              route.element && (
                <Route
                  key={idx}
                  path={route.path}
                  exact={route.exact}
                  name={route.name}
                  element={<route.element />}
                />
              )
            );
          })}
        </Routes>
      </Suspense>
    </CContainer>
  );
};

export default React.memo(AppContent);
