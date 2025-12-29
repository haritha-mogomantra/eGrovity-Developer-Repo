// ============================================================
// FILE: src/hooks/useMasters.js
// PURPOSE: Thin wrapper around MasterDataContext
// ============================================================

import { useMasterData } from "../context/MasterDataContext";

/**
 * useMasters
 * ------------------------------------------------------------------
 * Central hook for accessing master data across the app.
 * This avoids importing context directly in every component.
 *
 * Usage:
 * const { masters, loading, reloadMasters } = useMasters();
 */
export const useMasters = () => {
  const { masters, loading, reloadMasters } = useMasterData();

  return {
    masters,
    loading,
    reloadMasters,
  };
};
