"use client";

import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className={cn("transition-all duration-300", collapsed ? "pl-20" : "pl-64")}>
      {children}
    </div>
  );
}
