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
  CLIENT: { bg: "border border-ink/15", text: "text-ink/60", label: "Client" },
  AMO: { bg: "border border-ink/15", text: "text-ink/60", label: "AMO" },
  EXPLOITANT: { bg: "border border-ink/15", text: "text-ink/60", label: "Exploitant" },
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
      {/* En-tête clair, hairline */}
      <div className="bg-white border-b border-ink/10">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8">
          {/* Top row: branding + profile badge */}
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/overview"
                className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-ink/50 transition-colors hover:text-accent"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Retour</span>
              </Link>
              <div className="w-px h-6 bg-ink/10" />
              <div className="flex items-center gap-3">
                <BarChart3 size={18} className="text-accent" />
                <h1 className="text-lg font-semibold tracking-tight text-ink">
                  Pilotage Énergétique
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {profileConfig && (
                <span className={cn("font-mono text-[11px] uppercase tracking-widest px-2.5 py-1", profileConfig.bg, profileConfig.text)}>
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
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 whitespace-nowrap",
                    isActive
                      ? "border-accent text-accent"
                      : "border-transparent text-ink/50 hover:text-ink hover:border-ink/20"
                  )}
                >
                  <tab.icon size={16} className={isActive ? "text-accent" : "text-ink/40"} />
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
