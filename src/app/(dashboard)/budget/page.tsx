"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Loader2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Euro,
  TrendingUp,
  Building2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  status: string;
  startDate: string;
  endDate: string;
  _count?: {
    contractSites: number;
  };
}

interface SeasonSite {
  siteId: string;
  siteName: string;
  amountP2: number;
  amountP3: number;
  total: number;
}

interface Season {
  label: string;
  startDate: string;
  endDate: string;
  totalP2: number;
  totalP3: number;
  total: number;
  sites: SeasonSite[];
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
}

interface FinancialSummary {
  currentSeasonLabel: string;
  currentSeasonTotal: number;
  currentSeasonPaid: number;
  currentSeasonRemaining: number;
  totalPastSeasons: number;
  totalFutureSeasons: number;
  totalContract: number;
  seasonCount: number;
}

interface FinancialData {
  contract?: {
    id: string;
    reference: string;
    title: string;
    startDate: string;
    endDate: string;
    yearType?: "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";
  };
  summary: FinancialSummary;
  seasons: Season[];
  periodLabel?: string;
}

export default function BudgetPage() {
  // Contract selection
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [loadingContracts, setLoadingContracts] = useState(true);

  // Financial data
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);

  // UI state
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());

  // Fetch contracts on mount
  useEffect(() => {
    fetchContracts();
  }, []);

  // Fetch financials when contract selected
  useEffect(() => {
    if (selectedContract) {
      fetchFinancials(selectedContract.id);
    }
  }, [selectedContract]);

  const fetchContracts = async () => {
    try {
      setLoadingContracts(true);
      const response = await fetch("/api/contracts");
      if (response.ok) {
        const data = await response.json();
        setContracts(data.filter((c: Contract) => c.status === "ACTIF"));
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setLoadingContracts(false);
    }
  };

  const fetchFinancials = async (contractId: string) => {
    try {
      setLoadingFinancials(true);
      const response = await fetch(`/api/contracts/${contractId}/financials`);
      if (response.ok) {
        const data = await response.json();
        setFinancialData(data);
        // Expand current season by default
        const currentSeason = data.seasons?.find((s: Season) => s.isCurrent);
        if (currentSeason) {
          setExpandedSeasons(new Set([currentSeason.label]));
        }
      }
    } catch (error) {
      console.error("Error fetching financials:", error);
    } finally {
      setLoadingFinancials(false);
    }
  };

  const toggleSeason = (label: string) => {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  // Stats
  const stats = useMemo(() => {
    if (!financialData) return null;
    const { summary, seasons } = financialData;
    const pastSeasons = seasons.filter((s) => s.isPast).length;
    const futureSeasons = seasons.filter((s) => s.isFuture).length;
    return {
      totalContract: summary.totalContract,
      seasonCount: summary.seasonCount,
      pastSeasons,
      futureSeasons,
      averagePerSeason: summary.seasonCount > 0 ? summary.totalContract / summary.seasonCount : 0,
    };
  }, [financialData]);

  // Loading contracts
  if (loadingContracts) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // No contract selected
  if (!selectedContract) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Budget</h1>
          <p className="text-text-secondary">Vue analytique des budgets par contrat</p>
        </div>

        {contracts.length === 0 ? (
          <ChartCard title="Aucun contrat actif">
            <div className="flex flex-col items-center justify-center py-8">
              <FileText size={48} className="text-gray-300 mb-4" />
              <p className="text-text-secondary">Créez d&apos;abord un contrat</p>
            </div>
          </ChartCard>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contracts.map((contract) => (
              <button
                key={contract.id}
                onClick={() => setSelectedContract(contract)}
                className="bg-white rounded-xl border border-gray-100 p-6 text-left hover:border-accent hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                    <FileText size={24} className="text-accent" />
                  </div>
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    Actif
                  </span>
                </div>
                <h3 className="font-semibold text-primary-dark mb-1">{contract.reference}</h3>
                <p className="text-sm text-text-secondary mb-3 line-clamp-1">{contract.title}</p>
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {contract.provider}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 size={14} />
                    {contract._count?.contractSites || 0} sites
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Contract selected - show budget
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => {
                setSelectedContract(null);
                setFinancialData(null);
              }}
              className="text-text-secondary hover:text-primary-dark"
            >
              Budget
            </button>
            <span className="text-text-secondary">/</span>
            <span className="text-primary-dark font-medium">{selectedContract.reference}</span>
          </div>
          <h1 className="text-2xl font-bold text-primary-dark">{selectedContract.title}</h1>
          <p className="text-text-secondary">{selectedContract.provider}</p>
        </div>
        <div>
          <select
            value={selectedContract.id}
            onChange={(e) => {
              const contract = contracts.find((c) => c.id === e.target.value);
              if (contract) setSelectedContract(contract);
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference} - {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadingFinancials ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : financialData && stats ? (
        <>
          {/* Summary Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Budget total contrat"
              value={`${stats.totalContract.toLocaleString("fr-FR")} €`}
              icon={Euro}
              iconColor="text-accent"
            />
            <StatsCard
              title={financialData.periodLabel || "Périodes"}
              value={stats.seasonCount.toString()}
              icon={Calendar}
              iconColor="text-blue-600"
            />
            <StatsCard
              title="Moyenne par période"
              value={`${stats.averagePerSeason.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}
              icon={TrendingUp}
              iconColor="text-green-600"
            />
            <StatsCard
              title="Sites"
              value={(selectedContract._count?.contractSites || 0).toString()}
              icon={Building2}
              iconColor="text-purple-600"
            />
          </div>

          {/* Timeline visualization */}
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

            {/* Progress bar */}
            <div className="h-8 bg-gray-100 rounded-full overflow-hidden flex mb-4">
              {financialData.seasons.map((season, idx) => {
                const width = (season.total / stats.totalContract) * 100;
                return (
                  <div
                    key={season.label}
                    className={`h-full transition-all ${
                      season.isPast
                        ? "bg-green-500"
                        : season.isCurrent
                        ? "bg-accent"
                        : "bg-blue-400"
                    } ${idx > 0 ? "border-l border-white/30" : ""}`}
                    style={{ width: `${width}%` }}
                    title={`${season.label}: ${season.total.toLocaleString("fr-FR")} €`}
                  />
                );
              })}
            </div>

            {/* Labels */}
            <div className="flex justify-between text-xs text-text-secondary">
              <span>{new Date(selectedContract.startDate).toLocaleDateString("fr-FR")}</span>
              <span>{new Date(selectedContract.endDate).toLocaleDateString("fr-FR")}</span>
            </div>
          </ChartCard>

          {/* Seasons breakdown */}
          <ChartCard title={`Détail par ${financialData.periodLabel?.toLowerCase() || "période"}`}>
            <div className="space-y-3">
              {financialData.seasons.map((season) => {
                const isExpanded = expandedSeasons.has(season.label);
                return (
                  <div
                    key={season.label}
                    className={`border rounded-xl overflow-hidden ${
                      season.isCurrent
                        ? "border-accent"
                        : season.isPast
                        ? "border-green-200"
                        : "border-gray-200"
                    }`}
                  >
                    {/* Season header */}
                    <button
                      onClick={() => toggleSeason(season.label)}
                      className={`w-full flex items-center justify-between p-4 transition-colors ${
                        season.isCurrent
                          ? "bg-accent/5 hover:bg-accent/10"
                          : season.isPast
                          ? "bg-green-50/50 hover:bg-green-50"
                          : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown size={18} className="text-text-secondary" />
                        ) : (
                          <ChevronRight size={18} className="text-text-secondary" />
                        )}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary-dark">{season.label}</span>
                            {season.isCurrent && (
                              <span className="px-2 py-0.5 bg-accent text-white text-xs rounded-full">
                                En cours
                              </span>
                            )}
                            {season.isPast && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                Terminée
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-text-secondary">
                            {new Date(season.startDate).toLocaleDateString("fr-FR")} →{" "}
                            {new Date(season.endDate).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary-dark">
                          {season.total.toLocaleString("fr-FR")} € HT
                        </p>
                        <p className="text-xs text-text-secondary">
                          {season.totalP2 > 0 && `P2: ${season.totalP2.toLocaleString("fr-FR")} €`}
                          {season.totalP2 > 0 && season.totalP3 > 0 && " | "}
                          {season.totalP3 > 0 && `P3: ${season.totalP3.toLocaleString("fr-FR")} €`}
                        </p>
                      </div>
                    </button>

                    {/* Sites detail */}
                    {isExpanded && season.sites.length > 0 && (
                      <div className="border-t border-gray-100 p-4 bg-white">
                        <p className="text-xs font-medium text-text-secondary mb-3">
                          Détail par site ({season.sites.length})
                        </p>
                        <div className="space-y-2">
                          {season.sites.map((site) => (
                            <div
                              key={site.siteId}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                                  <Building2 size={14} className="text-accent" />
                                </div>
                                <span className="font-medium text-primary-dark text-sm">
                                  {site.siteName}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-primary-dark text-sm">
                                  {site.total.toLocaleString("fr-FR")} €
                                </p>
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
      ) : (
        <ChartCard title="">
          <div className="text-center py-12">
            <Euro size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-text-secondary">Aucune donnée financière disponible</p>
          </div>
        </ChartCard>
      )}
    </div>
  );
}
