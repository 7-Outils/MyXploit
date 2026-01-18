"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Loader2, Database, ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MigrationStatus {
  migrated: boolean;
  counts: {
    templates: number;
    categories: number;
    items: number;
  };
  hardcodedCounts: {
    templates: number;
    categories: number;
    items: number;
  };
}

interface MigrationResult {
  success: boolean;
  message: string;
  results?: {
    categories: number;
    templates: number;
    items: number;
  };
}

export default function MigrationPage() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch("/api/admin/migration");
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (error) {
        console.error("Error checking status:", error);
      } finally {
        setChecking(false);
      }
    }
    checkStatus();
  }, []);

  const handleMigration = async () => {
    if (
      !confirm(
        "Êtes-vous sûr de vouloir migrer les checklists vers la base de données ?\n\nCette action va créer les templates et items dans votre organisation."
      )
    ) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/migration", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          results: data.results,
        });
        // Refresh status
        const statusResponse = await fetch("/api/admin/migration");
        if (statusResponse.ok) {
          setStatus(await statusResponse.json());
        }
      } else {
        setResult({
          success: false,
          message: data.error,
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Erreur de connexion au serveur",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-accent"
        >
          <ArrowLeft size={16} />
          Retour à l&apos;administration
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <Database size={24} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Migration des checklists
              </h1>
              <p className="text-sm text-gray-600">
                Importer les checklists prédéfinies vers la base de données
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status actuel */}
          {status && (
            <div
              className={`rounded-lg p-4 ${
                status.migrated
                  ? "bg-green-50 border border-green-200"
                  : "bg-gray-50 border border-gray-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {status.migrated ? (
                  <Check className="text-green-600 mt-0.5" size={20} />
                ) : (
                  <Info className="text-gray-500 mt-0.5" size={20} />
                )}
                <div>
                  <p
                    className={`font-medium ${
                      status.migrated ? "text-green-800" : "text-gray-700"
                    }`}
                  >
                    {status.migrated
                      ? "Migration effectuée"
                      : "Migration non effectuée"}
                  </p>
                  {status.migrated ? (
                    <ul className="text-sm text-green-700 mt-2 space-y-1">
                      <li>{status.counts.categories} catégories</li>
                      <li>{status.counts.templates} templates</li>
                      <li>{status.counts.items} items de checklist</li>
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-600 mt-1">
                      {status.hardcodedCounts.templates} templates et{" "}
                      {status.hardcodedCounts.items} items prêts à être importés
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info box */}
          {!status?.migrated && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Cette action va :</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Créer les catégories de checklist dans la base de données</li>
                    <li>Importer tous les templates de checklists existants</li>
                    <li>Générer les textes de rapport par défaut (modifiables ensuite)</li>
                    <li>Permettre la personnalisation complète via le panel admin</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Bouton de migration */}
          {!status?.migrated && (
            <Button
              onClick={handleMigration}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Migration en cours...
                </>
              ) : (
                <>
                  <Database size={18} className="mr-2" />
                  Lancer la migration
                </>
              )}
            </Button>
          )}

          {/* Résultat */}
          {result && (
            <div
              className={`rounded-lg p-4 ${
                result.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <Check className="text-green-600" size={20} />
                ) : (
                  <AlertTriangle className="text-red-600" size={20} />
                )}
                <div>
                  <p
                    className={`font-medium ${
                      result.success ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    {result.message}
                  </p>
                  {result.results && (
                    <ul className="text-sm text-green-700 mt-2 space-y-1">
                      <li>{result.results.categories} catégories créées</li>
                      <li>{result.results.templates} templates créés</li>
                      <li>{result.results.items} items de checklist créés</li>
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions après migration */}
          {status?.migrated && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Vous pouvez maintenant personnaliser les checklists :
              </p>
              <div className="flex gap-3">
                <Link
                  href="/admin/audit-config/templates"
                  className="flex-1 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors text-center"
                >
                  Gérer les templates
                </Link>
                <Link
                  href="/admin"
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors text-center"
                >
                  Retour admin
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
