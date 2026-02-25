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
import { cilHistory } from "@coreui/icons";
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
    component: CNavGroup,
    name: "Reports",
    icon: <CIcon icon={cilCursor} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: "Weekly Reports",
        to: "/reports/weekly",
      },
      {
        component: CNavItem,
        name: "Monthly Reports",
        to: "/reports/monthly",
      },
      {
        component: CNavItem,
        name: "Department Reports",
        to: "/reports/department",
      },
      {
        component: CNavItem,
        name: "Manager Reports",
        to: "/reports/manager",
      },
    ],
  },

  {
    component: CNavItem,
    name: "Employee Lifecycle History",
    to: "/employee-lifecycle/history",
    icon: <CIcon icon={cilHistory} customClassName="nav-icon" />,
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
