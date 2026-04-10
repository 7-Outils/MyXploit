"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ChevronDown } from "lucide-react";

interface CurrentUser {
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export function UserMenu() {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => { if (data?.user) setCurrentUser(data.user); })
      .catch(() => {});
  }, []);

  function getInitials() {
    if (!currentUser) return "?";
    const first = currentUser.firstName?.[0] ?? "";
    const last = currentUser.lastName?.[0] ?? "";
    return (first + last).toUpperCase() || currentUser.email[0].toUpperCase();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
      >
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {getInitials()}
        </div>
        <ChevronDown size={14} className="text-white/70" />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-11 w-60 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-medium text-gray-900 text-sm">
              {currentUser?.firstName} {currentUser?.lastName}
            </p>
            <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
          </div>
          <div className="py-1">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <LogOut size={15} />
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
