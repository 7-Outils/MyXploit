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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* NC vs N'B mensuel */}
      <ChartCard
        title={
          <span className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-ink/40" />
            Consommation mensuelle NC vs N&apos;B
          </span>
        }
      >
        {monthlyChartData.length > 0 ? (
          <SimpleBarChart data={monthlyChartData} height={250} />
        ) : (
          <div className="flex h-[250px] items-center justify-center text-sm text-ink/40">
            Aucune donnée disponible
          </div>
        )}
      </ChartCard>

      {/* Signature énergétique */}
      <ChartCard
        title={
          <span className="flex items-center gap-2">
            <Thermometer className="h-3.5 w-3.5 text-ink/40" />
            Signature énergétique (NC vs DJU)
          </span>
        }
      >
        {siteAnalytics && siteAnalytics.monthlyData.length > 0 ? (
          <div className="relative h-[250px]">
            <div className="mb-3 grid grid-cols-3 divide-x divide-ink/10 border-y border-ink/10 py-2">
              <div className="pr-2">
                <p className="label-tech">Pente</p>
                <p className="font-mono text-sm tabular-nums text-ink">
                  {site.nb && siteDju?.djuTrentenaire
                    ? `${(site.nb / siteDju.djuTrentenaire * 1000).toFixed(2)} kWh/DJU`
                    : "—"}
                </p>
              </div>
              <div className="px-2">
                <p className="label-tech">Ordonnée</p>
                <p className="text-sm text-ink">Talon ECS</p>
              </div>
              <div className="px-2">
                <p className="label-tech">R²</p>
                <p className="font-mono text-sm tabular-nums text-ink">—</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {siteAnalytics.monthlyData.filter(m => m.djr > 0).map((m, i) => (
                <div
                  key={i}
                  className="border border-ink/10 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-ink/60"
                >
                  {formatMonthLabel(m.month)} : {toMWh(m.nc)} MWh / {formatNumber(m.djr)} DJU
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink/50">
              La signature énergétique représente la corrélation entre consommation et rigueur climatique.
              Une pente plus faible indique une meilleure performance thermique du bâtiment.
            </p>
          </div>
        ) : (
          <div className="flex h-[250px] items-center justify-center text-sm text-ink/40">
            Données insuffisantes pour la signature
          </div>
        )}
      </ChartCard>
    </div>
  );
}
