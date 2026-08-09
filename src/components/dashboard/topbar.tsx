"use client";

import { Bell, LogOut, ChevronDown, Menu, Settings } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContractSelector } from "./ContractSelector";
import { useSidebar } from "@/contexts/SidebarContext";
import { clearSwrCache } from "@/components/SWRProvider";

interface CurrentUser {
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export function Topbar() {
  const router = useRouter();
  const { setMobileOpen } = useSidebar();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        // /api/auth/me renvoie l'objet user à plat (pas { user: ... })
        const data = await res.json();
        if (data?.id || data?.email) setCurrentUser(data);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  // Ferme les menus déroulants au clic en dehors
  useEffect(() => {
    if (!showNotifications && !showUserMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(t)) setShowNotifications(false);
      if (userRef.current && !userRef.current.contains(t)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [showNotifications, showUserMenu]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      clearSwrCache();
      router.push("/sign-in");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getInitials = () => {
    if (currentUser?.firstName && currentUser?.lastName) {
      return `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase();
    }
    if (currentUser?.firstName) {
      return currentUser.firstName.slice(0, 2).toUpperCase();
    }
    if (currentUser?.email) {
      // Déduit 2 initiales du début de l'e-mail (ex. settouti.hamza → SH)
      const local = currentUser.email.split("@")[0];
      const parts = local.split(/[._-]+/).filter(Boolean);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return local.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const notifications = [
    {
      id: 1,
      title: "Alerte consommation",
      message: "Dérive détectée sur Lycée Voltaire",
      time: "Il y a 5 min",
      unread: true,
    },
    {
      id: 2,
      title: "Facture validée",
      message: "Facture P2 - Décembre 2024",
      time: "Il y a 2h",
      unread: true,
    },
    {
      id: 3,
      title: "Réunion planifiée",
      message: "Réunion exploitation - 15/12",
      time: "Hier",
      unread: false,
    },
  ];

  return (
    <header className="h-16 bg-white border-b border-ink/10 flex items-center justify-between px-4 md:px-6 gap-2">
      {/* Mobile burger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden p-2 -ml-2 text-ink/60 hover:text-accent hover:bg-ink/[0.03]"
        aria-label="Ouvrir le menu"
      >
        <Menu size={22} />
      </button>

      {/* Contract Selector */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <ContractSelector />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications((v) => !v)}
            className="relative h-9 w-9 flex items-center justify-center text-ink/50 hover:text-accent hover:bg-ink/[0.03] transition-colors"
            title="Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-600 rounded-full" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-white shadow-large border border-ink/15 z-50">
              <div className="border-b border-ink/10 px-4 py-2.5">
                <h3 className="label-tech">Notifications</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-4 py-2.5 hover:bg-ink/[0.02] cursor-pointer border-l-2 ${
                      notif.unread
                        ? "border-accent bg-accent/5"
                        : "border-transparent"
                    }`}
                  >
                    <p className="text-sm font-medium text-ink">
                      {notif.title}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {notif.message}
                    </p>
                    <p className="font-mono text-[11px] text-ink/40 mt-1">{notif.time}</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-ink/10">
                <button className="text-sm text-accent hover:underline">
                  Voir toutes les notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex items-center gap-2 p-1.5 hover:bg-ink/[0.03] transition-colors"
          >
            {/* Avatar : seul cas où rounded-full reste (cf. thème) */}
            <div className="w-8 h-8 bg-ink rounded-full flex items-center justify-center text-paper text-xs font-medium">
              {getInitials()}
            </div>
            <ChevronDown size={14} className="text-ink/40" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-12 w-64 bg-white shadow-large border border-ink/15 py-1 z-50">
              <div className="px-4 py-3 border-b border-ink/10">
                <p className="font-medium text-ink">
                  {currentUser?.firstName} {currentUser?.lastName}
                </p>
                <p className="text-sm text-text-secondary truncate">
                  {currentUser?.email}
                </p>
              </div>
              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full px-4 py-2 text-left text-sm text-ink hover:bg-ink/[0.02] flex items-center gap-2"
                >
                  <Settings size={16} className="text-ink/40" />
                  Paramètres
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut size={16} />
                  Se déconnecter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
