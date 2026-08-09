"use client";

import { Settings } from "lucide-react";

export default function PlatformSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Configuration</h1>
        <p className="text-sm text-text-secondary mt-1">
          Configuration globale de la plateforme
        </p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="label-tech">Paramètres globaux</span>
        </div>
        <div className="flex flex-col items-center p-10 text-center">
          <Settings size={24} className="text-ink/30" />
          <h2 className="mt-4 text-sm font-medium text-ink">
            Bientot disponible
          </h2>
          <p className="mt-1 max-w-md text-sm text-text-secondary">
            La configuration de la plateforme (facturation, abonnements, parametres globaux) sera disponible prochainement.
          </p>
        </div>
      </div>
    </div>
  );
}
