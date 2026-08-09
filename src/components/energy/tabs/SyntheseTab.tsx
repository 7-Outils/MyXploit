"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ExternalLink,
  Flame,
  Info,
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
  setShowCreateModal,
}: {
  analytics: AnalyticsData | null;
  activeAlerts: Alert[];
  setShowCreateModal: (v: boolean) => void;
}) {
  const router = useRouter();
  // Filtre par status cliqué sur une KPI (Économie / Dépassement)
  const [statusFilter, setStatusFilter] = useState<"ECONOMIE" | "DEPASSEMENT" | null>(null);
  const toggleStatus = (s: "ECONOMIE" | "DEPASSEMENT") =>
    setStatusFilter((prev) => (prev === s ? null : s));

  if (!analytics) {
    return (
      <ChartCard title="">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="w-8 h-8 text-ink/25 mb-3" />
          <p className="text-sm text-ink/60 mb-4">Aucune donnée de consommation</p>
          <div className="flex gap-2 flex-wrap justify-center">
            <Button variant="outline" onClick={() => router.push("/energy/import")}>
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
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <StatsCard
          title="NC (Conso. réelle)"
          value={`${(analytics.summary.totalNc / 1000).toFixed(0)} MWh`}
          icon={Flame}
        />
        <StatsCard
          title="N'B (Théorique)"
          value={`${(analytics.summary.totalNbPrime / 1000).toFixed(0)} MWh`}
          icon={ThermometerSun}
        />
        <StatsCard
          title="Écart NC/N'B"
          value={`${analytics.summary.deltaPercent > 0 ? "+" : ""}${analytics.summary.deltaPercent}%`}
          change={analytics.summary.status === "ECONOMIE" ? "Économie" : analytics.summary.status === "DEPASSEMENT" ? "Dépassement" : "Objectif atteint"}
          changeType={analytics.summary.deltaPercent <= 0 ? "positive" : "negative"}
          icon={analytics.summary.deltaPercent <= 0 ? TrendingDown : TrendingUp}
        />
        <StatsCard
          title="Sites en économie"
          value={`${analytics.summary.sitesEnEconomie}/${analytics.summary.totalSites}`}
          icon={Building2}
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
                className="font-mono text-[11px] uppercase tracking-widest text-ink/50 transition-colors hover:text-accent"
              >
                Réinitialiser
              </button>
            ) : undefined
          }
        >
          {/* Mobile: liste de cards */}
          <div className="md:hidden -mx-4 -mb-4 -mt-2 divide-y divide-ink/[0.06]">
            {analytics.sites
              .filter((site) => site.nb != null)
              .filter((site) => statusFilter == null || site.status === statusFilter)
              .map((site) => {
                const statusBg =
                  site.status === "ECONOMIE"
                    ? "bg-green-50 text-green-700 border border-green-600/20"
                    : site.status === "DEPASSEMENT"
                    ? "bg-red-50 text-red-700 border border-red-600/20"
                    : site.status === "INCOMPLET"
                    ? "bg-amber-50 text-amber-700 border border-amber-600/20"
                    : "bg-ink/[0.04] text-ink/60 border border-ink/15";
                const statusLabel =
                  site.status === "ECONOMIE"
                    ? "Économie"
                    : site.status === "DEPASSEMENT"
                    ? "Dépassement"
                    : site.status === "INCOMPLET"
                    ? "Incomplet"
                    : "Objectif";
                const deltaColor =
                  site.status === "INCOMPLET"
                    ? "text-ink/40"
                    : site.deltaPercent <= 0
                    ? "text-green-600"
                    : "text-red-600";
                return (
                  <Link
                    key={site.siteId}
                    href={`/energy/sites/${site.siteId}`}
                    className="block px-4 py-2 transition-colors hover:bg-ink/[0.02]"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-medium text-ink text-sm leading-snug flex-1 min-w-0 truncate">
                        {site.siteName}
                      </span>
                      <span className={`font-mono text-[11px] uppercase tracking-widest px-1.5 py-0.5 whitespace-nowrap ${statusBg}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] divide-x divide-ink/10">
                      <div>
                        <p className="label-tech">NC</p>
                        <p className="font-mono tabular-nums font-medium text-ink">
                          {(site.nc / 1000).toFixed(1)} <span className="text-ink/50">MWh</span>
                        </p>
                      </div>
                      <div className="pl-2">
                        <p className="label-tech">N&apos;B</p>
                        <p className="font-mono tabular-nums text-ink/70">
                          {(site.nbPrime / 1000).toFixed(1)} <span className="text-ink/50">MWh</span>
                        </p>
                      </div>
                      <div className="pl-2">
                        <p className="label-tech">Écart</p>
                        <p className={`font-mono tabular-nums font-medium ${deltaColor}`}>
                          {site.status === "INCOMPLET"
                            ? "—"
                            : `${site.deltaPercent > 0 ? "+" : ""}${site.deltaPercent}%`}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
          </div>

          {/* Desktop: table classique */}
          <div className="hidden md:block overflow-x-auto -mx-4 -my-4">
            <table className="w-full">
              <thead className="border-b border-ink/10">
                <tr>
                  <th className="label-tech px-3 py-2 font-normal text-left">Site</th>

                  <th className="label-tech px-3 py-2 font-normal text-right">NB (MWh)</th>
                  <th className="label-tech px-3 py-2 font-normal text-right">DJC</th>
                  <th className="label-tech px-3 py-2 font-normal text-right">DJR</th>
                  <th className="label-tech px-3 py-2 font-normal text-right">NC (MWh)</th>
                  <th className="label-tech px-3 py-2 font-normal text-right">N&apos;B (MWh)</th>
                  <th className="label-tech px-3 py-2 font-normal text-right">Écart</th>
                  <th className="label-tech px-3 py-2 font-normal text-center">Status</th>
                  <th className="label-tech px-3 py-2 font-normal text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/[0.06]">
                {analytics.sites
                  .filter((site) => site.nb != null)
                  .filter((site) => statusFilter == null || site.status === statusFilter)
                  .map((site) => (
                  <tr key={site.siteId} className="hover:bg-ink/[0.02]">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink">{site.siteName}</span>
                        <span
                          className={`font-mono text-[11px] uppercase tracking-widest px-1.5 py-0.5 ${
                            site.dataSource === "TELERELEVE"
                              ? "border border-accent/25 text-accent"
                              : "border border-ink/15 text-ink/50"
                          }`}
                        >
                          {site.dataSource === "TELERELEVE" ? "Télérelève" : "Manuel"}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2 text-right font-mono tabular-nums text-sm text-ink/70">
                      {site.nb ? (site.nb).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-xs text-ink/50">
                      {site._debug?.usedDjuc ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-xs text-ink/50">
                      {site._debug?.djrTotal ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-sm font-medium text-ink">{(site.nc / 1000).toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-sm text-ink/70">
                      <div className="flex items-center justify-end gap-1">
                        <span>{(site.nbPrime / 1000).toFixed(1)}</span>
                        {site._debug && !site._debug.calculationApplied && (
                          <span className="group relative">
                            <Info size={14} className="text-amber-600 cursor-help" />
                            <span className="absolute right-0 bottom-full mb-1 hidden group-hover:block bg-ink text-paper text-xs px-2 py-1 whitespace-nowrap z-10 shadow-large">
                              N&apos;B non ajusté : DJR={site._debug.djrTotal}, DJUC={site._debug.usedDjuc || 0}
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono tabular-nums text-sm font-medium ${
                      site.status === "INCOMPLET"
                        ? "text-ink/40"
                        : site.deltaPercent <= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {site.status === "INCOMPLET"
                        ? "—"
                        : `${site.deltaPercent > 0 ? "+" : ""}${site.deltaPercent}%`}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-block font-mono text-[11px] uppercase tracking-widest px-1.5 py-0.5 ${
                          site.status === "ECONOMIE"
                            ? "bg-green-50 text-green-700 border border-green-600/20"
                            : site.status === "DEPASSEMENT"
                            ? "bg-red-50 text-red-700 border border-red-600/20"
                            : site.status === "INCOMPLET"
                            ? "bg-amber-50 text-amber-700 border border-amber-600/20"
                            : "bg-ink/[0.04] text-ink/60 border border-ink/15"
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
                    <td className="px-3 py-2 text-center">
                      <Link
                        href={`/energy/sites/${site.siteId}`}
                        title="Détail du site"
                        className="inline-flex h-9 w-9 items-center justify-center border border-ink/20 text-ink/60 transition-colors hover:border-accent hover:text-accent"
                      >
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
          <div className="-mx-4 -my-4 divide-y divide-ink/[0.06]">
            {activeAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`px-4 py-2 border-l-2 ${
                  alert.priority === "CRITIQUE"
                    ? "border-l-red-600"
                    : alert.priority === "HAUTE"
                    ? "border-l-amber-600"
                    : "border-l-ink/25"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{alert.title}</p>
                    <p className="text-xs text-ink/60">{alert.message}</p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[11px] uppercase tracking-widest px-1.5 py-0.5 ${
                      alert.priority === "CRITIQUE"
                        ? "bg-red-50 text-red-700 border border-red-600/20"
                        : alert.priority === "HAUTE"
                        ? "bg-amber-50 text-amber-700 border border-amber-600/20"
                        : "bg-ink/[0.04] text-ink/60 border border-ink/15"
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
