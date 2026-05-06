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

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle: () => setCollapsed((v) => !v),
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
