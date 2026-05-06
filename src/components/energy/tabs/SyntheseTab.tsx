"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Download,
  ExternalLink,
  Flame,
  Info,
  Loader2,
  Plus,
  ThermometerSun,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import type { AnalyticsData, Alert } from "@/components/energy/types";


export function SyntheseContent({
  analytics,
  activeAlerts,
  setShowIdexImportModal,
  setShowCreateModal,
  contractRef,
  contractTitle,
  contractProvider,
  year,
  yearLabel,
}: {
  analytics: AnalyticsData | null;
  activeAlerts: Alert[];
  setShowIdexImportModal: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
  contractRef?: string;
  contractTitle?: string;
  contractProvider?: string;
  year?: number;
  yearLabel?: string;
}) {
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (!analytics || !contractRef) return;
    setExporting(true);
    try {
      const { exportSynthesisPdf } = await import("@/components/energy/pdf/SynthesisPdf");
      await exportSynthesisPdf({
        contractRef,
        contractTitle: contractTitle ?? "",
        contractProvider: contractProvider ?? "",
        year: year ?? new Date().getFullYear(),
        yearLabel: yearLabel ?? `${year ?? new Date().getFullYear()}`,
        analytics,
        activeAlerts,
      });
    } catch (err) {
      console.error("Erreur export PDF:", err);
      alert("Erreur lors de la génération du PDF");
    } finally {
      setExporting(false);
    }
  };
  // Filtre par status cliqué sur une KPI (Économie / Dépassement)
  const [statusFilter, setStatusFilter] = useState<"ECONOMIE" | "DEPASSEMENT" | null>(null);
  const toggleStatus = (s: "ECONOMIE" | "DEPASSEMENT") =>
    setStatusFilter((prev) => (prev === s ? null : s));

  if (!analytics) {
    return (
      <ChartCard title="">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-text-secondary mb-4">Aucune donnée de consommation</p>
          <div className="flex gap-2 flex-wrap justify-center">
            <Button variant="outline" onClick={() => setShowIdexImportModal(true)}>
              <Flame size={18} className="mr-2" />
              Import Exploitant
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={18} className="mr-2" />
              Saisir relevé
            </Button>
          </div>
        </div>
      </ChartCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec bouton export PDF */}
      {contractRef && (
        <div className="flex justify-end">
          <button
            onClick={handleExport}
            disabled={exporting}
            title="Exporter la synthèse en PDF"
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            <span>Exporter PDF</span>
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="NC (Conso. réelle)"
          value={`${(analytics.summary.totalNc / 1000).toFixed(0)} MWh`}
          icon={Flame}
          iconColor="text-orange-600"
        />
        <StatsCard
          title="N'B (Théorique)"
          value={`${(analytics.summary.totalNbPrime / 1000).toFixed(0)} MWh`}
          icon={ThermometerSun}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Écart NC/N'B"
          value={`${analytics.summary.deltaPercent > 0 ? "+" : ""}${analytics.summary.deltaPercent}%`}
          change={analytics.summary.status === "ECONOMIE" ? "Économie" : analytics.summary.status === "DEPASSEMENT" ? "Dépassement" : "Objectif atteint"}
          changeType={analytics.summary.deltaPercent <= 0 ? "positive" : "negative"}
          icon={analytics.summary.deltaPercent <= 0 ? TrendingDown : TrendingUp}
          iconColor={analytics.summary.deltaPercent <= 0 ? "text-green-600" : "text-red-600"}
        />
        <StatsCard
          title="Sites en économie"
          value={`${analytics.summary.sitesEnEconomie}/${analytics.summary.totalSites}`}
          icon={Building2}
          iconColor="text-accent"
          onClick={() => toggleStatus("ECONOMIE")}
          active={statusFilter === "ECONOMIE"}
        />
        <StatsCard
          title="Sites en dépassement"
          value={`${analytics.summary.sitesEnDepassement}/${analytics.summary.totalSites}`}
          change={
            analytics.summary.sitesEnDepassement > 0 ? "À surveiller" : "Aucune dérive"
          }
          changeType={analytics.summary.sitesEnDepassement > 0 ? "negative" : "positive"}
          icon={AlertTriangle}
          iconColor="text-red-600"
          onClick={() => toggleStatus("DEPASSEMENT")}
          active={statusFilter === "DEPASSEMENT"}
        />
      </div>

      {/* Performance par site */}
      {analytics.sites.length > 0 && (
        <ChartCard
          title="Performance par site"
          subtitle={
            statusFilter === "ECONOMIE"
              ? "Filtré : sites en économie"
              : statusFilter === "DEPASSEMENT"
              ? "Filtré : sites en dépassement"
              : undefined
          }
          action={
            statusFilter ? (
              <button
                type="button"
                onClick={() => setStatusFilter(null)}
                className="text-xs text-accent hover:underline"
              >
                Réinitialiser
              </button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="w-full">
              <thead className="bg-background-secondary border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Site</th>

                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">NB (MWh)</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">DJC</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">DJR</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">NC (MWh)</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">N&apos;B (MWh)</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Écart</th>
                  <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.sites
                  .filter((site) => site.nb != null)
                  .filter((site) => statusFilter == null || site.status === statusFilter)
                  .map((site) => (
                  <tr key={site.siteId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-primary-dark">{site.siteName}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            site.dataSource === "TELERELEVE"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {site.dataSource === "TELERELEVE" ? "Télérelève" : "Manuel"}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right text-gray-600">
                      {site.nb ? (site.nb).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-gray-500">
                      {site._debug?.usedDjuc ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-gray-500">
                      {site._debug?.djrTotal ?? "—"}
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
                    <td className={`px-6 py-4 text-right font-medium ${
                      site.status === "INCOMPLET"
                        ? "text-gray-400"
                        : site.deltaPercent <= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {site.status === "INCOMPLET"
                        ? "—"
                        : `${site.deltaPercent > 0 ? "+" : ""}${site.deltaPercent}%`}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          site.status === "ECONOMIE"
                            ? "bg-green-100 text-green-700"
                            : site.status === "DEPASSEMENT"
                            ? "bg-red-100 text-red-700"
                            : site.status === "INCOMPLET"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {site.status === "ECONOMIE"
                          ? "Économie"
                          : site.status === "DEPASSEMENT"
                          ? "Dépassement"
                          : site.status === "INCOMPLET"
                          ? "Données manquantes"
                          : "Objectif"}
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
      )}

      {/* Alerts */}
      {activeAlerts.length > 0 && (
        <ChartCard title="Alertes dérives actives">
          <div className="space-y-4">
            {activeAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.priority === "CRITIQUE"
                    ? "bg-red-50 border-red-500"
                    : alert.priority === "HAUTE"
                    ? "bg-yellow-50 border-yellow-500"
                    : "bg-blue-50 border-blue-500"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-primary-dark">{alert.title}</p>
                    <p className="text-sm text-text-secondary">{alert.message}</p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded ${
                      alert.priority === "CRITIQUE"
                        ? "bg-red-100 text-red-600"
                        : alert.priority === "HAUTE"
                        ? "bg-yellow-100 text-yellow-600"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {alert.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
