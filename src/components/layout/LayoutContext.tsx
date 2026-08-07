"use client";

import { createContext, useContext } from "react";

interface LayoutContextValue {
  openSidebar: () => void;
  userId: string;
  nickname: string;
  userRole: string;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    // Safe fallback for contexts rendered outside the provider
    return { openSidebar: () => {}, userId: "", nickname: "", userRole: "member" };
  }
  return ctx;
}

export const LayoutContextProvider = LayoutContext.Provider;
