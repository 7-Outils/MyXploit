"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  BarChart3,
  Euro,
  FileText,
  Wrench,
  ChevronLeft,
  Shield,
  Building2,
  Users,
  MapPin,
  FolderKanban,
  ClipboardList,
  Thermometer,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { Module } from "@/generated/prisma/client";
import { usePermissions } from "@/contexts/PermissionContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { OrganizationSwitcher } from "@/components/admin/OrganizationSwitcher";

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  module?: Module;
  adminOnly?: boolean; // Visible uniquement pour ADMIN
};

// Navigation ADMIN (Dirigeant) — pilotage missions
const adminNavigation: NavItem[] = [
  { name: "Vue d'ensemble", href: "/overview", icon: LayoutDashboard },
  { name: "Missions", href: "/missions", icon: FolderKanban, adminOnly: true },
  { name: "Clients", href: "/clients", icon: Building2, adminOnly: true },
  { name: "Rapports", href: "/rapports", icon: ClipboardList, adminOnly: true },
  { name: "Sites", href: "/buildings", icon: MapPin },
  { name: "Contrats exploitation", href: "/contrat", icon: FileText, module: "ADMINISTRATIF" },
];

// Navigation par defaut (Ingenieur, Lecteur)
const defaultNavigation: NavItem[] = [
  { name: "Tableau de bord", href: "/overview", icon: LayoutDashboard },
  { name: "Contrat", href: "/contrat", icon: FileText, module: "ADMINISTRATIF" },
  { name: "Énergie", href: "/energy", icon: BarChart3, module: "ENERGY" },
  { name: "Finances", href: "/financier", icon: Euro, module: "FINANCIER" },
  { name: "Exploitation", href: "/exploitation", icon: Wrench, module: "EXPLOITATION" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();
  const { hasModule, userRole, isLoading } = usePermissions();

  // Ferme le drawer mobile quand on change de page
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  // Sur mobile, force la sidebar en mode "expanded" (pas en mode icône)
  // — l'état `collapsed` ne s'applique qu'à partir de md.
  const showLabels = !collapsed || mobileOpen;

  const isActive = (href: string) => {
    if (href === "/overview") return pathname === href || pathname === "/";
    if (href === "/buildings") return pathname === href || pathname.startsWith("/buildings/");
    if (href === "/clients") return pathname === href || pathname.startsWith("/clients/");
    if (href === "/missions") return pathname === href || pathname.startsWith("/missions/");
    if (href === "/rapports") return pathname === href;
    if (href === "/team") return pathname === href;
    return pathname === href || pathname.startsWith(href + "?") || pathname.startsWith(href + "/");
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
    <>
      {/* Backdrop mobile */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-ink/50 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-white border-r border-ink/10 flex flex-col transition-transform duration-300 z-50 w-64",
          // Desktop: largeur dépend de collapsed
          collapsed ? "md:w-20" : "md:w-64",
          // Mobile: hors-écran sauf si mobileOpen
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: toujours visible
          "md:translate-x-0 md:transition-all"
        )}
      >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-ink/10">
        {showLabels && <Logo size="sm" />}
        {!showLabels && (
          <div className="w-10 h-10 mx-auto flex items-center justify-center">
            <Logo size="sm" showText={false} />
          </div>
        )}
        {/* Bouton fermer mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 text-ink/40 hover:text-accent hover:bg-ink/[0.03]"
          aria-label="Fermer le menu"
        >
          <X size={20} />
        </button>
        {/* Bouton collapse desktop */}
        <button
          onClick={toggle}
          className={cn(
            "hidden md:block p-1.5 text-ink/40 hover:text-accent hover:bg-ink/[0.03] transition-colors",
            collapsed && "mx-auto rotate-180"
          )}
          aria-label={collapsed ? "Déplier" : "Replier"}
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Organization Switcher (SUPER_ADMIN only) */}
      {showLabels && isSuperAdmin && (
        <div className="px-3 pt-4 pb-2">
          <OrganizationSwitcher />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {visibleNavigation.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 border-l-2 px-3 py-2 transition-colors duration-200 group",
                active
                  ? "border-accent bg-accent/5 text-accent"
                  : "border-transparent text-ink/60 hover:text-ink hover:bg-ink/[0.02]"
              )}
            >
              <item.icon
                size={18}
                className={cn(
                  "flex-shrink-0",
                  active
                    ? "text-accent"
                    : "text-ink/40 group-hover:text-ink/70"
                )}
              />
              {showLabels && (
                <span className="text-sm font-medium truncate">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom navigation */}
      <div className="py-3 px-2 border-t border-ink/10 space-y-0.5">
        {/* SUPER_ADMIN → Plateforme link */}
        {isSuperAdmin && (
          <Link
            href="/platform"
            className={cn(
              "flex items-center gap-3 border-l-2 border-transparent px-3 py-2 transition-colors duration-200 group",
              "text-amber-600 hover:bg-amber-600/5"
            )}
          >
            <Shield size={18} className="flex-shrink-0" />
            {showLabels && (
              <span className="text-sm font-medium">Plateforme</span>
            )}
          </Link>
        )}

        {/* ADMIN → Equipe */}
        {isAdmin && (
          <Link
            href="/team"
            className={cn(
              "flex items-center gap-3 border-l-2 px-3 py-2 transition-colors duration-200 group",
              isActive("/team")
                ? "border-accent bg-accent/5 text-accent"
                : "border-transparent text-ink/60 hover:text-ink hover:bg-ink/[0.02]"
            )}
          >
            <Users size={18} className="flex-shrink-0" />
            {showLabels && (
              <span className="text-sm font-medium">Equipe</span>
            )}
          </Link>
        )}


        {/* Calculateur DJU — icône seule (Paramètres est dans le menu user). */}
        <Link
          href="/outils/dju"
          title="Calculateur DJU"
          className={cn(
            "h-9 w-9 flex items-center justify-center transition-colors duration-200",
            isActive("/outils/dju")
              ? "bg-accent/5 text-accent"
              : "text-ink/40 hover:text-accent hover:bg-ink/[0.02]"
          )}
        >
          <Thermometer size={18} className="flex-shrink-0" />
        </Link>
      </div>
      </aside>
    </>
  );
}
