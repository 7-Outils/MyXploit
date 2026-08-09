"use client";

import { Calendar, Thermometer } from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { formatMonthLabel, formatNumber, toMWh, getStatusBadge } from "@/components/energy/site-detail/constants";
import type { MultiSeasonData } from "@/components/energy/site-detail/types";

interface HistoricalSectionProps {
  multiSeasonData: MultiSeasonData[];
}

export interface DJUChartProps {
  siteAnalytics: {
    monthlyData: Array<{ month: string; nc: number }>;
  } | undefined;
  siteDju: {
    djuReel: number;
    djuTrentenaire: number;
    ecartPercent: number;
    station: string;
    monthlyData: Array<{ month: string; dju: number; avgTemp: number }>;
  } | undefined;
}

export default function HistoricalSection({
  multiSeasonData,
}: HistoricalSectionProps) {
  return (
    <ChartCard
        title={
          <span className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-ink/40" />
            Historique multi-saisons
          </span>
        }
      >
        {multiSeasonData.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-3">
              {multiSeasonData.map((season) => (
                <div key={season.season} className="text-center">
                  <div className="label-tech mb-2">{season.season}</div>
                  <div className="relative flex h-32 items-end justify-center gap-1 border-b border-ink/10">
                    <div
                      className="w-6 bg-ink"
                      style={{ height: `${Math.min((season.nc / Math.max(...multiSeasonData.map(s => s.nc))) * 100, 100)}%` }}
                      title={`NC: ${toMWh(season.nc)} MWh`}
                    />
                    <div
                      className="w-6 bg-accent"
                      style={{ height: `${Math.min((season.nbPrime / Math.max(...multiSeasonData.map(s => s.nbPrime))) * 100, 100)}%` }}
                      title={`N'B: ${toMWh(season.nbPrime)} MWh`}
                    />
                  </div>
                  <div className={`mt-1.5 font-mono text-sm font-medium tabular-nums ${
                    season.deltaPercent < 0 ? "text-green-600" : season.deltaPercent > 0 ? "text-red-600" : "text-ink"
                  }`}>
                    {season.deltaPercent > 0 ? "+" : ""}{season.deltaPercent.toFixed(1)}%
                  </div>
                  <div className="mt-1 inline-block">{getStatusBadge(season.status)}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-6 font-mono text-[11px] uppercase tracking-widest text-ink/50">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 bg-ink" /> NC (réel)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 bg-accent" /> N&apos;B (objectif)
              </span>
            </div>

            <div className="overflow-x-auto border-t border-ink/10 pt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10">
                    <th className="label-tech py-2 text-left font-normal">Saison</th>
                    <th className="label-tech py-2 text-right font-normal">NC (MWh)</th>
                    <th className="label-tech py-2 text-right font-normal">N&apos;B (MWh)</th>
                    <th className="label-tech py-2 text-right font-normal">Écart</th>
                    <th className="label-tech py-2 text-right font-normal">DJU réels</th>
                    <th className="label-tech py-2 text-center font-normal">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/[0.06]">
                  {multiSeasonData.map((season) => (
                    <tr key={season.season} className="hover:bg-ink/[0.02]">
                      <td className="py-2 text-ink">{season.season}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-ink">{toMWh(season.nc)}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-ink">{toMWh(season.nbPrime)}</td>
                      <td className={`py-2 text-right font-mono font-medium tabular-nums ${
                        season.deltaPercent < 0 ? "text-green-600" : season.deltaPercent > 0 ? "text-red-600" : "text-ink"
                      }`}>
                        {season.deltaPercent > 0 ? "+" : ""}{season.deltaPercent.toFixed(1)}%
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-ink/60">{formatNumber(season.djuReel)}</td>
                      <td className="py-2 text-center">{getStatusBadge(season.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-sm text-ink/40">
            Aucun historique disponible
          </div>
        )}
      </ChartCard>
  );
}

export function DJUChart({
  siteAnalytics,
  siteDju,
}: DJUChartProps) {
  const monthsWithConsumption = new Set(
    siteAnalytics?.monthlyData.filter(m => m.nc > 0).map(m => m.month) || []
  );
  const filteredDjuData = siteDju?.monthlyData.filter(m =>
    monthsWithConsumption.has(m.month)
  ) || [];
  const filteredDjuTotal = filteredDjuData.reduce((sum, m) => sum + m.dju, 0);

  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          <Thermometer className="h-3.5 w-3.5 text-ink/40" />
          DJU mensuels
        </span>
      }
    >
      {filteredDjuData.length > 0 ? (
        <div>
          <SimpleBarChart
            data={filteredDjuData.map(m => ({
              label: formatMonthLabel(m.month),
              value: m.dju,
            }))}
            height={200}
          />
          <div className="mt-3 grid grid-cols-2 gap-x-4 border-t border-ink/10 pt-3 sm:grid-cols-4">
            <div>
              <p className="label-tech">DJU réels</p>
              <p className="font-mono text-sm font-medium tabular-nums text-ink">
                {formatNumber(filteredDjuTotal)}
              </p>
            </div>
            <div>
              <p className="label-tech">DJU trentenaire</p>
              <p className="font-mono text-sm font-medium tabular-nums text-ink">
                {siteDju ? formatNumber(siteDju.djuTrentenaire) : "—"}
              </p>
            </div>
            <div>
              <p className="label-tech">Écart</p>
              <p className="font-mono text-sm font-medium tabular-nums text-accent">
                {siteDju ? `${siteDju.ecartPercent > 0 ? "+" : ""}${siteDju.ecartPercent}%` : "—"}
              </p>
            </div>
            <div>
              <p className="label-tech">Station</p>
              <p className="text-sm font-medium text-ink">{siteDju?.station || "—"}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-[250px] items-center justify-center text-sm text-ink/40">
          Aucune donnée DJU disponible
        </div>
      )}
    </ChartCard>
  );
}
