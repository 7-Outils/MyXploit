"use client";

import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div
      className={cn(
        "transition-all duration-300",
        // Mobile: pas de padding gauche (la sidebar est en drawer)
        // Desktop: décalage selon l'état collapsed
        collapsed ? "md:pl-20" : "md:pl-64"
      )}
    >
      {children}
    </div>
  );
}
