"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import {
  Check,
  Loader2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import type {
  Contract,
  HeatingSeason,
  Site,
} from "@/components/energy/types";

export function CiblesContent({
  contract,
  selectedYear,
  sites,
  onNbUpdate,
}: {
  contract: Contract;
  selectedYear: number;
  sites: Site[];
  onNbUpdate: () => void;
}) {
  const [editingCell, setEditingCell] = useState<{ siteId: string; year: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: allSeasonsData, isLoading: loadingSeasons, mutate: mutateSeasons } = useSWR<HeatingSeason[]>(
    `/api/heating-seasons?contractId=${contract.id}`, fetcher
  );
  const allSeasons = allSeasonsData ?? [];

  const isCivil = contract.yearType === "CIVIL";

  // Calculate contract years
  const getContractYears = () => {
    const startDate = new Date(contract.startDate);
    const endDate = new Date(contract.endDate);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();

    // Calculate contract duration in years (rounded)
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationYears = Math.round(durationMs / (1000 * 60 * 60 * 24 * 365));

    // CIVIL: first period is the contract start year
    // HEATING_SEASON: if contract starts before July, it's that year's season
    const firstSeason = isCivil
      ? startYear
      : startMonth >= 6 ? startYear + 1 : startYear;

    const years: { year: number; season: string; label: string }[] = [];
    for (let i = 0; i < durationYears && i < 10; i++) {
      const seasonYear = firstSeason + i;
      years.push({
        year: i + 1,
        season: isCivil ? `${seasonYear}` : `${seasonYear - 1}-${seasonYear}`,
        label: isCivil ? `${seasonYear}` : `${seasonYear - 1}-${seasonYear}`,
      });
    }
    return years;
  };

  const contractYears = getContractYears();

  // Get NB for a site and season
  const getNbForSiteSeason = (siteId: string, season: string) => {
    const hs = allSeasons.find((s) => s.siteId === siteId && s.season === season);
    return hs?.nb ?? null;
  };

  // Show sites with P1 or intéressement (PFI, MTI, MCI, CPI)
  const INTERESSEMENT_TYPES = ["PFI", "MTI", "MCI", "CPI"];
  const sitesWithEngagement = sites.filter(
    (site) => site.contractSites?.some(
      (cs) => cs.hasP1 || INTERESSEMENT_TYPES.includes(cs.contractType || "")
    )
  );

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
        // Create new — no startDate, that's set in Exploitation > Saisons de chauffe
        // POST requires startDate, so we need to make it optional first
        await fetch("/api/heating-seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId,
            season,
            nb: nbValue,
            nbUnit: "PCS",
          }),
        });
      }

      await mutateSeasons();
      onNbUpdate();
    } catch (error) {
      console.error("Error saving NB:", error);
    } finally {
      setSaving(false);
      setEditingCell(null);
      setEditValue("");
    }
  };

  const currentSeasonKey = isCivil ? `${selectedYear}` : `${selectedYear - 1}-${selectedYear}`;

  if (loadingSeasons) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <>
      <ChartCard>
        <div className="overflow-x-auto -mx-4 -my-4">
          <table className="w-full">
            <thead className="border-b border-ink/10">
              <tr>
                <th className="label-tech text-left px-4 py-2 sticky left-0 bg-white z-10">
                  Site
                </th>
                {contractYears.map((cy) => (
                  <th
                    key={cy.year}
                    className={`label-tech text-center px-4 py-2 min-w-[100px] ${
                      cy.season === currentSeasonKey ? "bg-accent/5 text-accent" : ""
                    }`}
                  >
                    <div>Année {cy.year}</div>
                    <div className="text-[10px] normal-case tracking-normal">{cy.season}</div>
                  </th>
                ))}
                <th className="label-tech text-center px-4 py-2">
                  Évolution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {sitesWithEngagement.map((site) => {
                const year1Nb = getNbForSiteSeason(site.id, contractYears[0]?.season);
                const lastYearWithNb = [...contractYears].reverse().find((cy) => getNbForSiteSeason(site.id, cy.season));
                const lastNb = lastYearWithNb ? getNbForSiteSeason(site.id, lastYearWithNb.season) : null;
                const evolution = year1Nb && lastNb ? ((year1Nb - lastNb) / year1Nb) * 100 : null;

                return (
                  <tr key={site.id} className="hover:bg-ink/[0.02]">
                    <td className="px-4 py-2 sticky left-0 bg-white z-10">
                      <p className="font-medium text-ink text-sm">{site.name}</p>
                    </td>
                    {contractYears.map((cy) => {
                      const nb = getNbForSiteSeason(site.id, cy.season);
                      const isEditing = editingCell?.siteId === site.id && editingCell?.year === cy.year;
                      const isCurrent = cy.season === currentSeasonKey;

                      return (
                        <td
                          key={cy.year}
                          className={`px-4 py-1.5 text-center ${isCurrent ? "bg-accent/5" : ""}`}
                        >
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 border border-ink/20 bg-white px-2 py-1 font-mono text-sm tabular-nums text-center focus:border-accent focus:outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(site.id, cy.season);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                              />
                              <button
                                onClick={() => saveEdit(site.id, cy.season)}
                                disabled={saving}
                                className="p-1 text-green-700 hover:bg-green-50"
                              >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-ink/40 hover:bg-ink/[0.04] hover:text-ink"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(site.id, cy.year, cy.season)}
                              className={`px-3 py-1 font-mono text-sm tabular-nums transition-colors min-w-[60px] ${
                                nb
                                  ? "text-ink font-medium hover:bg-ink/[0.04] hover:text-accent"
                                  : "text-ink/30 hover:bg-ink/[0.04]"
                              }`}
                            >
                              {nb ? nb.toLocaleString("fr-FR") : "-"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-center">
                      {evolution !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums font-medium ${
                            evolution >= 0 ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {evolution >= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                          {evolution >= 0 ? "-" : "+"}
                          {Math.abs(evolution).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-ink/30 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-ink/15">
              <tr>
                <td className="px-4 py-2 label-tech text-ink sticky left-0 bg-white z-10">
                  TOTAL
                </td>
                {contractYears.map((cy) => {
                  const total = sitesWithEngagement.reduce((sum, site) => {
                    const nb = getNbForSiteSeason(site.id, cy.season);
                    return sum + (nb || 0);
                  }, 0);
                  const isCurrent = cy.season === currentSeasonKey;

                  return (
                    <td
                      key={cy.year}
                      className={`px-4 py-2 text-center font-mono text-sm tabular-nums font-semibold ${
                        isCurrent ? "bg-accent/5 text-accent" : "text-ink"
                      }`}
                    >
                      {total > 0 ? total.toLocaleString("fr-FR") : "-"}
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-center">
                  {(() => {
                    const year1Total = sitesWithEngagement.reduce((sum, site) => sum + (getNbForSiteSeason(site.id, contractYears[0]?.season) || 0), 0);
                    const lastYearWithTotal = [...contractYears].reverse().find((cy) =>
                      sitesWithEngagement.some((site) => getNbForSiteSeason(site.id, cy.season) !== null)
                    );
                    const lastTotal = lastYearWithTotal
                      ? sitesWithEngagement.reduce((sum, site) => sum + (getNbForSiteSeason(site.id, lastYearWithTotal.season) || 0), 0)
                      : 0;
                    const evolution = year1Total > 0 && lastTotal > 0
                      ? ((year1Total - lastTotal) / year1Total) * 100
                      : null;

                    return evolution !== null ? (
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums font-bold ${
                          evolution >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {evolution >= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                        {evolution >= 0 ? "-" : "+"}
                        {Math.abs(evolution).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-ink/30 text-xs">-</span>
                    );
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ChartCard>
    </>
  );
}
