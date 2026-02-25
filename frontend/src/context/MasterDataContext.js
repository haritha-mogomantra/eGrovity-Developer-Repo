import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import axiosInstance from "../utils/axiosInstance";
import { useRef } from "react";


const MasterDataContext = createContext(null);

export const MasterDataProvider = ({ children }) => {
  const [masters, setMasters] = useState({
    ROLE: [],
    DEPARTMENT: [],
    PROJECT: [],
    MEASUREMENT: [],
  });

  const loadedOnceRef = useRef(false);

  const [loading, setLoading] = useState(false);

  // 🔹 Load all masters
  const loadMasters = useCallback(async (force = false) => {
    if (loadedOnceRef.current && !force) return;

    try {
        setLoading(true);

      const types = ["ROLE", "DEPARTMENT", "PROJECT", "MEASUREMENT"];

      const requests = types.map((type) =>
        axiosInstance.get("masters/dropdown/", {
          params: { type, status: "Active" },
        })
      );

      const responses = await Promise.all(requests);

      const newMasters = {};
      types.forEach((type, idx) => {
        const data = responses[idx].data?.results ?? responses[idx].data ?? [];
        newMasters[type] = Array.isArray(data)
          ? data.map(item => ({
              id: item.value,
              name: item.label,
              code: item.code ?? null,
              status: item.status ?? "Active"
            }))
            : [];
      });

      setMasters(newMasters);
      loadedOnceRef.current = true;
    } catch (err) {
      console.error("Failed to load master data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔹 Initial load
  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  return (
    <MasterDataContext.Provider
      value={{
        masters,
        loading,
        reloadMasters: (force = false) => loadMasters(force),
      }}
    >
      {children}
    </MasterDataContext.Provider>
  );
};

// 🔹 Custom hook
export const useMasterData = () => {
  const ctx = useContext(MasterDataContext);
  if (!ctx) {
    throw new Error("useMasterData must be used inside MasterDataProvider");
  }
  return ctx;
};
