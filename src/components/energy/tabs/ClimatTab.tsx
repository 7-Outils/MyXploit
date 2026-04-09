"use client";

import { useState } from "react";
import {
  Calendar,
  CloudSnow,
  Loader2,
  RefreshCw,
  Snowflake,
  Sun,
  Thermometer,
  ThermometerSun,
} from "lucide-react";
import { ReadOnlyGate } from "@/components/permissions";
import { ChartCard } from "@/components/dashboard/chart-card";
import { useUserProfile } from "@/contexts/UserProfileContext";
import type {
  AnalyticsData,
  DJUData,
  HeatingSeason,
} from "@/components/energy/types";

export function ClimatContent({
  djuData,
  analytics,
  selectedYear,
  heatingSeasons,
  openHeatingSeasonModal,
  contractId,
  onDjuSync,
}: {
  djuData: DJUData | null;
  analytics: AnalyticsData | null;
  selectedYear: number;
  heatingSeasons: HeatingSeason[];
  openHeatingSeasonModal: (siteId: string, siteName: string, startDate?: string, endDate?: string) => void;
  contractId: string | null;
  onDjuSync: () => void;
}) {
  const { profile } = useUserProfile();
  // CLIENT must never see the manual sync plumbing — DJU is refreshed every
  // night by the /api/cron/dju-sync Vercel Cron (vercel.json).
  const showSyncButton = profile !== "CLIENT";
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ updated: number; total: number; errors?: string[] } | null>(null);

  // Filter DJU data to only show months with consumption
  const monthsWithConsumption = new Set(
    analytics?.monthlyData.filter(m => m.nc > 0).map(m => m.month) || []
  );

  // Filter monthly DJU data
  const filteredMonthlyData = djuData?.monthlyData.filter(m =>
    monthsWithConsumption.has(m.month)
  ) || [];

  // Calculate filtered DJU total
  const filteredDjuTotal = filteredMonthlyData.reduce((sum, m) => sum + m.dju, 0);

  // Build consumption by site for site-level filtering
  const consumptionBySite = new Map<string, Set<string>>();
  analytics?.sites.forEach(site => {
    const monthsWithData = new Set(
      site.monthlyData.filter(m => m.nc > 0).map(m => m.month)
    );
    consumptionBySite.set(site.siteId, monthsWithData);
  });

  const handleSyncDju = async () => {
    if (!contractId) {
      setSyncResult({ updated: 0, total: 0, errors: ["Veuillez sélectionner un contrat"] });
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/dju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, overwrite: true }),
      });
      const data = await res.json();
      setSyncResult({
        updated: data.updated || 0,
        total: data.total || 0,
        errors: data.errors || (data.error ? [data.error] : undefined)
      });
      if (data.updated > 0) {
        onDjuSync(); // Refresh analytics data
      }
    } catch {
      setSyncResult({ updated: 0, total: 0, errors: ["Erreur de connexion"] });
    } finally {
      setSyncing(false);
    }
  };

  if (!djuData) {
    return (
      <ChartCard title="">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Thermometer className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-text-secondary">Aucune donnée météo disponible</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <>
      {/* Sync DJU header — manual button only for AMO/EXPLOITANT */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-primary-dark">DJU réels</h3>
          <p className="text-sm text-text-secondary">
            {showSyncButton
              ? "Récupère les DJU réels depuis la station météo et les applique aux consommations"
              : "Vos DJU sont mis à jour automatiquement chaque nuit."}
          </p>
        </div>
        {showSyncButton && (
          <ReadOnlyGate>
            <button
              onClick={handleSyncDju}
              disabled={syncing || !contractId}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Synchronisation...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Synchroniser DJU
                </>
              )}
            </button>
          </ReadOnlyGate>
        )}
      </div>

      {syncResult && (
        <div className={`p-4 rounded-lg ${syncResult.updated > 0 ? "bg-green-50 text-green-800" : syncResult.errors?.length ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}>
          {syncResult.updated > 0 ? (
            <p className="font-medium">✓ {syncResult.updated}/{syncResult.total} consommations mises à jour avec les DJU réels</p>
          ) : syncResult.errors?.length ? (
            <div>
              <p className="font-medium mb-2">✗ Erreurs lors de la synchronisation :</p>
              <ul className="list-disc list-inside text-sm">
                {syncResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          ) : syncResult.total === 0 ? (
            <p className="font-medium">ℹ Aucune consommation trouvée. Importez d&apos;abord les consommations.</p>
          ) : (
            <p className="font-medium">ℹ Toutes les consommations ({syncResult.total}) ont déjà des DJU réels</p>
          )}
        </div>
      )}

      {/* DJU Summary Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Snowflake size={20} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-700">DJU Réels</span>
          </div>
          <p className="text-3xl font-bold text-blue-900">{filteredDjuTotal}</p>
          <p className="text-xs text-blue-600 mt-1">Cumul mois avec consommation</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Thermometer size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">DJU Trentenaire</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{djuData.summary.djuTrentenaireToDate}</p>
          <p className="text-xs text-gray-600 mt-1">Attendu à ce jour (moy. 30 ans)</p>
        </div>
        <div className={`rounded-xl p-4 text-center ${djuData.summary.ecart > 0 ? "bg-cyan-50" : "bg-orange-50"}`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            {djuData.summary.ecart > 0 ? (
              <CloudSnow size={20} className="text-cyan-600" />
            ) : (
              <Sun size={20} className="text-orange-600" />
            )}
            <span className={`text-sm font-medium ${djuData.summary.ecart > 0 ? "text-cyan-700" : "text-orange-700"}`}>
              Écart
            </span>
          </div>
          <p className={`text-3xl font-bold ${djuData.summary.ecart > 0 ? "text-cyan-900" : "text-orange-900"}`}>
            {djuData.summary.ecart > 0 ? "+" : ""}{djuData.summary.ecart}
          </p>
          <p className={`text-xs mt-1 ${djuData.summary.ecart > 0 ? "text-cyan-600" : "text-orange-600"}`}>
            {djuData.summary.ecartPercent > 0 ? "+" : ""}{djuData.summary.ecartPercent}% vs trentenaire
          </p>
        </div>
        <div className={`rounded-xl p-4 text-center ${djuData.summary.ecart > 0 ? "bg-cyan-100" : "bg-orange-100"}`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <ThermometerSun size={20} className={djuData.summary.ecart > 0 ? "text-cyan-700" : "text-orange-700"} />
            <span className={`text-sm font-medium ${djuData.summary.ecart > 0 ? "text-cyan-800" : "text-orange-800"}`}>
              Interprétation
            </span>
          </div>
          <p className={`text-sm font-semibold ${djuData.summary.ecart > 0 ? "text-cyan-900" : "text-orange-900"}`}>
            {djuData.summary.interpretation}
          </p>
          <p className={`text-xs mt-2 ${djuData.summary.ecart > 0 ? "text-cyan-700" : "text-orange-700"}`}>
            {djuData.summary.ecart > 0 ? "Besoins de chauffage supérieurs" : "Besoins de chauffage inférieurs"}
          </p>
        </div>
      </div>

      {/* DJU Monthly Chart - filtered by months with consumption */}
      {filteredMonthlyData.length > 0 && (
        <ChartCard title="DJU mensuels" subtitle={`Saison ${selectedYear - 1}/${selectedYear}`}>
          {(() => {
            const maxDju = Math.max(...filteredMonthlyData.map((d) => d.dju), 1);
            const barAreaHeight = 120; // pixels
            return (
              <div className="flex items-end gap-2" style={{ height: barAreaHeight + 40 }}>
                {filteredMonthlyData.map((m) => {
                  const barHeight = (m.dju / maxDju) * barAreaHeight;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center justify-end" style={{ height: barAreaHeight + 40 }}>
                      <span className="text-xs font-medium text-primary-dark mb-1">{m.dju}</span>
                      <div
                        className="w-full max-w-12 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t"
                        style={{ height: Math.max(barHeight, m.dju > 0 ? 4 : 0) }}
                      />
                      <span className="text-xs text-text-secondary mt-1">{m.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </ChartCard>
      )}

      {/* DJU by Site with Heating Seasons */}
      {djuData.sites.length > 0 && (
        <ChartCard title="DJU par site (station météo)" subtitle="Cliquez sur une période pour la modifier">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary">Site</th>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary">Station</th>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary">Période</th>
                  <th className="text-right px-3 py-2 font-medium text-text-secondary">DJU Réel</th>
                  <th className="text-right px-3 py-2 font-medium text-text-secondary">DJU Trent.</th>
                  <th className="text-right px-3 py-2 font-medium text-text-secondary">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {djuData.sites.map((site) => {
                  return (
                    <tr key={site.siteId} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <p className="font-medium text-primary-dark">{site.siteName}</p>
                        <p className="text-xs text-gray-500">{site.postalCode} {site.city}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-gray-700 font-medium">{site.station}</p>
                        <p className="text-xs text-gray-400">DJU trent. {site.djuTrentenaire}</p>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => openHeatingSeasonModal(site.siteId, site.siteName, site.heatingStartDate, site.heatingEndDate)}
                          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
                            site.hasHeatingSeason
                              ? "bg-gradient-to-r from-green-50 to-blue-50 text-gray-700 hover:from-green-100 hover:to-blue-100 border border-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          <Calendar size={12} />
                          <span>
                            {site.hasHeatingSeason ? (
                              <>
                                <span className="text-green-700 font-medium">
                                  {new Date(site.heatingStartDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                                </span>
                                <span className="mx-1 text-gray-400">→</span>
                                <span className="text-blue-700 font-medium">
                                  {site.heatingEndDate
                                    ? new Date(site.heatingEndDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
                                    : "..."}
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{site.djuReel}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{site.djuTrentenaireToDate}</td>
                      <td className={`px-3 py-2 text-right font-medium ${site.ecartTrentenaire > 0 ? "text-blue-600" : "text-orange-600"}`}>
                        {site.ecartTrentenaire > 0 ? "+" : ""}{site.ecartTrentenaire}
                        <span className="text-xs ml-1">({site.ecartPercent > 0 ? "+" : ""}{site.ecartPercent}%)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </>
  );
}
