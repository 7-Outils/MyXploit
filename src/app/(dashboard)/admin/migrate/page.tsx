"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, Play, CheckCircle, XCircle, Sliders, ArrowRight } from "lucide-react";

export default function MigratePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult] = useState<any>(null);

  const handleSeedDemo = async () => {
    if (!confirm("Créer le contrat de démo [DEMO] Calibration avec 5 sites et 5 saisons d'historique synthétique ?")) {
      return;
    }
    setSeedLoading(true);
    setSeedResult(null);
    try {
      const res = await fetch("/api/admin/seed-calibration-demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setSeedResult(data);
    } catch (e: any) {
      setSeedResult({ success: false, error: e.message });
    } finally {
      setSeedLoading(false);
    }
  };

  const handleMigration = async () => {
    if (!confirm("Êtes-vous sûr de vouloir migrer les devis existants vers WorkOrders ?")) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/migrate-workorders", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la migration");
      }

      setResult(data);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Migration WorkOrders
        </h1>
        <p className="text-gray-600 mb-6">
          Créer des WorkOrders pour tous les devis P3/P5 déjà acceptés
        </p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-900 mb-2">
            ⚠️ Attention
          </h3>
          <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
            <li>Cette opération va créer des WorkOrders pour tous les devis P3/P5 acceptés qui n'en ont pas encore</li>
            <li>Les WorkOrders seront créés avec le statut <strong>CLOTURE</strong> (car déjà anciens)</li>
            <li>Cette opération est <strong>irréversible</strong></li>
            <li>Réservé aux <strong>SUPER_ADMIN</strong> uniquement</li>
          </ul>
        </div>

        <Button
          onClick={handleMigration}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="mr-2 animate-spin" />
              Migration en cours...
            </>
          ) : (
            <>
              <Play size={18} className="mr-2" />
              Lancer la migration
            </>
          )}
        </Button>

        {result && (
          <div className="mt-6">
            {result.success ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <h3 className="font-semibold text-green-900">
                    Migration réussie
                  </h3>
                </div>
                <div className="text-sm text-green-800 space-y-1">
                  <p><strong>Message:</strong> {result.message}</p>
                  <p><strong>Total:</strong> {result.total} devis</p>
                  <p><strong>Migrés:</strong> {result.migrated} WorkOrders créés</p>
                  {result.errors > 0 && (
                    <p className="text-red-600">
                      <strong>Erreurs:</strong> {result.errors}
                    </p>
                  )}
                </div>

                {result.errorDetails && result.errorDetails.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">
                      Détails des erreurs:
                    </h4>
                    <ul className="text-xs text-green-800 space-y-1">
                      {result.errorDetails.map((err: any, idx: number) => (
                        <li key={idx}>
                          {err.reference}: {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={20} className="text-red-600" />
                  <h3 className="font-semibold text-red-900">
                    Erreur de migration
                  </h3>
                </div>
                <p className="text-sm text-red-800">{result.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Seed démo calibration ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Sliders size={18} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Démo Calibration des cibles</h2>
            <p className="text-sm text-gray-600">
              Crée un contrat fictif <code className="bg-gray-100 px-1.5 rounded text-xs">[DEMO] Calibration</code> avec 5 sites
              incarnant chacun un scénario : cible lâche, serrée, bien calibrée, tendance baissière, signature instable.
              5 saisons d&apos;historique synthétique (2020-21 à 2024-25).
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-xs text-blue-900">
          Idempotent — ré-exécutable sans doublon. Les données sont créées dans votre organisation courante et visibles
          via le sélecteur de contrat. Pour supprimer : supprimer manuellement le contrat <code>DEMO-CAL-2020</code> (cascade cleanup).
        </div>

        <Button onClick={handleSeedDemo} disabled={seedLoading} variant="outline" className="w-full sm:w-auto">
          {seedLoading ? (
            <><Loader2 size={16} className="mr-2 animate-spin" /> Création en cours…</>
          ) : (
            <><Play size={16} className="mr-2" /> Générer la démo</>
          )}
        </Button>

        {seedResult && (
          <div className="mt-5">
            {seedResult.success ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={18} className="text-green-600" />
                  <h3 className="font-semibold text-green-900 text-sm">Seed terminé</h3>
                </div>
                <div className="text-xs text-green-800 space-y-1 mb-3">
                  <p><strong>Contrat :</strong> {seedResult.contractRef}</p>
                  <p><strong>Sites créés :</strong> {seedResult.sitesCreated} (ou déjà existants)</p>
                  <p><strong>Consommations :</strong> {seedResult.consoRows} lignes</p>
                </div>
                <Link
                  href={seedResult.redirectTo}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-green-900 hover:text-green-700"
                >
                  Ouvrir la page de calibration <ArrowRight size={14} />
                </Link>
                {seedResult.logs && (
                  <details className="mt-3 pt-3 border-t border-green-200">
                    <summary className="text-xs text-green-800 cursor-pointer font-semibold">Logs détaillés</summary>
                    <pre className="text-[10px] text-green-800 mt-2 font-mono whitespace-pre-wrap">
                      {seedResult.logs.join("\n")}
                    </pre>
                  </details>
                )}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={18} className="text-red-600" />
                  <h3 className="font-semibold text-red-900 text-sm">Erreur</h3>
                </div>
                <p className="text-sm text-red-800">{seedResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
