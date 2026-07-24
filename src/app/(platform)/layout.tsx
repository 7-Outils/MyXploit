import { Suspense } from "react";
import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { PlatformTopbar } from "@/components/platform/platform-topbar";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { GhostModeBar } from "@/components/admin/GhostModeBar";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ToastProvider } from "@/components/ui/toast";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
    <UserProfileProvider>
      <PermissionProvider>
        <Suspense fallback={null}>
          <SidebarProvider>
            <GhostModeBar />
            <div className="min-h-screen bg-background-secondary">
              <PlatformSidebar />
              <DashboardShell>
                <PlatformTopbar />
                <main className="p-6">{children}</main>
              </DashboardShell>
            </div>
          </SidebarProvider>
        </Suspense>
      </PermissionProvider>
    </UserProfileProvider>
    </ToastProvider>
  );
}
