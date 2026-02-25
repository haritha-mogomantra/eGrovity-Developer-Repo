/*
import React, { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  CContainer,
  CDropdown,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  useColorModes,
  CBadge,
} from "@coreui/react";

import CIcon from "@coreui/icons-react";
import { cilBell, cilContrast, cilMenu, cilMoon, cilSun } from "@coreui/icons";

import axiosInstance from "../utils/axiosInstance";   // ✅ FIXED

import { AppBreadcrumb } from "./index";
import { AppHeaderDropdown } from "./header/index";

const AppHeader = () => {
  const headerRef = useRef();
  const dispatch = useDispatch();
  const sidebarShow = useSelector((state) => state.sidebarShow);

  const { colorMode, setColorMode } = useColorModes(
    "coreui-free-react-admin-template-theme"
  );

  const [userRole, setUserRole] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ======================================
  // 🔹 FETCH NOTIFICATIONS
  // ======================================
  const loadNotifications = async () => {
    try {
      const res = await axiosInstance.get("notifications/?status=unread");

      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      console.log("Error loading notifications:", err);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  // ======================================
  // 🔹 MARK AS READ
  // ======================================
  const markAsRead = async (id) => {
    try {
      await axiosInstance.patch(`notifications/${id}/mark-read/`);
      loadNotifications();
    } catch (err) {
      console.log("Mark as read error:", err);
    }
  };

  // ======================================
  // 🔹 LOAD USER ROLE
  // ======================================
  useEffect(() => {
    const savedRole = localStorage.getItem("role");
    setUserRole(savedRole ? savedRole.toLowerCase() : "guest");
  }, []);

  // ======================================
  // 🔹 LOAD NOTIFICATIONS ONLY FOR EMPLOYEE
  // ======================================
  useEffect(() => {
    if (userRole === "employee") {
      loadNotifications();
    }
  }, [userRole]);

  // ======================================
  // 🔹 AUTO REFRESH (EVERY 30s)
  // ======================================
  useEffect(() => {
    if (userRole !== "employee") return;

    const interval = setInterval(() => loadNotifications(), 30000);
    return () => clearInterval(interval);
  }, [userRole]);

  // ======================================
  // 🔹 HEADER SHADOW ON SCROLL
  // ======================================
  useEffect(() => {
    const handleScroll = () => {
      if (headerRef.current) {
        headerRef.current.classList.toggle(
          "shadow-sm",
          document.documentElement.scrollTop > 0
        );
      }
    };
    document.addEventListener("scroll", handleScroll);
    return () => document.removeEventListener("scroll", handleScroll);
  }, []);

  // ======================================
  // 🔹 RENDER UI
  // ======================================
  return (
    <CHeader position="sticky" className="mb-4 p-0" ref={headerRef}>
      <CContainer className="border-bottom px-4" fluid>
        <CHeaderToggler
          onClick={() => dispatch({ type: "set", sidebarShow: !sidebarShow })}
          style={{ marginInlineStart: "-14px" }}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>

        <CHeaderNav className="ms-auto align-items-center">


          {userRole === "employee" && (
            <CDropdown variant="nav-item" placement="bottom-end">
              <CDropdownToggle caret={false}>
                <div style={{ position: "relative" }}>
                  <CIcon icon={cilBell} size="lg" />

                  {unreadCount > 0 && (
                    <CBadge
                      color="danger"
                      position="top-end"
                      shape="rounded-pill"
                      style={{
                        position: "absolute",
                        top: "-5px",
                        right: "-10px",
                        fontSize: "0.55rem",
                      }}
                    >
                      {unreadCount}
                    </CBadge>
                  )}
                </div>
              </CDropdownToggle>

              <CDropdownMenu className="pt-0">
                <CDropdownHeader>Notifications</CDropdownHeader>

                {notifications.length > 0 ? (
                  notifications.map((note) => (
                    <CDropdownItem
                      key={note.id}
                      onClick={() => markAsRead(note.id)}
                    >
                      {note.meta_display}
                    </CDropdownItem>
                  ))
                ) : (
                  <CDropdownItem disabled>No new notifications</CDropdownItem>
                )}
              </CDropdownMenu>
            </CDropdown>
          )}

          <li className="nav-item py-1">
            <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
          </li>

          <CDropdown variant="nav-item" placement="bottom-end">
            <CDropdownToggle caret={false}>
              {colorMode === "dark" ? (
                <CIcon icon={cilMoon} size="lg" />
              ) : colorMode === "auto" ? (
                <CIcon icon={cilContrast} size="lg" />
              ) : (
                <CIcon icon={cilSun} size="lg" />
              )}
            </CDropdownToggle>

            <CDropdownMenu>
              <CDropdownItem as="button" active={colorMode === "light"} onClick={() => setColorMode("light")}>
                <CIcon className="me-2" icon={cilSun} size="lg" /> Light
              </CDropdownItem>

              <CDropdownItem as="button" active={colorMode === "dark"} onClick={() => setColorMode("dark")}>
                <CIcon className="me-2" icon={cilMoon} size="lg" /> Dark
              </CDropdownItem>

              <CDropdownItem as="button" active={colorMode === "auto"} onClick={() => setColorMode("auto")}>
                <CIcon className="me-2" icon={cilContrast} size="lg" /> Auto
              </CDropdownItem>
            </CDropdownMenu>
          </CDropdown>

          <li className="nav-item py-1">
            <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
          </li>

          <AppHeaderDropdown userRole={userRole} />
        </CHeaderNav>
      </CContainer>

      <CContainer className="px-4" fluid>
        <AppBreadcrumb />
      </CContainer>
    </CHeader>
  );
};

export default AppHeader;
*/

