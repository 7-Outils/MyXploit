"use client";

import { Settings } from "lucide-react";

export default function PlatformSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuration</h1>
        <p className="text-gray-600 mt-1">
          Configuration globale de la plateforme
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Settings size={32} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Bientot disponible
        </h2>
        <p className="text-gray-500 max-w-md mx-auto">
          La configuration de la plateforme (facturation, abonnements, parametres globaux) sera disponible prochainement.
        </p>
      </div>
    </div>
  );
}
