"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Flame,
  Plus,
  ThermometerSun,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import type { AnalyticsData, Alert } from "@/components/energy/types";
import { SITE_TYPE_LABELS } from "@/components/energy/constants";

export function SyntheseContent({
  analytics,
  chartData,
  activeAlerts,
  setShowIdexImportModal,
  setShowCreateModal,
  hasContract,
}: {
  analytics: AnalyticsData | null;
  chartData: { label: string; value: number; target: number }[];
  activeAlerts: Alert[];
  setShowIdexImportModal: (v: boolean) => void;
  setShowCreateModal: (v: boolean) => void;
  hasContract: boolean;
}) {
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

  const topEconomies = [...analytics.sites]
    .filter(s => s.status === "ECONOMIE")
    .sort((a, b) => a.deltaPercent - b.deltaPercent)
    .slice(0, 5);

  const topDepassements = [...analytics.sites]
    .filter(s => s.status === "DEPASSEMENT")
    .sort((a, b) => b.deltaPercent - a.deltaPercent)
    .slice(0, 5);

  return (
    <>
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
        />
        <StatsCard
          title="Alertes dérives"
          value={activeAlerts.length.toString()}
          change={activeAlerts.filter((a) => a.priority === "CRITIQUE").length > 0 ? `${activeAlerts.filter((a) => a.priority === "CRITIQUE").length} critiques` : "Aucune critique"}
          changeType={activeAlerts.filter((a) => a.priority === "CRITIQUE").length > 0 ? "negative" : "neutral"}
          icon={AlertTriangle}
          iconColor="text-red-600"
        />
      </div>

      {/* Charts and Top/Flop */}
      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard
          title="Consommation mensuelle"
          subtitle="NC (Réel) vs N'B (Théorique ajusté DJU)"
          className="lg:col-span-2"
        >
          {chartData.length > 0 ? (
            <>
              <SimpleBarChart data={chartData} height={250} />
              <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gradient-to-t from-accent to-accent-light rounded" />
                  <span className="text-text-secondary">NC (Conso. réelle)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-200 rounded" />
                  <span className="text-text-secondary">N&apos;B (Théorique)</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-text-secondary">Aucune donnée mensuelle</p>
            </div>
          )}
        </ChartCard>

        {/* Top/Flop Sites */}
        <ChartCard title="Performance sites">
          <div className="space-y-4">
            {topEconomies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
                  <ArrowDownRight size={14} />
                  Top économies
                </p>
                <div className="space-y-2">
                  {topEconomies.map((site) => (
                    <Link
                      key={site.siteId}
                      href={`/energy/sites/${site.siteId}`}
                      className="flex items-center justify-between p-2 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-primary-dark truncate">{site.siteName}</span>
                      <span className="text-sm font-bold text-green-600">{site.deltaPercent}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {topDepassements.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
                  <ArrowUpRight size={14} />
                  Top dépassements
                </p>
                <div className="space-y-2">
                  {topDepassements.map((site) => (
                    <Link
                      key={site.siteId}
                      href={`/energy/sites/${site.siteId}`}
                      className="flex items-center justify-between p-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-primary-dark truncate">{site.siteName}</span>
                      <span className="text-sm font-bold text-red-600">+{site.deltaPercent}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {topEconomies.length === 0 && topDepassements.length === 0 && (
              <p className="text-sm text-text-secondary text-center py-4">Pas assez de données</p>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Performance by type */}
      {analytics.performanceByType.length > 0 && (
        <ChartCard title="Performance par type de bâtiment">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {analytics.performanceByType.map((item) => (
              <div key={item.type} className="bg-background-secondary rounded-xl p-4 text-center">
                <p className="text-sm text-text-secondary mb-2">
                  {SITE_TYPE_LABELS[item.type] || item.type}
                </p>
                <p className={`text-3xl font-bold ${item.deltaPercent <= 0 ? "text-green-600" : "text-red-600"}`}>
                  {item.deltaPercent > 0 ? "+" : ""}{item.deltaPercent}%
                </p>
                <p className="text-xs text-gray-500 mt-1">{item.count} site{item.count > 1 ? "s" : ""}</p>
              </div>
            ))}
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
    </>
  );
}
