import { Suspense } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { ContractProvider } from "@/contexts/ContractContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { GhostModeBar } from "@/components/admin/GhostModeBar";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SWRProvider } from "@/components/SWRProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRProvider>
      <UserProfileProvider>
        <PermissionProvider>
          <Suspense fallback={null}>
            <ContractProvider>
              <SidebarProvider>
                <GhostModeBar />
                <div className="min-h-screen bg-background-secondary">
                  <Sidebar />
                  <DashboardShell>
                    <Topbar />
                    <main className="p-6">{children}</main>
                  </DashboardShell>
                </div>
              </SidebarProvider>
            </ContractProvider>
          </Suspense>
        </PermissionProvider>
      </UserProfileProvider>
    </SWRProvider>
  );
}
