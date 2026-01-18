"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  FileText,
  Tags,
  ArrowRight,
  Database,
  Settings,
  Eye,
} from "lucide-react";

interface MigrationStatus {
  migrated: boolean;
  counts: {
    templates: number;
    categories: number;
    items: number;
  };
}

export default function AdminPage() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch("/api/admin/migration");
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (error) {
        console.error("Error fetching migration status:", error);
      }
    }
    fetchStatus();
  }, []);

  const configSections = [
    {
      title: "Templates de checklist",
      description: "Gérer les listes de contrôle par type d'équipement",
      icon: ClipboardList,
      href: "/admin/audit-config/templates",
      count: status?.counts.templates || 0,
      countLabel: "templates",
      disabled: !status?.migrated,
    },
    {
      title: "Recommandations",
      description: "Configurer les actions correctives par défaut",
      icon: FileText,
      href: "/admin/audit-config/recommendations",
      count: 0,
      countLabel: "recommandations",
      disabled: !status?.migrated,
    },
    {
      title: "Catégories",
      description: "Organiser les items par catégorie technique",
      icon: Tags,
      href: "/admin/audit-config/categories",
      count: status?.counts.categories || 0,
      countLabel: "catégories",
      disabled: !status?.migrated,
    },
    {
      title: "Aperçu rapport",
      description: "Prévisualiser le rendu du rapport PDF",
      icon: Eye,
      href: "/admin/audit-config/preview",
      count: null,
      countLabel: null,
      disabled: !status?.migrated,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Administration
          </h1>
          <p className="text-gray-600 mt-1">
            Configuration des audits techniques et paramètres avancés
          </p>
        </div>
      </div>

      {/* Migration Banner */}
      {status && !status.migrated && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Database className="text-amber-600 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-medium text-amber-900">Migration requise</h3>
              <p className="text-sm text-amber-800 mt-1">
                Les checklists d&apos;audit doivent être migrées vers la base de données
                pour pouvoir être personnalisées.
              </p>
              <Link
                href="/admin/migration"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
              >
                <Database size={16} />
                Lancer la migration
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Sections */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Configuration des audits
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {configSections.map((section) => (
            <Link
              key={section.href}
              href={section.disabled ? "#" : section.href}
              className={`bg-white rounded-xl border border-gray-100 p-6 transition-shadow group ${
                section.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:shadow-md"
              }`}
              onClick={(e) => section.disabled && e.preventDefault()}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  section.disabled ? "bg-gray-100" : "bg-accent/10"
                }`}>
                  <section.icon
                    size={24}
                    className={section.disabled ? "text-gray-400" : "text-accent"}
                  />
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold transition-colors ${
                    section.disabled
                      ? "text-gray-400"
                      : "text-gray-900 group-hover:text-accent"
                  }`}>
                    {section.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {section.description}
                  </p>
                  {section.count !== null && (
                    <p className={`text-sm font-medium mt-2 ${
                      section.disabled ? "text-gray-400" : "text-accent"
                    }`}>
                      {section.count} {section.countLabel}
                    </p>
                  )}
                </div>
                {!section.disabled && (
                  <ArrowRight
                    size={20}
                    className="text-gray-400 group-hover:text-accent transition-colors"
                  />
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Actions rapides
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            href="/admin/migration"
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow group"
          >
            <Database size={20} className="text-gray-400 group-hover:text-accent" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-accent">
              Migration des données
            </span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow group"
          >
            <Settings size={20} className="text-gray-400 group-hover:text-accent" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-accent">
              Paramètres généraux
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
