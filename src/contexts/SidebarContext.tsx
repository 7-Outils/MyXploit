"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type SidebarContextType = {
  // Desktop: sidebar repliée en mode "icônes seules" (md+)
  collapsed: boolean;
  toggle: () => void;
  // Mobile: drawer ouvert par-dessus le contenu (< md)
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  toggle: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
});

const COLLAPSED_STORAGE_KEY = "sidebar-collapsed";

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Préférence mémorisée : la sidebar repliée le reste après rechargement
  const [collapsed, setCollapsed] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
      }
    } catch {
      // localStorage indisponible : état par défaut
    }
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle: () =>
          setCollapsed((v) => {
            const next = !v;
            try {
              window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
            } catch {
              // écriture impossible : préférence non persistée
            }
            return next;
          }),
        mobileOpen,
        setMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
