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
      href: "/platform/organizations",
    },
    {
      label: "Utilisateurs",
      value: stats?.users || 0,
      icon: Users,
      href: "/platform/users",
    },
    {
      label: "Sites",
      value: stats?.sites || 0,
      icon: MapPin,
      href: null,
    },
    {
      label: "Contrats",
      value: stats?.contracts || 0,
      icon: FileText,
      href: null,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Dashboard Plateforme</h1>
        <p className="text-sm text-text-secondary mt-1">
          Vue globale de la plateforme MyXploit
        </p>
      </div>

      {/* Stats — bandeau de faits, hairlines, sans boîte colorée */}
      <div className="border border-ink/10 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-ink/10 lg:grid-cols-4 lg:divide-y-0">
          {statCards.map((card) => (
            <div
              key={card.label}
              onClick={() => card.href && router.push(card.href)}
              className={`px-4 py-3 ${
                card.href ? "cursor-pointer transition-colors hover:bg-ink/[0.02]" : ""
              }`}
            >
              <p className="label-tech flex items-center gap-2">
                <card.icon size={12} className="text-ink/30" />
                {card.label}
              </p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-ink">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => router.push("/platform/organizations")}
          className="group border border-ink/10 bg-white p-4 text-left transition-colors hover:border-accent/40"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink group-hover:text-accent">
                Gerer les organisations
              </p>
              <p className="text-sm text-text-secondary mt-1">
                Creer, modifier, configurer les modules
              </p>
            </div>
            <ArrowRight size={16} className="flex-shrink-0 text-ink/30 group-hover:text-accent" />
          </div>
        </button>
        <button
          onClick={() => router.push("/platform/users")}
          className="group border border-ink/10 bg-white p-4 text-left transition-colors hover:border-accent/40"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink group-hover:text-accent">
                Gerer les utilisateurs
              </p>
              <p className="text-sm text-text-secondary mt-1">
                Voir tous les utilisateurs de la plateforme
              </p>
            </div>
            <ArrowRight size={16} className="flex-shrink-0 text-ink/30 group-hover:text-accent" />
          </div>
        </button>
        <button
          onClick={() => router.push("/platform/organizations")}
          className="group border border-ink/10 bg-white p-4 text-left transition-colors hover:border-accent/40"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Ghost size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-ink group-hover:text-accent">Mode Fantome</p>
                <p className="text-sm text-text-secondary mt-1">
                  Consulter une organisation
                </p>
              </div>
            </div>
            <ArrowRight size={16} className="flex-shrink-0 text-ink/30 group-hover:text-accent" />
          </div>
        </button>
      </div>

      {/* Recent Organizations */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="label-tech">Organisations recentes</h2>
          <button
            onClick={() => router.push("/platform/organizations")}
            className="font-mono text-[11px] uppercase tracking-widest text-accent hover:underline"
          >
            Voir tout
          </button>
        </div>
        <div className="divide-y divide-ink/10">
          {recentOrgs.map((org) => (
            <div key={org.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <Building2 size={16} className="flex-shrink-0 text-ink/30" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{org.name}</p>
                  <p className="font-mono text-[11px] tabular-nums text-ink/40">
                    {org._count.users} utilisateurs · {org._count.sites} sites · {org._count.contracts} contrats
                  </p>
                </div>
              </div>
              <span className="font-mono text-[11px] tabular-nums text-ink/40">
                {new Date(org.createdAt).toLocaleDateString("fr-FR")}
              </span>
            </div>
          ))}
          {recentOrgs.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-text-secondary">
              Aucune organisation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