import React, { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  CContainer,
  CDropdown,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  CBadge,
} from "@coreui/react";

import CIcon from "@coreui/icons-react";
import { cilBell, cilMenu } from "@coreui/icons";

import axiosInstance from "../utils/axiosInstance";
import { AppBreadcrumb } from "./index";
import { AppHeaderDropdown } from "./header/index";

const AppHeader = () => {
  const headerRef = useRef();
  const dispatch = useDispatch();
  const sidebarShow = useSelector((state) => state.sidebarShow);

  const [userRole, setUserRole] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ==========================================================
  // 🔹 LOAD UNREAD NOTIFICATIONS
  // ==========================================================
  const loadNotifications = async () => {
    try {
      const res = await axiosInstance.get("notifications/?status=unread");

      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  // ==========================================================
  // 🔹 MARK AS READ
  // ==========================================================
  const markAsRead = async (id) => {
    try {
      await axiosInstance.patch(`notifications/${id}/mark-read/`);
      loadNotifications();
    } catch (err) {
      console.log("Mark-as-read error:", err);
    }
  };

  // ==========================================================
  // 1️⃣ LOAD USER ROLE
  // ==========================================================
  useEffect(() => {
    const updateRole = () => {
      const savedRole = localStorage.getItem("role");
      setUserRole(savedRole ? savedRole.toLowerCase() : "guest");
    };

    updateRole(); // run immediately

    window.addEventListener("storage", updateRole);

    return () => window.removeEventListener("storage", updateRole);
  }, []);

  // ==========================================================
  // 2️⃣ FETCH NOTIFICATIONS WHEN EMPLOYEE
  // ==========================================================
  useEffect(() => {
    if (userRole === "employee") {
      loadNotifications();
    }
  }, [userRole]);

  // ==========================================================
  // 3️⃣ AUTO REFRESH EVERY 30 SEC
  // ==========================================================
  useEffect(() => {
    if (userRole !== "employee") return;

    const interval = setInterval(() => loadNotifications(), 30000);
    return () => clearInterval(interval);
  }, [userRole]);

  // ==========================================================
  // 4️⃣ ADD HEADER SHADOW ON SCROLL
  // ==========================================================
  useEffect(() => {
    const handleScroll = () => {
      if (headerRef.current) {
        const scrolled = document.documentElement.scrollTop > 0;
        headerRef.current.classList.toggle("shadow-sm", scrolled);
      }
    };

    document.addEventListener("scroll", handleScroll);
    return () => document.removeEventListener("scroll", handleScroll);
  }, []);

  // ==========================================================
  // RENDER UI
  // ==========================================================
  return (
    <CHeader position="sticky" className="mb-4 p-0" ref={headerRef}>
      <CContainer className="border-bottom px-4" fluid>
        <CHeaderToggler
          onClick={() => dispatch({ type: "set", sidebarShow: !sidebarShow })}
          style={{ marginInlineStart: "-14px" }}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>

        <CHeaderNav className="ms-auto align-items-center">

          {/* Notification Bell */}
          {userRole === "employee" && (
            <CDropdown variant="nav-item" placement="bottom-end">
              <CDropdownToggle caret={false}>
                <div style={{ position: "relative" }} title="Notifications">
                  <CIcon icon={cilBell} size="lg" />
                  {unreadCount > 0 && (
                    <CBadge
                      color="danger"
                      shape="rounded-pill"
                      style={{
                        position: "absolute",
                        top: "-5px",
                        right: "-10px",
                        fontSize: "0.55rem",
                      }}
                    >
                      {unreadCount}
                    </CBadge>
                  )}
                </div>
              </CDropdownToggle>

              <CDropdownMenu className="pt-0">
                <CDropdownHeader>Notifications</CDropdownHeader>

                {notifications.length > 0 ? (
                  notifications.map((note) => (
                    <CDropdownItem key={note.id} onClick={() => markAsRead(note.id)}>
                      {note.meta_display}
                    </CDropdownItem>
                  ))
                ) : (
                  <CDropdownItem disabled>No new notifications</CDropdownItem>
                )}
              </CDropdownMenu>
            </CDropdown>
          )}

          {/* Divider */}
          <li className="nav-item py-1">
            <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
          </li>

          {/* Profile Dropdown */}
          <AppHeaderDropdown userRole={userRole} />
        </CHeaderNav>
      </CContainer>

      <CContainer className="px-4" fluid>
        <AppBreadcrumb />
      </CContainer>
    </CHeader>
  );
};

export default AppHeader;
