"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/ui/user-menu";
import { useUserProfile } from "@/contexts/UserProfileContext";
import {
  BarChart3,
  Building2,
  TrendingUp,
  FileText,
  Wrench,
  Bell,
  ArrowLeft,
  LogOut,
  User,
  type LucideIcon,
} from "lucide-react";

const PROFILE_COLORS = {
  CLIENT: { bg: "bg-blue-500/20", text: "text-blue-300", label: "Client" },
  AMO: { bg: "bg-purple-500/20", text: "text-purple-300", label: "AMO" },
  EXPLOITANT: { bg: "bg-orange-500/20", text: "text-orange-300", label: "Exploitant" },
};

type TabDef = {
  href: string;
  label: string;
  icon: LucideIcon;
  profiles: ("CLIENT" | "AMO" | "EXPLOITANT")[];
};

const TABS: TabDef[] = [
  { href: "/pilotage", label: "Centre de commande", icon: BarChart3, profiles: ["CLIENT", "AMO", "EXPLOITANT"] },
  { href: "/pilotage/patrimoine", label: "Patrimoine", icon: Building2, profiles: ["CLIENT", "AMO", "EXPLOITANT"] },
  { href: "/pilotage/performance", label: "Performance", icon: TrendingUp, profiles: ["CLIENT", "AMO", "EXPLOITANT"] },
  { href: "/pilotage/contrats", label: "Contrats", icon: FileText, profiles: ["CLIENT", "AMO", "EXPLOITANT"] },
  { href: "/pilotage/equipements", label: "Équipements", icon: Wrench, profiles: ["AMO", "EXPLOITANT"] },
  { href: "/pilotage/alertes", label: "Alertes", icon: Bell, profiles: ["CLIENT", "AMO", "EXPLOITANT"] },
];

export default function PilotageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useUserProfile();

  const visibleTabs = TABS.filter((tab) => {
    if (!profile) return true; // Show all if no profile set
    return tab.profiles.includes(profile);
  });

  const profileConfig = profile ? PROFILE_COLORS[profile] : null;

  return (
    <div className="min-h-screen">
      {/* Premium dark header */}
      <div className="bg-gradient-to-r from-[#12161F] via-[#182030] to-[#12161F] border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8">
          {/* Top row: branding + profile badge */}
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/overview"
                className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Retour</span>
              </Link>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
                  <BarChart3 size={20} className="text-accent" />
                </div>
                <h1 className="text-white font-semibold text-lg tracking-tight">
                  Pilotage Énergétique
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {profileConfig && (
                <span className={cn("text-xs font-medium px-3 py-1.5 rounded-full", profileConfig.bg, profileConfig.text)}>
                  {profileConfig.label}
                </span>
              )}
              <UserMenu />
            </div>
          </div>

          {/* Tab navigation */}
          <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-none">
            {visibleTabs.map((tab) => {
              const isActive = tab.href === "/pilotage"
                ? pathname === "/pilotage"
                : pathname.startsWith(tab.href);

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap",
                    isActive
                      ? "border-accent text-white"
                      : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600"
                  )}
                >
                  <tab.icon size={16} className={isActive ? "text-accent" : ""} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
