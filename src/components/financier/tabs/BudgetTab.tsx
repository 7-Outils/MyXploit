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
          <Euro size={48} className="mx-auto text-gray-300 mb-4" />
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
        <StatsCard title={financialData.periodLabel || "Périodes"} value={budgetStats.seasonCount.toString()} icon={Calendar} iconColor="text-blue-600" />
        <StatsCard title="Moyenne par période" value={`${budgetStats.averagePerSeason.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`} icon={TrendingUp} iconColor="text-green-600" />
        <StatsCard title="Sites" value={(selectedContract._count?.contractSites || 0).toString()} icon={Building2} iconColor="text-purple-600" />
      </div>

      {/* Timeline */}
      <ChartCard title="Répartition budgétaire">
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-sm text-text-secondary">Passé</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-accent"></div>
            <span className="text-sm text-text-secondary">En cours</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-400"></div>
            <span className="text-sm text-text-secondary">À venir</span>
          </div>
        </div>
        <div className="h-8 bg-gray-100 rounded-full overflow-hidden flex mb-4">
          {financialData.seasons.map((season, idx) => {
            const width = (season.total / budgetStats.totalContract) * 100;
            return (
              <div
                key={season.label}
                className={`h-full transition-all ${season.isPast ? "bg-green-500" : season.isCurrent ? "bg-accent" : "bg-blue-400"} ${idx > 0 ? "border-l border-white/30" : ""}`}
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
              <div key={season.label} className={`border rounded-xl overflow-hidden ${season.isCurrent ? "border-accent" : season.isPast ? "border-green-200" : "border-gray-200"}`}>
                <button
                  onClick={() => toggleSeason(season.label)}
                  className={`w-full flex items-center justify-between p-4 transition-colors ${season.isCurrent ? "bg-accent/5 hover:bg-accent/10" : season.isPast ? "bg-green-50/50 hover:bg-green-50" : "bg-gray-50 hover:bg-gray-100"}`}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={18} className="text-text-secondary" /> : <ChevronRight size={18} className="text-text-secondary" />}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary-dark">{season.label}</span>
                        {season.isCurrent && <span className="px-2 py-0.5 bg-accent text-white text-xs rounded-full">En cours</span>}
                        {season.isPast && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Terminée</span>}
                      </div>
                      <span className="text-xs text-text-secondary">
                        {new Date(season.startDate).toLocaleDateString("fr-FR")} → {new Date(season.endDate).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-dark">{season.total.toLocaleString("fr-FR")} € HT</p>
                    <p className="text-xs text-text-secondary">
                      {season.totalP2 > 0 && `P2: ${season.totalP2.toLocaleString("fr-FR")} €`}
                      {season.totalP2 > 0 && season.totalP3 > 0 && " | "}
                      {season.totalP3 > 0 && `P3: ${season.totalP3.toLocaleString("fr-FR")} €`}
                    </p>
                  </div>
                </button>
                {isExpanded && season.sites.length > 0 && (
                  <div className="border-t border-gray-100 p-4 bg-white">
                    <p className="text-xs font-medium text-text-secondary mb-3">Détail par site ({season.sites.length})</p>
                    <div className="space-y-2">
                      {season.sites.map((site) => (
                        <div key={site.siteId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                              <Building2 size={14} className="text-accent" />
                            </div>
                            <span className="font-medium text-primary-dark text-sm">{site.siteName}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-primary-dark text-sm">{site.total.toLocaleString("fr-FR")} €</p>
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
