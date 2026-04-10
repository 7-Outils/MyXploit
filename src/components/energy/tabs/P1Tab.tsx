"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  Building2,
  Check,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import type {
  AnalyticsData,
  Contract,
  HeatingSeason,
  Site,
} from "@/components/energy/types";
import { SITE_TYPE_LABELS } from "@/components/energy/constants";

export function P1Content({
  contract,
  selectedYear,
  sites,
  heatingSeasons,
  onNbUpdate,
}: {
  contract: Contract;
  selectedYear: number;
  sites: Site[];
  heatingSeasons: HeatingSeason[];
  onNbUpdate: () => void;
}) {
  const [editingCell, setEditingCell] = useState<{ siteId: string; year: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [allSeasons, setAllSeasons] = useState<HeatingSeason[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);

  // Calculate contract years
  const getContractYears = () => {
    const startDate = new Date(contract.startDate);
    const endDate = new Date(contract.endDate);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();

    // Calculate contract duration in years (rounded)
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationYears = Math.round(durationMs / (1000 * 60 * 60 * 24 * 365));

    // First heating season: if contract starts before July (month < 6),
    // season ends that year. Otherwise, season ends next year.
    const firstSeason = startMonth >= 6 ? startYear + 1 : startYear;

    const years: { year: number; season: string }[] = [];
    // Limit to actual contract duration
    for (let i = 0; i < durationYears && i < 10; i++) {
      const seasonYear = firstSeason + i;
      years.push({
        year: i + 1,
        season: `${seasonYear - 1}-${seasonYear}`,
      });
    }
    return years;
  };

  const contractYears = getContractYears();

  // Fetch all heating seasons for the contract
  useEffect(() => {
    const fetchAllSeasons = async () => {
      setLoadingSeasons(true);
      try {
        const res = await fetch(`/api/heating-seasons?contractId=${contract.id}`);
        if (res.ok) {
          const data = await res.json();
          setAllSeasons(data);
        }
      } catch (error) {
        console.error("Error fetching heating seasons:", error);
      } finally {
        setLoadingSeasons(false);
      }
    };
    fetchAllSeasons();
  }, [contract.id]);

  // Get NB for a site and season
  const getNbForSiteSeason = (siteId: string, season: string) => {
    const hs = allSeasons.find((s) => s.siteId === siteId && s.season === season);
    return hs?.nb ?? null;
  };

  // Show all sites — user can fill in NB values manually even without an AE import
  const sitesWithEngagement = sites;

  // Calculate KPIs
  const calculateKpis = () => {
    // Get year 1 NB total (reference)
    const year1Season = contractYears[0]?.season;
    let year1Total = 0;
    let currentYearTotal = 0;
    let sitesWithNb = 0;

    // Find current year's season
    const currentSeason = `${selectedYear - 1}-${selectedYear}`;

    sites.forEach((site) => {
      const year1Nb = getNbForSiteSeason(site.id, year1Season);
      const currentNb = getNbForSiteSeason(site.id, currentSeason);

      if (year1Nb) year1Total += year1Nb;
      if (currentNb) {
        currentYearTotal += currentNb;
        sitesWithNb++;
      }
    });

    // APE = (NB Année 1 - NB Année N) / NB Année 1 * 100
    const apeProgress = year1Total > 0 ? ((year1Total - currentYearTotal) / year1Total) * 100 : 0;
    const savings = year1Total - currentYearTotal;

    return {
      year1Total,
      currentYearTotal,
      apeProgress,
      savings,
      sitesWithNb,
      totalSites: sites.length,
    };
  };

  const kpis = calculateKpis();

  // Handle inline edit
  const startEdit = (siteId: string, year: number, season: string) => {
    const currentValue = getNbForSiteSeason(siteId, season);
    setEditingCell({ siteId, year });
    setEditValue(currentValue?.toString() || "");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const saveEdit = async (siteId: string, season: string) => {
    setSaving(true);
    try {
      const nbValue = editValue ? parseFloat(editValue) : null;
      const existing = allSeasons.find((s) => s.siteId === siteId && s.season === season);

      if (existing) {
        // Update existing
        await fetch(`/api/heating-seasons/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nb: nbValue }),
        });
      } else if (nbValue !== null) {
        // Create new
        const [startYear] = season.split("-").map(Number);
        await fetch("/api/heating-seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId,
            season,
            startDate: new Date(startYear, 6, 1).toISOString(), // July 1st
            nb: nbValue,
            nbUnit: "PCS",
          }),
        });
      }

      // Refresh data
      const res = await fetch(`/api/heating-seasons?contractId=${contract.id}`);
      if (res.ok) {
        setAllSeasons(await res.json());
      }
      onNbUpdate();
    } catch (error) {
      console.error("Error saving NB:", error);
    } finally {
      setSaving(false);
      setEditingCell(null);
      setEditValue("");
    }
  };

  // Current year index
  const currentYearIndex = contractYears.findIndex((y) => y.season === `${selectedYear - 1}-${selectedYear}`);

  if (loadingSeasons) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Header with Import Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-primary-dark flex items-center gap-2">
            <Award className="text-amber-500" size={24} />
            Cibles énergétiques
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Niveaux de Base (NB) par site et par année — cliquez sur une cellule pour renseigner ou modifier une valeur
          </p>
        </div>
      </div>

      {/* KPIs Section */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target size={20} className="text-amber-600" />
            <span className="text-sm font-medium text-amber-700">NB Année 1</span>
          </div>
          <p className="text-3xl font-bold text-amber-900">
            {kpis.year1Total > 0 ? kpis.year1Total.toLocaleString("fr-FR") : "-"}
          </p>
          <p className="text-xs text-amber-600 mt-1">MWh PCS (référence)</p>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BarChart3 size={20} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-700">NB Année {currentYearIndex + 1 || "-"}</span>
          </div>
          <p className="text-3xl font-bold text-blue-900">
            {kpis.currentYearTotal > 0 ? kpis.currentYearTotal.toLocaleString("fr-FR") : "-"}
          </p>
          <p className="text-xs text-blue-600 mt-1">MWh PCS (saison {selectedYear - 1}/{selectedYear})</p>
        </div>

        <div className={`rounded-xl p-4 text-center ${kpis.apeProgress >= 0 ? "bg-green-50" : "bg-red-50"}`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            {kpis.apeProgress >= 0 ? (
              <TrendingDown size={20} className="text-green-600" />
            ) : (
              <TrendingUp size={20} className="text-red-600" />
            )}
            <span className={`text-sm font-medium ${kpis.apeProgress >= 0 ? "text-green-700" : "text-red-700"}`}>
              APE Cumulée
            </span>
          </div>
          <p className={`text-3xl font-bold ${kpis.apeProgress >= 0 ? "text-green-900" : "text-red-900"}`}>
            {kpis.year1Total > 0 ? `${kpis.apeProgress >= 0 ? "-" : "+"}${Math.abs(kpis.apeProgress).toFixed(1)}%` : "-"}
          </p>
          <p className={`text-xs mt-1 ${kpis.apeProgress >= 0 ? "text-green-600" : "text-red-600"}`}>
            {kpis.savings > 0 ? `${kpis.savings.toLocaleString("fr-FR")} MWh économisés` : kpis.savings < 0 ? `${Math.abs(kpis.savings).toLocaleString("fr-FR")} MWh en plus` : "vs Année 1"}
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Sites suivis</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{kpis.sitesWithNb}</p>
          <p className="text-xs text-gray-600 mt-1">sur {kpis.totalSites} sites du contrat</p>
        </div>
      </div>

      {/* Multi-year NB Table */}
      <ChartCard title="Niveaux de Base par site et par année" subtitle="Cliquez sur une cellule pour modifier la valeur">
        <div className="overflow-x-auto -mx-6 -my-6">
          <table className="w-full">
            <thead className="bg-background-secondary border-b border-gray-100">
              <tr>
                <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3 sticky left-0 bg-background-secondary z-10">
                  Site
                </th>
                {contractYears.map((cy) => (
                  <th
                    key={cy.year}
                    className={`text-center text-xs font-medium uppercase tracking-wider px-4 py-3 min-w-[100px] ${
                      cy.season === `${selectedYear - 1}-${selectedYear}`
                        ? "bg-primary/10 text-primary"
                        : "text-text-secondary"
                    }`}
                  >
                    <div>Année {cy.year}</div>
                    <div className="text-[10px] font-normal normal-case">{cy.season}</div>
                  </th>
                ))}
                <th className="text-center text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">
                  Évolution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sitesWithEngagement.map((site) => {
                const year1Nb = getNbForSiteSeason(site.id, contractYears[0]?.season);
                const lastYearWithNb = [...contractYears].reverse().find((cy) => getNbForSiteSeason(site.id, cy.season));
                const lastNb = lastYearWithNb ? getNbForSiteSeason(site.id, lastYearWithNb.season) : null;
                const evolution = year1Nb && lastNb ? ((year1Nb - lastNb) / year1Nb) * 100 : null;

                return (
                  <tr key={site.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 sticky left-0 bg-white z-10">
                      <p className="font-medium text-primary-dark text-sm">{site.name}</p>
                    </td>
                    {contractYears.map((cy) => {
                      const nb = getNbForSiteSeason(site.id, cy.season);
                      const isEditing = editingCell?.siteId === site.id && editingCell?.year === cy.year;
                      const isCurrent = cy.season === `${selectedYear - 1}-${selectedYear}`;

                      return (
                        <td
                          key={cy.year}
                          className={`px-4 py-2 text-center ${isCurrent ? "bg-primary/5" : ""}`}
                        >
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 px-2 py-1 text-sm border rounded text-center"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(site.id, cy.season);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                              />
                              <button
                                onClick={() => saveEdit(site.id, cy.season)}
                                disabled={saving}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                              >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(site.id, cy.year, cy.season)}
                              className={`px-3 py-1 rounded transition-colors min-w-[60px] ${
                                nb
                                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                  : "text-gray-400 hover:bg-gray-100"
                              }`}
                            >
                              {nb ? nb.toLocaleString("fr-FR") : "-"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      {evolution !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                            evolution >= 0
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {evolution >= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                          {evolution >= 0 ? "-" : "+"}
                          {Math.abs(evolution).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td className="px-4 py-3 font-semibold text-primary-dark sticky left-0 bg-gray-50 z-10">
                  TOTAL
                </td>
                {contractYears.map((cy) => {
                  const total = sites.reduce((sum, site) => {
                    const nb = getNbForSiteSeason(site.id, cy.season);
                    return sum + (nb || 0);
                  }, 0);
                  const isCurrent = cy.season === `${selectedYear - 1}-${selectedYear}`;

                  return (
                    <td
                      key={cy.year}
                      className={`px-4 py-3 text-center font-semibold ${
                        isCurrent ? "bg-primary/10 text-primary" : "text-primary-dark"
                      }`}
                    >
                      {total > 0 ? total.toLocaleString("fr-FR") : "-"}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center">
                  {kpis.apeProgress !== 0 && kpis.year1Total > 0 ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                        kpis.apeProgress >= 0
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {kpis.apeProgress >= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                      {kpis.apeProgress >= 0 ? "-" : "+"}
                      {Math.abs(kpis.apeProgress).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ChartCard>

      {/* Help Text */}
      <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="text-blue-500 mt-0.5 flex-shrink-0" size={18} />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Comment renseigner les cibles ?</p>
          <p className="text-blue-700">
            Cliquez directement sur une cellule du tableau pour saisir le NB (Niveau de Base) d&apos;un site pour une année donnée.
            Les valeurs peuvent être importées depuis l&apos;AE ou renseignées manuellement. Le NB est exprimé en MWh PCS et représente
            l&apos;objectif contractuel de consommation. La consommation réelle (NC) est comparée au NB corrigé climatiquement (N&apos;B)
            pour évaluer la performance.
          </p>
        </div>
      </div>
    </>
  );
}
