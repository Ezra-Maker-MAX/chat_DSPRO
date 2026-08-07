"use client";

import { createContext, useContext } from "react";

interface LayoutContextValue {
  openSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    // Safe fallback for contexts rendered outside the provider
    return { openSidebar: () => {} };
  }
  return ctx;
}

export const LayoutContextProvider = LayoutContext.Provider;
