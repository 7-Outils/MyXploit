import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { UserProfileProvider } from "@/contexts/UserProfileContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProfileProvider>
      <div className="min-h-screen bg-background-secondary">
        <Sidebar />
        <div className="pl-64 transition-all duration-300">
          <Topbar />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </UserProfileProvider>
  );
}
