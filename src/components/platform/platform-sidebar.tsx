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
import { useState } from "react";
import { OrganizationSwitcher } from "@/components/admin/OrganizationSwitcher";

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
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/platform") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
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

      {/* Badge Plateforme Admin */}
      {!collapsed && (
        <div className="px-3 pt-4 pb-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 rounded-lg">
            <Shield size={16} className="text-orange-400" />
            <span className="text-xs font-semibold text-orange-300 uppercase tracking-wider">
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
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
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
    </aside>
  );
}
