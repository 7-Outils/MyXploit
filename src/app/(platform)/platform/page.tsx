"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  MapPin,
  FileText,
  Loader2,
  ArrowRight,
  Ghost,
} from "lucide-react";

interface Stats {
  organizations: number;
  users: number;
  sites: number;
  contracts: number;
}

interface RecentOrg {
  id: string;
  name: string;
  createdAt: string;
  _count: {
    users: number;
    sites: number;
    contracts: number;
  };
}

export default function PlatformDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrgs, setRecentOrgs] = useState<RecentOrg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/platform/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setRecentOrgs(data.recentOrganizations);
        }
      } catch (error) {
        console.error("Error fetching platform stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Organisations",
      value: stats?.organizations || 0,
      icon: Building2,
      color: "bg-blue-100 text-blue-600",
      href: "/platform/organizations",
    },
    {
      label: "Utilisateurs",
      value: stats?.users || 0,
      icon: Users,
      color: "bg-green-100 text-green-600",
      href: "/platform/users",
    },
    {
      label: "Sites",
      value: stats?.sites || 0,
      icon: MapPin,
      color: "bg-purple-100 text-purple-600",
      href: null,
    },
    {
      label: "Contrats",
      value: stats?.contracts || 0,
      icon: FileText,
      color: "bg-orange-100 text-orange-600",
      href: null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard Plateforme
        </h1>
        <p className="text-gray-600 mt-1">
          Vue globale de la plateforme MyXploit
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            onClick={() => card.href && router.push(card.href)}
            className={`bg-white rounded-xl border border-gray-100 p-5 ${
              card.href ? "cursor-pointer hover:shadow-md transition-shadow" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {card.value}
                </p>
              </div>
              <div
                className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center`}
              >
                <card.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => router.push("/platform/organizations")}
          className="bg-white rounded-xl border border-gray-100 p-5 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">
                Gerer les organisations
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Creer, modifier, configurer les modules
              </p>
            </div>
            <ArrowRight size={20} className="text-gray-400" />
          </div>
        </button>
        <button
          onClick={() => router.push("/platform/users")}
          className="bg-white rounded-xl border border-gray-100 p-5 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">
                Gerer les utilisateurs
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Voir tous les utilisateurs de la plateforme
              </p>
            </div>
            <ArrowRight size={20} className="text-gray-400" />
          </div>
        </button>
        <button
          onClick={() => router.push("/platform/organizations")}
          className="bg-white rounded-xl border border-gray-100 p-5 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Ghost size={20} className="text-purple-600" />
              <div>
                <p className="font-semibold text-gray-900">Mode Fantome</p>
                <p className="text-sm text-gray-500 mt-1">
                  Consulter une organisation
                </p>
              </div>
            </div>
            <ArrowRight size={20} className="text-gray-400" />
          </div>
        </button>
      </div>

      {/* Recent Organizations */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Organisations recentes
          </h2>
          <button
            onClick={() => router.push("/platform/organizations")}
            className="text-sm text-accent hover:underline"
          >
            Voir tout
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {recentOrgs.map((org) => (
            <div key={org.id} className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Building2 size={20} className="text-accent" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{org.name}</p>
                  <p className="text-sm text-gray-500">
                    {org._count.users} utilisateurs · {org._count.sites} sites · {org._count.contracts} contrats
                  </p>
                </div>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(org.createdAt).toLocaleDateString("fr-FR")}
              </span>
            </div>
          ))}
          {recentOrgs.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-500">
              Aucune organisation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
