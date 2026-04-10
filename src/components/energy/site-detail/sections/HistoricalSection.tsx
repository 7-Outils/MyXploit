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
            <Calendar className="h-5 w-5 text-accent" />
            Historique multi-saisons
          </span>
        }
      >
        {multiSeasonData.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-5 gap-4">
              {multiSeasonData.map((season) => (
                <div key={season.season} className="text-center">
                  <div className="text-sm font-medium mb-2">{season.season}</div>
                  <div className="relative h-32 flex items-end justify-center gap-1">
                    <div
                      className="w-6 bg-red-400 rounded-t"
                      style={{ height: `${Math.min((season.nc / Math.max(...multiSeasonData.map(s => s.nc))) * 100, 100)}%` }}
                      title={`NC: ${toMWh(season.nc)} MWh`}
                    />
                    <div
                      className="w-6 bg-blue-400 rounded-t"
                      style={{ height: `${Math.min((season.nbPrime / Math.max(...multiSeasonData.map(s => s.nbPrime))) * 100, 100)}%` }}
                      title={`N'B: ${toMWh(season.nbPrime)} MWh`}
                    />
                  </div>
                  <div className={`text-sm font-medium mt-1 ${
                    season.deltaPercent < 0 ? "text-green-600" : season.deltaPercent > 0 ? "text-red-600" : ""
                  }`}>
                    {season.deltaPercent > 0 ? "+" : ""}{season.deltaPercent.toFixed(1)}%
                  </div>
                  {getStatusBadge(season.status)}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-6 justify-center text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-red-400 rounded"></span> NC (Réel)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-blue-400 rounded"></span> N&apos;B (Objectif)
              </span>
            </div>

            <div className="overflow-x-auto border-t pt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Saison</th>
                    <th className="text-right py-2 font-medium">NC (MWh)</th>
                    <th className="text-right py-2 font-medium">N&apos;B (MWh)</th>
                    <th className="text-right py-2 font-medium">Écart</th>
                    <th className="text-right py-2 font-medium">DJU réels</th>
                    <th className="text-center py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {multiSeasonData.map((season) => (
                    <tr key={season.season} className="border-b">
                      <td className="py-2">{season.season}</td>
                      <td className="text-right py-2">{toMWh(season.nc)}</td>
                      <td className="text-right py-2">{toMWh(season.nbPrime)}</td>
                      <td className={`text-right py-2 font-medium ${
                        season.deltaPercent < 0 ? "text-green-600" : season.deltaPercent > 0 ? "text-red-600" : ""
                      }`}>
                        {season.deltaPercent > 0 ? "+" : ""}{season.deltaPercent.toFixed(1)}%
                      </td>
                      <td className="text-right py-2">{formatNumber(season.djuReel)}</td>
                      <td className="text-center py-2">{getStatusBadge(season.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-text-secondary">
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
          <Thermometer className="h-5 w-5 text-accent" />
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
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-secondary">DJU réels:</span>
              <span className="ml-2 font-medium">{formatNumber(filteredDjuTotal)}</span>
            </div>
            <div>
              <span className="text-text-secondary">DJU trentenaire:</span>
              <span className="ml-2 font-medium">{siteDju ? formatNumber(siteDju.djuTrentenaire) : "-"}</span>
            </div>
            <div>
              <span className="text-text-secondary">Écart:</span>
              <span className={`ml-2 font-medium ${siteDju && siteDju.ecartPercent > 0 ? "text-blue-600" : "text-orange-600"}`}>
                {siteDju ? `${siteDju.ecartPercent > 0 ? "+" : ""}${siteDju.ecartPercent}%` : "-"}
              </span>
            </div>
            <div>
              <span className="text-text-secondary">Station:</span>
              <span className="ml-2 font-medium">{siteDju?.station || "-"}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[250px] text-text-secondary">
          Aucune donnée DJU disponible
        </div>
      )}
    </ChartCard>
  );
}
