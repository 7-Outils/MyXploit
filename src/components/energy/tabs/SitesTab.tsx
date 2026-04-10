"use client";

import { Building2, Flame, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import type { AnalyticsData, Consumption } from "@/components/energy/types";
import {
  ENERGY_TYPE_LABELS,
  USAGE_LABELS,
} from "@/components/energy/constants";

export function SitesContent({
  analytics,
  consumptions,
  setShowIdexImportModal,
  setShowCreateModal,
}: {
  analytics: AnalyticsData | null;
  consumptions: Consumption[];
  setShowIdexImportModal: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
}) {
  if (!analytics || analytics.sites.length === 0) {
    return (
      <>
        <div className="flex justify-end gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowIdexImportModal(true)}>
            <Flame size={18} className="mr-2" />
            Import Exploitant
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={18} className="mr-2" />
            Saisir relevé
          </Button>
        </div>
        <ChartCard title="">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-text-secondary">Aucune donnée de consommation par site</p>
          </div>
        </ChartCard>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setShowIdexImportModal(true)}>
          <Flame size={18} className="mr-2" />
          Import Exploitant
        </Button>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={18} className="mr-2" />
          Saisir relevé
        </Button>
      </div>

      {/* Recent consumptions */}
      {consumptions.length > 0 && (
        <ChartCard title="Derniers relevés">
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="w-full">
              <thead className="bg-background-secondary border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Site</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Énergie</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Usage</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Période</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Quantité</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">DJU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {consumptions.slice(0, 10).map((consumption) => (
                  <tr key={consumption.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-primary-dark">{consumption.site?.name || "-"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          consumption.energyType === "ELECTRICITE"
                            ? "bg-yellow-100 text-yellow-700"
                            : consumption.energyType === "GAZ"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {ENERGY_TYPE_LABELS[consumption.energyType] || consumption.energyType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
                        {USAGE_LABELS[consumption.usage] || consumption.usage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {new Date(consumption.period).toLocaleDateString("fr-FR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-primary-dark">
                      {consumption.quantity.toLocaleString()} {consumption.unit}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {consumption.djuReel ? `${consumption.djuReel} DJU` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </>
  );
}
