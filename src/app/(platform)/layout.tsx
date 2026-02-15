import { Suspense } from "react";
import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { PlatformTopbar } from "@/components/platform/platform-topbar";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { GhostModeBar } from "@/components/admin/GhostModeBar";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProfileProvider>
      <PermissionProvider>
        <Suspense fallback={null}>
          <GhostModeBar />
          <div className="min-h-screen bg-background-secondary">
            <PlatformSidebar />
            <div className="pl-64 transition-all duration-300">
              <PlatformTopbar />
              <main className="p-6">{children}</main>
            </div>
          </div>
        </Suspense>
      </PermissionProvider>
    </UserProfileProvider>
  );
}
