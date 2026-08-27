"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  FileText,
  ArrowRight,
  Settings,
  Euro,
  Loader2,
  Users,
  UserCheck,
  Building2,
} from "lucide-react";

interface Stats {
  recommendations: number;
  checkpoints: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({ recommendations: 0, checkpoints: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [recoRes, checkpointRes] = await Promise.all([
          fetch("/api/admin/recommendation-library"),
          fetch("/api/admin/audit-checkpoints"),
        ]);

        const recommendations = recoRes.ok ? await recoRes.json() : [];
        const checkpoints = checkpointRes.ok ? await checkpointRes.json() : [];

        setStats({
          recommendations: recommendations.length,
          checkpoints: checkpoints.length,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const configSections = [
    {
      title: "Bibliothèque de préconisations",
      description: "Gérer les préconisations types avec leurs tarifs",
      icon: Euro,
      href: "/admin/recommendation-library",
      count: stats.recommendations,
      countLabel: "préconisations",
    },
    {
      title: "Points de contrôle",
      description: "Configurer les points de vérification pour les audits",
      icon: ClipboardCheck,
      href: "/admin/audit-checkpoints",
      count: stats.checkpoints,
      countLabel: "points de contrôle",
    },
    {
      title: "Aperçu rapport",
      description: "Prévisualiser le rendu du rapport d'audit",
      icon: FileText,
      href: "/admin/audit-preview",
      count: null,
      countLabel: null,
    },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Administration</h1>
          <p className="text-sm text-text-secondary mt-1">
            Configuration des audits techniques et paramètres avancés
          </p>
        </div>
      </div>

      {/* Info Banner */}
      {stats.recommendations === 0 && stats.checkpoints === 0 && (
        <div className="border border-accent/20 bg-accent/5 p-4">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="mt-0.5 flex-shrink-0 text-accent" size={16} />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-ink">Commencez par configurer vos audits</h3>
              <p className="text-sm text-text-secondary mt-1">
                1. Créez d&apos;abord vos préconisations types avec leurs tarifs<br />
                2. Ensuite, configurez vos points de contrôle en les liant aux préconisations
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Sections */}
      <div>
        <h2 className="label-tech mb-3">Configuration des audits</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group border border-ink/10 bg-white p-4 transition-colors hover:border-accent/40"
            >
              <div className="flex items-start gap-3">
                <section.icon size={18} className="mt-0.5 flex-shrink-0 text-ink/40 group-hover:text-accent" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-ink transition-colors group-hover:text-accent">
                    {section.title}
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">
                    {section.description}
                  </p>
                  {section.count !== null && (
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-widest tabular-nums text-accent">
                      {section.count} {section.countLabel}
                    </p>
                  )}
                </div>
                <ArrowRight
                  size={16}
                  className="flex-shrink-0 text-ink/30 transition-colors group-hover:text-accent"
                />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="label-tech mb-3">Actions rapides</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/users"
            className="group flex items-center gap-3 border border-ink/10 bg-white p-4 transition-colors hover:border-accent/40"
          >
            <Users size={18} className="flex-shrink-0 text-ink/40 group-hover:text-accent" />
            <span className="text-sm font-medium text-ink group-hover:text-accent">
              Gestion des utilisateurs
            </span>
          </Link>
          <Link
            href="/admin/portfolio"
            className="group flex items-center gap-3 border border-ink/10 bg-white p-4 transition-colors hover:border-accent/40"
          >
            <UserCheck size={18} className="flex-shrink-0 text-ink/40 group-hover:text-accent" />
            <span className="text-sm font-medium text-ink group-hover:text-accent">
              Portefeuilles ingénieurs
            </span>
          </Link>
          <Link
            href="/admin/organizations"
            className="group flex items-center gap-3 border border-ink/10 bg-white p-4 transition-colors hover:border-accent/40"
          >
            <Building2 size={18} className="flex-shrink-0 text-ink/40 group-hover:text-accent" />
            <span className="text-sm font-medium text-ink group-hover:text-accent">
              Gestion des organisations
            </span>
          </Link>
          <Link
            href="/settings"
            className="group flex items-center gap-3 border border-ink/10 bg-white p-4 transition-colors hover:border-accent/40"
          >
            <Settings size={18} className="flex-shrink-0 text-ink/40 group-hover:text-accent" />
            <span className="text-sm font-medium text-ink group-hover:text-accent">
              Paramètres généraux
            </span>
          </Link>
        </div>
      </div>

    </div>
  );
}
