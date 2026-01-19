"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";

interface User {
  id: string;
  role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "READER";
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/user/profile");
        if (!response.ok) {
          router.push("/");
          return;
        }

        const user: User = await response.json();

        if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
          router.push("/");
          return;
        }

        setAuthorized(true);
      } catch {
        router.push("/");
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <div className="bg-orange-50 border-b border-orange-200 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-orange-800">
          <Shield size={16} />
          <span className="font-medium">Panneau d&apos;administration</span>
        </div>
      </div>
      {children}
    </div>
  );
}
