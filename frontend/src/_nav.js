/*
import React from "react";
import CIcon from "@coreui/icons-react";
import {
  cilUser,
  cilSpeedometer,
  cilCursor,
} from "@coreui/icons";
import { CNavGroup, CNavItem } from "@coreui/react";

// Read role from localStorage
const role = (localStorage.getItem("role") || "").toLowerCase();

// ===============================
// NAV STRUCTURE (Clean Version)
// ===============================

// ADMIN MENU
const adminMenu = [
  {
    component: CNavGroup,
    name: "Admin",
    to: "",
    items: [
      {
        component: CNavItem,
        name: "Dashboard",
        to: "/dashboard",
        icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
      },

      {
        component: CNavGroup,
        name: "Employee",
        to: "",
        icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
        items: [
          {
            component: CNavItem,
            name: "Employee details",
            to: "/base/employeedetails",
          },
          {
            component: CNavItem,
            name: "Employee Performance",
            to: "/base/employeeperformance",
          },
          {
            component: CNavItem,
            name: "Employee credentials",
            to: "/base/cards",
          },
        ],
      },

      {
        component: CNavItem,
        name: "Reports",
        to: "/buttons",
        icon: <CIcon icon={cilCursor} customClassName="nav-icon" />,
      },
    ],
  },
];

// EMPLOYEE MENU
const employeeMenu = [
  {
    component: CNavGroup,
    name: "Employee",
    to: "",
    items: [
      {
        component: CNavGroup,
        name: "Employee Module",
        to: "",
        icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
        items: [
          {
            component: CNavItem,
            name: "Employee Dashboard",
            to: "/base/collapses",
          },
          {
            component: CNavItem,
            name: "Employee Performance",
            to: "/base/carousels",
          },
        ],
      },
    ],
  },
];

// LOGIN (visible only for guests)
const loginMenu = [
  {
    component: CNavItem,
    name: "Login",
    to: "/login",
  },
];

// ===============================
// FINAL ROLE-BASED MENU OUTPUT
// ===============================
let _nav = [];

if (role === "admin") _nav = [...adminMenu];
else if (role === "employee") _nav = [...employeeMenu];
else _nav = [...loginMenu];

export default _nav;
*/

import React from "react";
import CIcon from "@coreui/icons-react";
import {
  cilUser,
  cilSpeedometer,
  cilCursor,
  cilAddressBook,   // Employee Details
  cilChartLine,     // Employee Performance
  cilLockLocked     // Employee Credentials
} from "@coreui/icons";

import { cilList } from "@coreui/icons";
import { CNavItem, CNavGroup } from "@coreui/react";


// ===============================
// ADMIN MENU (FLAT STYLE LIKE FRIEND)
// ===============================
const adminMenu = [
  {
    component: CNavItem,
    name: "Dashboard",
    to: "/dashboard",
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: "Employee Details",
    to: "/base/employeedetails",       // ✅ your correct route
    icon: <CIcon icon={cilAddressBook} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: "Employee Performance",
    to: "/base/employeeperformance",   // ✅ your correct route
    icon: <CIcon icon={cilChartLine} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: "Employee Credentials",
    to: "/base/cards",                 // ✅ your correct route
    icon: <CIcon icon={cilLockLocked} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: "Reports",
    to: "/reports/weekly",
    icon: <CIcon icon={cilCursor} customClassName="nav-icon" />,
  },

  {
  component: CNavGroup,
  name: "Master Modules",
  icon: <CIcon icon={cilList} customClassName="nav-icon" />,
  items: [
    {
      component: CNavItem,
      name: "Roles",
      to: "/masters/roles",
    },
    {
      component: CNavItem,
      name: "Departments",
      to: "/masters/departments",
    },
    {
      component: CNavItem,
      name: "Measurements",
      to: "/masters/measurements",
    },
    {
      component: CNavItem,
      name: "Projects",
      to: "/masters/projects",
    },
  ],
},

];

// ===============================
// EMPLOYEE MENU (FLAT STYLE)
// ===============================
const employeeMenu = [
  {
    component: CNavItem,
    name: "Employee Dashboard",
    to: "/base/collapses",   // your actual dashboard route
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: "Employee Performance",
    to: "/base/carousels",
    icon: <CIcon icon={cilChartLine} customClassName="nav-icon" />,
  },
];

// ===============================
// LOGIN MENU
// ===============================
const loginMenu = [
  {
    component: CNavItem,
    name: "Login",
    to: "/login",
  },
];


export { adminMenu, employeeMenu, loginMenu };
