"use client";

import { User, LogOut, ChevronDown } from "lucide-react";
import { clearSwrCache } from "@/components/SWRProvider";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface CurrentUser {
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export function PlatformTopbar() {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data?.user) {
          setCurrentUser(data.user);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

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
      return currentUser.firstName[0].toUpperCase();
    }
    if (currentUser?.email) {
      return currentUser.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <header className="h-16 bg-white border-b border-ink/10 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <h1 className="label-tech">Administration Plateforme</h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
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
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut size={16} />
                  Se deconnecter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
