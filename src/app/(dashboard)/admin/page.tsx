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
  Trash2,
  AlertTriangle,
  Users,
  Building2,
} from "lucide-react";

interface Stats {
  recommendations: number;
  checkpoints: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({ recommendations: 0, checkpoints: 0 });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAllEquipments = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer TOUS les équipements ? Cette action est irréversible.")) {
      return;
    }
    if (!confirm("DERNIÈRE CONFIRMATION : Tous les équipements et leurs données seront supprimés définitivement.")) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch("/api/admin/delete-all-equipments", {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.ok) {
        alert(`${data.deleted} équipement(s) supprimé(s)`);
        window.location.reload();
      } else {
        alert(data.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">
            Administration
          </h1>
          <p className="text-gray-600 mt-1">
            Configuration des audits techniques et paramètres avancés
          </p>
        </div>
      </div>

      {/* Info Banner */}
      {stats.recommendations === 0 && stats.checkpoints === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="text-blue-600 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-medium text-blue-900">Commencez par configurer vos audits</h3>
              <p className="text-sm text-blue-800 mt-1">
                1. Créez d&apos;abord vos préconisations types avec leurs tarifs<br />
                2. Ensuite, configurez vos points de contrôle en les liant aux préconisations
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Sections */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Configuration des audits
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent/10">
                  <section.icon size={24} className="text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-accent transition-colors">
                    {section.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {section.description}
                  </p>
                  {section.count !== null && (
                    <p className="text-sm font-medium mt-2 text-accent">
                      {section.count} {section.countLabel}
                    </p>
                  )}
                </div>
                <ArrowRight
                  size={20}
                  className="text-gray-400 group-hover:text-accent transition-colors"
                />
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
            href="/admin/users"
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow group"
          >
            <Users size={20} className="text-gray-400 group-hover:text-accent" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-accent">
              Gestion des utilisateurs
            </span>
          </Link>
          <Link
            href="/admin/organizations"
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow group"
          >
            <Building2 size={20} className="text-gray-400 group-hover:text-accent" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-accent">
              Gestion des organisations
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

      {/* Danger Zone */}
      <div className="border border-red-200 rounded-xl bg-red-50/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-red-600" />
          <h2 className="text-lg font-semibold text-red-900">
            Zone dangereuse
          </h2>
        </div>
        <p className="text-sm text-red-700 mb-4">
          Ces actions sont irréversibles. Utilisez-les avec précaution.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDeleteAllEquipments}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            Supprimer tous les équipements
          </button>
        </div>
      </div>
    </div>
  );
}
