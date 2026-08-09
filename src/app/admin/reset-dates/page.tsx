"use client";

import { useState } from "react";

export default function ResetDatesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleReset = async () => {
    if (!confirm("Êtes-vous sûr de vouloir réinitialiser toutes les dates de chauffage ?")) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/heating-seasons/reset", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message || `${data.resetCount} saison(s) réinitialisée(s)`,
        });
      } else {
        setResult({
          success: false,
          message: data.error || "Erreur lors de la réinitialisation",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Erreur de connexion",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="border border-ink/10 bg-white">
        <div className="border-b border-ink/10 px-4 py-2.5">
          <span className="label-tech">Maintenance · Saisons de chauffage</span>
        </div>
        <div className="border-b border-ink/10 p-4">
          <h1 className="text-xl font-semibold text-ink">Réinitialiser les dates de chauffage</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cette action réinitialise les dates d'allumage et d'arrêt de toutes les saisons de chauffage.
            Les engagements (NB, APE) seront préservés.
          </p>
        </div>

        <div className="p-4 space-y-4">
          <div className="border border-amber-600/20 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              <strong>Attention :</strong> Cette action va :
            </p>
            <ul className="text-sm text-amber-800 list-disc list-inside mt-2 space-y-1">
              <li>Réinitialiser les dates d'allumage (startDate)</li>
              <li>Réinitialiser les dates d'arrêt (endDate)</li>
              <li>Réinitialiser les dates de dernier relevé (lastReleveDate)</li>
              <li>Conserver les engagements (NB, DJU contractuel)</li>
            </ul>
            <p className="text-sm text-amber-800 mt-3">
              Après cette action, vous devrez <strong>réimporter vos données IDEX</strong> pour redéfinir les dates correctement.
            </p>
          </div>

          <button
            onClick={handleReset}
            disabled={loading}
            className="w-full border border-red-600/30 px-6 py-2.5 text-sm font-medium text-red-700 transition-colors hover:border-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {loading ? "Réinitialisation en cours..." : "Réinitialiser les dates"}
          </button>

          {result && (
            <div className={`p-4 ${result.success ? "border border-accent/20 bg-accent/5" : "border border-red-600/20 bg-red-50"}`}>
              <p className={`text-sm ${result.success ? "text-ink" : "text-red-700"}`}>
                {result.message}
              </p>
            </div>
          )}

          {result?.success && (
            <div className="border border-green-600/20 bg-green-50 p-4">
              <p className="font-mono text-[11px] uppercase tracking-widest text-green-700">Étape suivante</p>
              <p className="text-sm text-green-800 mt-2">
                Allez dans <strong>Consommations → Importer</strong> et réimportez votre fichier Excel IDEX
                pour redéfinir les dates d'allumage selon les marqueurs MISE_EN_MARCHE.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
