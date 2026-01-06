"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Réinitialiser les dates de chauffage</CardTitle>
          <CardDescription>
            Cette action réinitialise les dates d'allumage et d'arrêt de toutes les saisons de chauffage.
            Les engagements (NB, APE) seront préservés.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
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

          <Button
            onClick={handleReset}
            disabled={loading}
            variant="destructive"
            size="lg"
            className="w-full"
          >
            {loading ? "Réinitialisation en cours..." : "Réinitialiser les dates"}
          </Button>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          )}

          {result?.success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium">✅ Étape suivante :</p>
              <p className="text-sm text-green-800 mt-2">
                Allez dans <strong>Consommations → Importer</strong> et réimportez votre fichier Excel IDEX
                pour redéfinir les dates d'allumage selon les marqueurs MISE_EN_MARCHE.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
