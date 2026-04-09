"use client";

import { Building2, Calendar, Droplets } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import type { AnalyticsData } from "@/components/energy/types";

export function ECSContent({
  analytics,
  selectedYear,
  contractId,
}: {
  analytics: AnalyticsData | null;
  selectedYear: number;
  contractId: string | null;
}) {
  if (!analytics) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <Droplets size={48} className="mx-auto mb-4 opacity-50" />
        <p>Aucune donnée ECS disponible</p>
      </div>
    );
  }

  // Calculate total ECS consumption across all sites
  // Note: ecsTotal is water-based ECS only (m³), heat-based ECS is tracked separately
  const totalECS = analytics.sites.reduce((sum, site) => sum + site.ecsTotal, 0);

  // Filter sites that have ECS consumption
  const sitesWithECS = analytics.sites.filter(site => site.ecsTotal > 0);

  // Calculate monthly ECS totals
  const monthlyECS = new Map<string, number>();
  analytics.sites.forEach(site => {
    site.monthlyData.forEach(month => {
      if (month.ecs > 0) {
        const existing = monthlyECS.get(month.month) || 0;
        monthlyECS.set(month.month, existing + month.ecs);
      }
    });
  });

  const monthlyECSData = Array.from(monthlyECS.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, ecs]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("fr-FR", { month: "short" }),
      ecs: Math.round(ecs),
    }));

  return (
    <>
      {/* Summary Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Droplets size={20} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-700">ECS Total</span>
          </div>
          <p className="text-3xl font-bold text-blue-900">{totalECS.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-blue-600 mt-1">m³ - Saison {selectedYear - 1}/{selectedYear}</p>
        </div>

        <div className="bg-cyan-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 size={20} className="text-cyan-600" />
            <span className="text-sm font-medium text-cyan-700">Sites avec ECS</span>
          </div>
          <p className="text-3xl font-bold text-cyan-900">{sitesWithECS.length}</p>
          <p className="text-xs text-cyan-600 mt-1">sur {analytics.sites.length} sites</p>
        </div>

        <div className="bg-teal-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calendar size={20} className="text-teal-600" />
            <span className="text-sm font-medium text-teal-700">Moyenne mensuelle</span>
          </div>
          <p className="text-3xl font-bold text-teal-900">
            {monthlyECSData.length > 0 ? Math.round(totalECS / monthlyECSData.length).toLocaleString('fr-FR') : "0"}
          </p>
          <p className="text-xs text-teal-600 mt-1">m³ / mois</p>
        </div>
      </div>

      {/* Monthly ECS Chart */}
      {monthlyECSData.length > 0 && (
        <ChartCard title="Consommation ECS mensuelle" subtitle={`Saison ${selectedYear - 1}/${selectedYear}`}>
          {(() => {
            const maxEcs = Math.max(...monthlyECSData.map((d) => d.ecs), 1);
            const barAreaHeight = 120;
            return (
              <div className="flex items-end gap-2" style={{ height: barAreaHeight + 40 }}>
                {monthlyECSData.map((m) => {
                  const barHeight = (m.ecs / maxEcs) * barAreaHeight;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center justify-end" style={{ height: barAreaHeight + 40 }}>
                      <span className="text-xs font-medium text-primary-dark mb-1">{Math.round(m.ecs).toLocaleString('fr-FR')}</span>
                      <div
                        className="w-full max-w-12 bg-gradient-to-t from-blue-500 to-cyan-300 rounded-t"
                        style={{ height: Math.max(barHeight, m.ecs > 0 ? 4 : 0) }}
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

      {/* Sites ECS Table */}
      {sitesWithECS.length > 0 && (
        <ChartCard title="ECS par site" subtitle={`${sitesWithECS.length} sites avec consommation ECS`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-secondary border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-3 py-2">Site</th>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-3 py-2">Ville</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-3 py-2">ECS (m³)</th>
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-3 py-2">% du total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sitesWithECS
                  .sort((a, b) => b.ecsTotal - a.ecsTotal)
                  .map((site) => {
                    const percentOfTotal = totalECS > 0 ? (site.ecsTotal / totalECS) * 100 : 0;
                    return (
                      <tr key={site.siteId} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <p className="font-medium text-primary-dark">{site.siteName}</p>
                          <p className="text-xs text-gray-500">{site.siteType}</p>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{site.city}</td>
                        <td className="px-3 py-2 text-right font-medium text-blue-600">
                          {Math.round(site.ecsTotal).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{percentOfTotal.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={2} className="px-3 py-2 font-semibold text-primary-dark">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-700">{Math.round(totalECS).toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2 text-right font-semibold">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </ChartCard>
      )}

      {sitesWithECS.length === 0 && (
        <div className="text-center py-12 text-text-secondary bg-gray-50 rounded-lg">
          <Droplets size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium">Aucune consommation ECS enregistrée</p>
          <p className="text-sm mt-2">Les consommations ECS apparaîtront ici une fois saisies avec le type d'usage "ECS"</p>
        </div>
      )}
    </>
  );
}
