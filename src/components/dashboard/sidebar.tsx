"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Euro,
  FileText,
  Wrench,
  Settings,
  ChevronLeft,
  Briefcase,
  Shield,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Module } from "@/generated/prisma/client";
import { usePermissions } from "@/contexts/PermissionContext";
import { OrganizationSwitcher } from "@/components/admin/OrganizationSwitcher";

// Navigation avec modules (toujours visible si module undefined)
const navigation: Array<{
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  module?: Module; // undefined = toujours visible (ex: Vue d'ensemble)
}> = [
  {
    name: "Vue d'ensemble",
    href: "/overview",
    icon: LayoutDashboard,
    // Pas de module = toujours visible
  },
  {
    name: "Suivi énergétique",
    href: "/energy",
    icon: BarChart3,
    module: "ENERGY",
  },
  {
    name: "Suivi financier",
    href: "/financier",
    icon: Euro,
    module: "FINANCIER",
  },
  {
    name: "Suivi administratif",
    href: "/administratif",
    icon: FileText,
    module: "ADMINISTRATIF",
  },
  {
    name: "Suivi exploitation",
    href: "/exploitation",
    icon: Wrench,
    module: "EXPLOITATION",
  },
  {
    name: "Boîte à outils",
    href: "/outils",
    icon: Briefcase,
    module: "OUTILS",
  },
];

const bottomNavigation = [
  {
    name: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { hasModule, userRole, isLoading } = usePermissions();

  // Check if current path matches navigation item (including sub-paths)
  const isActive = (href: string) => {
    if (href === "/overview") return pathname === href || pathname === "/";
    return pathname === href || pathname.startsWith(href + "?");
  };

  // Filtrer la navigation selon les modules activés
  const visibleNavigation = navigation.filter((item) => {
    // Si pas de module spécifié, toujours visible
    if (!item.module) return true;
    // Sinon vérifier si le module est activé
    return hasModule(item.module);
  });

  const isSuperAdmin = userRole === "SUPER_ADMIN";

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
          <Logo size="sm" variant="white" />
        )}
        {collapsed && (
          <div className="w-10 h-10 mx-auto">
            <Logo size="sm" showText={false} variant="white" />
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

      {/* Organization Switcher (SUPER_ADMIN only) */}
      {!collapsed && isSuperAdmin && (
        <div className="px-3 pt-4 pb-2">
          <OrganizationSwitcher />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {visibleNavigation.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                active
                  ? "bg-accent text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              <item.icon
                size={20}
                className={cn(
                  "flex-shrink-0",
                  active
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
        {/* Admin link - SUPER_ADMIN only */}
        {isSuperAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
              pathname.startsWith("/admin")
                ? "bg-orange-500 text-white"
                : "text-orange-400 hover:text-orange-300 hover:bg-orange-500/20"
            )}
          >
            <Shield size={20} className="flex-shrink-0" />
            {!collapsed && (
              <span className="text-sm font-medium">Administration</span>
            )}
          </Link>
        )}

        {bottomNavigation.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                active
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

      </div>
    </aside>
  );
}
