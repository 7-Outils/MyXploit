"use client";

import { Zap, Thermometer } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { formatMonthLabel, formatNumber, toMWh } from "@/components/energy/site-detail/constants";
import type { SiteDetailData } from "@/components/energy/site-detail/types";

interface ConsumptionChartsProps {
  site: SiteDetailData;
  siteAnalytics: {
    nc: number;
    nbPrime: number;
    delta: number;
    deltaPercent: number;
    monthlyData: Array<{
      month: string;
      nc: number;
      nbPrime: number;
      djr: number;
      ecs: number;
    }>;
  } | undefined;
  siteDju: {
    djuTrentenaire: number;
  } | undefined;
  monthlyChartData: Array<{ label: string; value: number; target: number }>;
}

export default function ConsumptionCharts({
  site,
  siteAnalytics,
  siteDju,
  monthlyChartData,
}: ConsumptionChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* NC vs N'B mensuel */}
      <ChartCard
        title={
          <span className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            Consommation mensuelle NC vs N&apos;B
          </span>
        }
      >
        {monthlyChartData.length > 0 ? (
          <SimpleBarChart data={monthlyChartData} height={250} />
        ) : (
          <div className="flex items-center justify-center h-[250px] text-text-secondary">
            Aucune donnée disponible
          </div>
        )}
      </ChartCard>

      {/* Signature énergétique */}
      <ChartCard
        title={
          <span className="flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-accent" />
            Signature énergétique (NC vs DJU)
          </span>
        }
      >
        {siteAnalytics && siteAnalytics.monthlyData.length > 0 ? (
          <div className="h-[250px] relative">
            <div className="grid grid-cols-3 gap-2 text-xs text-text-secondary mb-4">
              <div>
                <span className="font-medium">Pente:</span> {site.nb && siteDju?.djuTrentenaire
                  ? `${(site.nb / siteDju.djuTrentenaire * 1000).toFixed(2)} kWh/DJU`
                  : "-"}
              </div>
              <div>
                <span className="font-medium">Ordonnée:</span> Talon ECS
              </div>
              <div>
                <span className="font-medium">R²:</span> -
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {siteAnalytics.monthlyData.filter(m => m.djr > 0).map((m, i) => (
                <div key={i} className="bg-indigo-100 px-2 py-1 rounded text-xs">
                  {formatMonthLabel(m.month)}: {toMWh(m.nc)} MWh / {formatNumber(m.djr)} DJU
                </div>
              ))}
            </div>
            <p className="text-xs text-text-secondary mt-4">
              La signature énergétique représente la corrélation entre consommation et rigueur climatique.
              Une pente plus faible indique une meilleure performance thermique du bâtiment.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-text-secondary">
            Données insuffisantes pour la signature
          </div>
        )}
      </ChartCard>
    </div>
  );
}
