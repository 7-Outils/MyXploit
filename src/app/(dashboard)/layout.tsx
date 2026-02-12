import { Suspense } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { ContractProvider } from "@/contexts/ContractContext";
import { GhostModeBar } from "@/components/admin/GhostModeBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProfileProvider>
      <PermissionProvider>
        <Suspense fallback={null}>
          <ContractProvider>
            <GhostModeBar />
            <div className="min-h-screen bg-background-secondary">
              <Sidebar />
              <div className="pl-64 transition-all duration-300">
                <Topbar />
                <main className="p-6">{children}</main>
              </div>
            </div>
          </ContractProvider>
        </Suspense>
      </PermissionProvider>
    </UserProfileProvider>
  );
}
