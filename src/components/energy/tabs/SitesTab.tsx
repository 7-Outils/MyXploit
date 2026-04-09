"use client";

import Link from "next/link";
import { Building2, ExternalLink, Flame, Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import type { AnalyticsData, Site, Consumption } from "@/components/energy/types";
import {
  SITE_TYPE_LABELS,
  ENERGY_TYPE_LABELS,
  USAGE_LABELS,
} from "@/components/energy/constants";

export function SitesContent({
  analytics,
  consumptions,
  sites,
  setShowIdexImportModal,
  setShowCreateModal,
  hasContract,
}: {
  analytics: AnalyticsData | null;
  consumptions: Consumption[];
  sites: Site[];
  setShowIdexImportModal: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
  hasContract: boolean;
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

      <ChartCard title="Performance par site">
        <div className="overflow-x-auto -mx-6 -my-6">
          <table className="w-full">
            <thead className="bg-background-secondary border-b border-gray-100">
              <tr>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Site</th>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Type</th>
                <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">NC (MWh)</th>
                <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">N&apos;B (MWh)</th>
                <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Écart</th>
                <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analytics.sites.map((site) => (
                <tr key={site.siteId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-primary-dark">{site.siteName}</p>
                      <p className="text-xs text-gray-500">{site.city}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                      {SITE_TYPE_LABELS[site.siteType] || site.siteType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium">{(site.nc / 1000).toFixed(1)}</td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>{(site.nbPrime / 1000).toFixed(1)}</span>
                      {site._debug && !site._debug.calculationApplied && (
                        <span className="group relative">
                          <Info size={14} className="text-amber-500 cursor-help" />
                          <span className="absolute right-0 bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                            N&apos;B non ajusté : DJR={site._debug.djrTotal}, DJUC={site._debug.usedDjuc || 0}
                          </span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-right font-medium ${site.deltaPercent <= 0 ? "text-green-600" : "text-red-600"}`}>
                    {site.deltaPercent > 0 ? "+" : ""}{site.deltaPercent}%
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        site.status === "ECONOMIE"
                          ? "bg-green-100 text-green-700"
                          : site.status === "DEPASSEMENT"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {site.status === "ECONOMIE" ? "Économie" : site.status === "DEPASSEMENT" ? "Dépassement" : "Objectif"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Link
                      href={`/energy/sites/${site.siteId}`}
                      className="inline-flex items-center gap-1 text-accent hover:underline text-sm"
                    >
                      Détail
                      <ExternalLink size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

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
