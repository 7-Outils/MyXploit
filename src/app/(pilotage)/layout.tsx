import { Suspense } from "react";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { ContractProvider } from "@/contexts/ContractContext";
import { GhostModeBar } from "@/components/admin/GhostModeBar";
import { ToastProvider } from "@/components/ui/toast";

export default function PilotageRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
    <UserProfileProvider>
      <PermissionProvider>
        <Suspense fallback={null}>
          <ContractProvider>
            <GhostModeBar />
            <div className="min-h-screen bg-background-secondary">
              {children}
            </div>
          </ContractProvider>
        </Suspense>
      </PermissionProvider>
    </UserProfileProvider>
    </ToastProvider>
  );
}
