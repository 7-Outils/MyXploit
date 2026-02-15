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
  Building2,
  Users,
  MapPin,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Module } from "@/generated/prisma/client";
import { usePermissions } from "@/contexts/PermissionContext";
import { OrganizationSwitcher } from "@/components/admin/OrganizationSwitcher";

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  module?: Module;
  adminOnly?: boolean; // Visible uniquement pour ADMIN
};

// Navigation ADMIN (Dirigeant) — inclut Clients et Equipe
const adminNavigation: NavItem[] = [
  { name: "Vue d'ensemble", href: "/overview", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Building2, adminOnly: true },
  { name: "Contrats", href: "/administratif", icon: FileText, module: "ADMINISTRATIF" },
  { name: "Sites", href: "/buildings", icon: MapPin },
  { name: "Suivi energetique", href: "/energy", icon: BarChart3, module: "ENERGY" },
  { name: "Suivi financier", href: "/financier", icon: Euro, module: "FINANCIER" },
  { name: "Suivi exploitation", href: "/exploitation", icon: Wrench, module: "EXPLOITATION" },
  { name: "Boite a outils", href: "/outils", icon: Briefcase, module: "OUTILS" },
];

// Navigation par defaut (Ingenieur, Lecteur)
const defaultNavigation: NavItem[] = [
  { name: "Vue d'ensemble", href: "/overview", icon: LayoutDashboard },
  { name: "Batiments", href: "/buildings", icon: Building2 },
  { name: "Suivi energetique", href: "/energy", icon: BarChart3, module: "ENERGY" },
  { name: "Suivi financier", href: "/financier", icon: Euro, module: "FINANCIER" },
  { name: "Suivi administratif", href: "/administratif", icon: FileText, module: "ADMINISTRATIF" },
  { name: "Suivi exploitation", href: "/exploitation", icon: Wrench, module: "EXPLOITATION" },
  { name: "Boite a outils", href: "/outils", icon: Briefcase, module: "OUTILS" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { hasModule, userRole, isLoading } = usePermissions();

  const isActive = (href: string) => {
    if (href === "/overview") return pathname === href || pathname === "/";
    if (href === "/buildings") return pathname === href || pathname.startsWith("/buildings/");
    if (href === "/clients") return pathname === href || pathname.startsWith("/clients/");
    if (href === "/team") return pathname === href;
    return pathname === href || pathname.startsWith(href + "?");
  };

  const isAdmin = userRole === "ADMIN";
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  // Choisir la navigation selon le role
  const baseNavigation = isAdmin || isSuperAdmin ? adminNavigation : defaultNavigation;

  // Filtrer selon les modules actives
  const visibleNavigation = isLoading
    ? baseNavigation
    : baseNavigation.filter((item) => {
        if (item.adminOnly && !isAdmin && !isSuperAdmin) return false;
        if (!item.module) return true;
        return hasModule(item.module);
      });

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-primary-dark flex flex-col transition-all duration-300 z-40",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        {!collapsed && <Logo size="sm" variant="white" />}
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
        {/* SUPER_ADMIN → Plateforme link */}
        {isSuperAdmin && (
          <Link
            href="/platform"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
              "text-orange-400 hover:text-orange-300 hover:bg-orange-500/20"
            )}
          >
            <Shield size={20} className="flex-shrink-0" />
            {!collapsed && (
              <span className="text-sm font-medium">Plateforme</span>
            )}
          </Link>
        )}

        {/* ADMIN → Equipe */}
        {isAdmin && (
          <Link
            href="/team"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
              isActive("/team")
                ? "bg-accent text-white"
                : "text-gray-400 hover:text-white hover:bg-white/10"
            )}
          >
            <Users size={20} className="flex-shrink-0" />
            {!collapsed && (
              <span className="text-sm font-medium">Equipe</span>
            )}
          </Link>
        )}


        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
            pathname === "/settings"
              ? "bg-accent text-white"
              : "text-gray-400 hover:text-white hover:bg-white/10"
          )}
        >
          <Settings size={20} className="flex-shrink-0" />
          {!collapsed && (
            <span className="text-sm font-medium">Parametres</span>
          )}
        </Link>
      </div>
    </aside>
  );
}
