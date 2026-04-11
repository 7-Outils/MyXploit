"use client";

import { Building2, Calendar, Droplets } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import type { AnalyticsData } from "@/components/energy/types";

function formatValue(v: number, unit: string): string {
  if (unit === "kWh" && v >= 1000) return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} MWh`;
  return `${Math.round(v).toLocaleString("fr-FR")} ${unit}`;
}

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

  // Combine water-based (m³) and heat-based (kWh) ECS
  const totalEcsWater = analytics.sites.reduce((sum, site) => sum + site.ecsTotal, 0);
  const totalEcsHeat = analytics.sites.reduce((sum, site) => sum + (site.ecsHeatTotal || 0), 0);
  const hasWater = totalEcsWater > 0;
  const hasHeat = totalEcsHeat > 0;
  const hasAny = hasWater || hasHeat;

  // Sites with any ECS
  const sitesWithECS = analytics.sites.filter(
    (site) => site.ecsTotal > 0 || (site.ecsHeatTotal || 0) > 0
  );

  // Monthly ECS (combine both)
  const monthlyECS = new Map<string, { water: number; heat: number }>();
  analytics.sites.forEach((site) => {
    site.monthlyData.forEach((month) => {
      const existing = monthlyECS.get(month.month) || { water: 0, heat: 0 };
      if (month.ecs > 0) existing.water += month.ecs;
      if (month.ecsHeat > 0) existing.heat += month.ecsHeat;
      monthlyECS.set(month.month, existing);
    });
  });

  const monthlyECSData = Array.from(monthlyECS.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("fr-FR", { month: "short" }),
      water: Math.round(data.water),
      heat: Math.round(data.heat),
    }));

  // Primary display unit
  const primaryTotal = hasHeat ? totalEcsHeat : totalEcsWater;
  const primaryUnit = hasHeat ? "kWh" : "m³";

  return (
    <>
      {/* Summary Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Droplets size={20} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-700">ECS Total</span>
          </div>
          <p className="text-3xl font-bold text-blue-900">{formatValue(primaryTotal, primaryUnit)}</p>
          {hasWater && hasHeat && (
            <p className="text-xs text-blue-600 mt-1">{formatValue(totalEcsWater, "m³")} (volume)</p>
          )}
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
            {monthlyECSData.length > 0 ? formatValue(primaryTotal / monthlyECSData.length, primaryUnit) : "—"}
          </p>
        </div>
      </div>

      {/* Monthly ECS Chart */}
      {monthlyECSData.length > 0 && (
        <ChartCard title="Consommation ECS mensuelle">
          {(() => {
            const values = monthlyECSData.map((d) => (hasHeat ? d.heat : d.water));
            const maxVal = Math.max(...values, 1);
            const barAreaHeight = 120;
            return (
              <div className="flex items-end gap-2" style={{ height: barAreaHeight + 40 }}>
                {monthlyECSData.map((m) => {
                  const val = hasHeat ? m.heat : m.water;
                  const barHeight = (val / maxVal) * barAreaHeight;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center justify-end" style={{ height: barAreaHeight + 40 }}>
                      <span className="text-xs font-medium text-primary-dark mb-1">{formatValue(val, primaryUnit)}</span>
                      <div
                        className="w-full max-w-12 bg-gradient-to-t from-blue-500 to-cyan-300 rounded-t"
                        style={{ height: Math.max(barHeight, val > 0 ? 4 : 0) }}
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
        <ChartCard title="ECS par site">
          <div className="overflow-x-auto -mx-6 -my-6">
            <table className="w-full">
              <thead className="bg-background-secondary border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">Site</th>
                  {hasHeat && <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">ECS (énergie)</th>}
                  {hasWater && <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">ECS (volume)</th>}
                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-6 py-3">% du total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sitesWithECS
                  .sort((a, b) => ((b.ecsHeatTotal || 0) + b.ecsTotal) - ((a.ecsHeatTotal || 0) + a.ecsTotal))
                  .map((site) => {
                    const siteTotal = hasHeat ? (site.ecsHeatTotal || 0) : site.ecsTotal;
                    const pct = primaryTotal > 0 ? (siteTotal / primaryTotal) * 100 : 0;
                    return (
                      <tr key={site.siteId} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-medium text-primary-dark">{site.siteName}</td>
                        {hasHeat && <td className="px-6 py-3 text-right font-medium text-blue-600">{formatValue(site.ecsHeatTotal || 0, "kWh")}</td>}
                        {hasWater && <td className="px-6 py-3 text-right text-gray-600">{Math.round(site.ecsTotal).toLocaleString("fr-FR")} m³</td>}
                        <td className="px-6 py-3 text-right text-gray-600">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr className="font-semibold">
                  <td className="px-6 py-3 text-primary-dark">Total</td>
                  {hasHeat && <td className="px-6 py-3 text-right font-bold text-blue-700">{formatValue(totalEcsHeat, "kWh")}</td>}
                  {hasWater && <td className="px-6 py-3 text-right font-bold text-blue-700">{Math.round(totalEcsWater).toLocaleString("fr-FR")} m³</td>}
                  <td className="px-6 py-3 text-right font-semibold">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </ChartCard>
      )}

      {!hasAny && (
        <div className="text-center py-12 text-text-secondary bg-gray-50 rounded-lg">
          <Droplets size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium">Aucune consommation ECS enregistrée</p>
          <p className="text-sm mt-2">Saisissez des relevés sur les compteurs ECS depuis la fiche bâtiment</p>
        </div>
      )}
    </>
  );
}
