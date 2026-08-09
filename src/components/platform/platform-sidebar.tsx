"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  ChevronLeft,
  Shield,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { OrganizationSwitcher } from "@/components/admin/OrganizationSwitcher";
import { useSidebar } from "@/contexts/SidebarContext";

const navigation = [
  {
    name: "Dashboard",
    href: "/platform",
    icon: LayoutDashboard,
  },
  {
    name: "Organisations",
    href: "/platform/organizations",
    icon: Building2,
  },
  {
    name: "Utilisateurs",
    href: "/platform/users",
    icon: Users,
  },
  {
    name: "Configuration",
    href: "/platform/settings",
    icon: Settings,
  },
];

export function PlatformSidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  const isActive = (href: string) => {
    if (href === "/platform") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-white border-r border-ink/10 flex flex-col transition-all duration-300 z-40",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-ink/10">
        {!collapsed && <Logo size="sm" />}
        {collapsed && (
          <div className="w-10 h-10 mx-auto flex items-center justify-center">
            <Logo size="sm" showText={false} />
          </div>
        )}
        <button
          onClick={toggle}
          className={cn(
            "p-1.5 text-ink/40 hover:text-accent hover:bg-ink/[0.03] transition-colors",
            collapsed && "mx-auto rotate-180"
          )}
          aria-label={collapsed ? "Déplier" : "Replier"}
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Badge Plateforme Admin */}
      {!collapsed && (
        <div className="px-3 pt-4 pb-2">
          <div className="flex items-center gap-2 border border-amber-600/30 bg-amber-50 px-3 py-2">
            <Shield size={14} className="flex-shrink-0 text-amber-600" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-amber-700">
              Plateforme Admin
            </span>
          </div>
        </div>
      )}

      {/* Ghost Mode Switcher */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <OrganizationSwitcher />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
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
                  active ? "text-accent" : "text-ink/40 group-hover:text-ink/70"
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
    </aside>
  );
}
