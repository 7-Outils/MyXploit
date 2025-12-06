"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  FileText,
  BarChart3,
  Receipt,
  Calculator,
  Calendar,
  Settings,
  LogOut,
  ChevronLeft,
  Wrench,
  ChevronDown,
  ClipboardCheck,
  User,
  Target,
  FileSpreadsheet,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useUserProfile, PROFILE_CONFIG, UserProfileType } from "@/contexts/UserProfileContext";

// All navigation items with profile visibility
const allNavigation = [
  {
    id: "dashboard",
    name: "Vue d'ensemble",
    href: "/overview",
    icon: LayoutDashboard,
    profiles: ["CLIENT", "AMO"] as UserProfileType[],
  },
  {
    id: "sites",
    name: "Sites & Patrimoine",
    href: "/sites",
    icon: Building2,
    profiles: ["CLIENT", "AMO", "EXPLOITANT"] as UserProfileType[],
  },
  {
    id: "equipments",
    name: "Équipements",
    href: "/equipments",
    icon: Wrench,
    profiles: ["EXPLOITANT", "AMO", "CLIENT"] as UserProfileType[],
  },
  {
    id: "contracts",
    name: "Contrats",
    href: "/contracts",
    icon: FileText,
    profiles: ["CLIENT", "AMO", "EXPLOITANT"] as UserProfileType[],
  },
  {
    id: "energy",
    name: "Suivi énergétique",
    href: "/energy",
    icon: BarChart3,
    profiles: ["CLIENT", "AMO", "EXPLOITANT"] as UserProfileType[],
  },
  {
    id: "invoices",
    name: "Facturation",
    href: "/invoices",
    icon: Receipt,
    profiles: ["CLIENT", "AMO"] as UserProfileType[],
  },
  {
    id: "quotes",
    name: "Devis & Chiffrage",
    href: "/quotes",
    icon: Calculator,
    profiles: ["CLIENT", "AMO", "EXPLOITANT"] as UserProfileType[],
  },
  {
    id: "meetings",
    name: "Réunions & Visites",
    href: "/meetings",
    icon: Calendar,
    profiles: ["AMO", "CLIENT", "EXPLOITANT"] as UserProfileType[],
  },
  {
    id: "dimensioning",
    name: "Dimensionnement",
    href: "/dimensioning",
    icon: Target,
    profiles: ["AMO"] as UserProfileType[],
  },
  {
    id: "pricing",
    name: "Chiffrage AO",
    href: "/pricing",
    icon: FileSpreadsheet,
    profiles: ["EXPLOITANT"] as UserProfileType[],
  },
];

const bottomNavigation = [
  {
    name: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
];

const PROFILE_ICONS = {
  EXPLOITANT: Wrench,
  CLIENT: Building2,
  AMO: ClipboardCheck,
};

const PROFILE_COLORS = {
  EXPLOITANT: "bg-orange-500",
  CLIENT: "bg-blue-500",
  AMO: "bg-purple-500",
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { profile, setProfile, isLoading } = useUserProfile();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowProfileMenu(false);
    if (showProfileMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showProfileMenu]);

  // Get navigation items sorted by profile priority
  const getNavigation = () => {
    if (!profile) return allNavigation;

    const config = PROFILE_CONFIG[profile];
    const priorityOrder = config.navPriority;

    // Filter items visible for this profile and sort by priority
    return [...allNavigation]
      .filter((item) => item.profiles.includes(profile))
      .sort((a, b) => {
        const aIndex = priorityOrder.indexOf(a.id);
        const bIndex = priorityOrder.indexOf(b.id);
        // Items not in priority list go to the end
        const aOrder = aIndex === -1 ? 999 : aIndex;
        const bOrder = bIndex === -1 ? 999 : bIndex;
        return aOrder - bOrder;
      });
  };

  const navigation = getNavigation();
  const ProfileIcon = profile ? PROFILE_ICONS[profile] : User;
  const profileColor = profile ? PROFILE_COLORS[profile] : "bg-gray-500";
  const profileLabel = profile ? PROFILE_CONFIG[profile].label : "Choisir profil";

  const handleProfileChange = async (newProfile: UserProfileType) => {
    await setProfile(newProfile);
    setShowProfileMenu(false);
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-primary-dark flex flex-col transition-all duration-300 z-40",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        {!collapsed && (
          <Logo
            size="sm"
            className="[&_span]:text-white [&_.text-accent]:text-accent-light"
          />
        )}
        {collapsed && (
          <div className="w-10 h-10 mx-auto">
            <Logo size="sm" showText={false} />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all",
            collapsed && "mx-auto rotate-180"
          )}
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Profile Selector */}
      {!isLoading && (
        <div className="px-3 py-3 border-b border-white/10">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowProfileMenu(!showProfileMenu);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                "bg-white/5 hover:bg-white/10 text-white"
              )}
            >
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", profileColor)}>
                <ProfileIcon size={16} className="text-white" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{profileLabel}</p>
                    {profile && (
                      <p className="text-xs text-gray-400">
                        {PROFILE_CONFIG[profile].description.split(" ")[0]}
                      </p>
                    )}
                  </div>
                  <ChevronDown
                    size={16}
                    className={cn(
                      "text-gray-400 transition-transform",
                      showProfileMenu && "rotate-180"
                    )}
                  />
                </>
              )}
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && !collapsed && (
              <div
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50"
                onClick={(e) => e.stopPropagation()}
              >
                {(Object.keys(PROFILE_CONFIG) as Array<keyof typeof PROFILE_CONFIG>).map(
                  (profileKey) => {
                    const config = PROFILE_CONFIG[profileKey];
                    const Icon = PROFILE_ICONS[profileKey];
                    const isSelected = profile === profileKey;

                    return (
                      <button
                        key={profileKey}
                        onClick={() => handleProfileChange(profileKey)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left",
                          isSelected
                            ? "bg-accent/10 text-accent"
                            : "hover:bg-gray-50 text-gray-700"
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            PROFILE_COLORS[profileKey]
                          )}
                        >
                          <Icon size={16} className="text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{config.label}</p>
                          <p className="text-xs text-gray-500">{config.description}</p>
                        </div>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-accent" />
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* Prompt to select profile if none */}
          {!profile && !collapsed && (
            <button
              onClick={() => router.push("/profile-select")}
              className="mt-2 w-full text-xs text-center text-accent hover:underline"
            >
              Configurer mon profil
            </button>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive
                  ? "bg-accent text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              <item.icon
                size={20}
                className={cn(
                  "flex-shrink-0",
                  isActive
                    ? "text-white"
                    : "text-gray-400 group-hover:text-white"
                )}
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom navigation */}
      <div className="py-4 px-3 border-t border-white/10 space-y-1">
        {bottomNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive
                  ? "bg-accent text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              <item.icon size={20} className="flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium">{item.name}</span>
              )}
            </Link>
          );
        })}

        {/* Logout */}
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 group"
        >
          <LogOut size={20} className="flex-shrink-0" />
          {!collapsed && (
            <span className="text-sm font-medium">Déconnexion</span>
          )}
        </button>
      </div>
    </aside>
  );
}
