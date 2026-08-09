"use client";

import {
  Euro,
  Loader2,
  Building2,
  Calendar,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import type { Contract, FinancialData } from "@/components/financier/types";

interface BudgetTabProps {
  loading: boolean;
  financialData: FinancialData | null;
  budgetStats: { totalContract: number; seasonCount: number; pastSeasons: number; futureSeasons: number; averagePerSeason: number } | null;
  selectedContract: Contract;
  expandedSeasons: Set<string>;
  toggleSeason: (label: string) => void;
}

export function BudgetTab({
  loading,
  financialData,
  budgetStats,
  selectedContract,
  expandedSeasons,
  toggleSeason,
}: BudgetTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!financialData || !budgetStats) {
    return (
      <ChartCard title="">
        <div className="text-center py-12">
          <Euro size={48} className="mx-auto text-ink/25 mb-4" />
          <p className="text-text-secondary">Aucune donnée financière disponible</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <>
      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Budget total contrat" value={`${budgetStats.totalContract.toLocaleString("fr-FR")} €`} icon={Euro} iconColor="text-accent" />
        <StatsCard title={financialData.periodLabel || "Périodes"} value={budgetStats.seasonCount.toString()} icon={Calendar} iconColor="text-accent" />
        <StatsCard title="Moyenne par période" value={`${budgetStats.averagePerSeason.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`} icon={TrendingUp} iconColor="text-green-600" />
        <StatsCard title="Sites" value={(selectedContract._count?.contractSites || 0).toString()} icon={Building2} iconColor="text-ink/60" />
      </div>

      {/* Timeline */}
      <ChartCard title="Répartition budgétaire">
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-600"></div>
            <span className="text-sm text-text-secondary">Passé</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-accent"></div>
            <span className="text-sm text-text-secondary">En cours</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-ink/20"></div>
            <span className="text-sm text-text-secondary">À venir</span>
          </div>
        </div>
        <div className="h-8 bg-ink/5 overflow-hidden flex mb-4">
          {financialData.seasons.map((season, idx) => {
            const width = (season.total / budgetStats.totalContract) * 100;
            return (
              <div
                key={season.label}
                className={`h-full transition-all ${season.isPast ? "bg-green-600" : season.isCurrent ? "bg-accent" : "bg-ink/20"} ${idx > 0 ? "border-l border-white/30" : ""}`}
                style={{ width: `${width}%` }}
                title={`${season.label}: ${season.total.toLocaleString("fr-FR")} €`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-text-secondary">
          <span>{new Date(selectedContract.startDate).toLocaleDateString("fr-FR")}</span>
          <span>{new Date(selectedContract.endDate).toLocaleDateString("fr-FR")}</span>
        </div>
      </ChartCard>

      {/* Seasons */}
      <ChartCard title={`Détail par ${financialData.periodLabel?.toLowerCase() || "période"}`}>
        <div className="space-y-3">
          {financialData.seasons.map((season) => {
            const isExpanded = expandedSeasons.has(season.label);
            return (
              <div key={season.label} className={`border overflow-hidden ${season.isCurrent ? "border-accent" : season.isPast ? "border-green-600/20" : "border-ink/10"}`}>
                <button
                  onClick={() => toggleSeason(season.label)}
                  className={`w-full flex items-center justify-between p-4 transition-colors ${season.isCurrent ? "bg-accent/5 hover:bg-accent/10" : season.isPast ? "bg-green-50 hover:bg-green-50" : "bg-ink/[0.02] hover:bg-ink/5"}`}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={18} className="text-text-secondary" /> : <ChevronRight size={18} className="text-text-secondary" />}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{season.label}</span>
                        {season.isCurrent && <span className="px-2 py-0.5 bg-ink text-paper text-xs">En cours</span>}
                        {season.isPast && <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs border border-green-600/20">Terminée</span>}
                      </div>
                      <span className="text-xs text-text-secondary">
                        {new Date(season.startDate).toLocaleDateString("fr-FR")} → {new Date(season.endDate).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold tabular-nums text-ink">{season.total.toLocaleString("fr-FR")} € HT</p>
                    <p className="text-xs text-text-secondary">
                      {season.totalP2 > 0 && `P2: ${season.totalP2.toLocaleString("fr-FR")} €`}
                      {season.totalP2 > 0 && season.totalP3 > 0 && " | "}
                      {season.totalP3 > 0 && `P3: ${season.totalP3.toLocaleString("fr-FR")} €`}
                    </p>
                  </div>
                </button>
                {isExpanded && season.sites.length > 0 && (
                  <div className="border-t border-ink/10 p-4 bg-white">
                    <p className="label-tech mb-2">Détail par site ({season.sites.length})</p>
                    <div className="space-y-2">
                      {season.sites.map((site) => (
                        <div key={site.siteId} className="flex items-center justify-between border border-ink/10 px-3 py-2">
                          <div className="flex items-center gap-3">
                            <Building2 size={14} className="text-ink/40" />
                            <span className="font-medium text-ink text-sm">{site.siteName}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-medium tabular-nums text-ink">{site.total.toLocaleString("fr-FR")} €</p>
                            <p className="text-xs text-text-secondary">
                              {site.amountP2 > 0 && `P2: ${site.amountP2.toLocaleString("fr-FR")} €`}
                              {site.amountP2 > 0 && site.amountP3 > 0 && " | "}
                              {site.amountP3 > 0 && `P3: ${site.amountP3.toLocaleString("fr-FR")} €`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ChartCard>
    </>
  );
}
