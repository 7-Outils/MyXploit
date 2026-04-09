"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartCard } from "@/components/dashboard/chart-card";
import {
  TelereleveBuildingChart,
  type Frequency,
  type SiteSummary,
} from "@/components/energy/TelereleveBuildingChart";
import { ClimateCorrectedChart } from "@/components/energy/ClimateCorrectedChart";

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FREQUENCY_ORDER: Frequency[] = ["hour", "day", "week", "month", "year"];
const FREQUENCY_LABELS: Record<Frequency, string> = {
  hour: "Horaire",
  day: "Journalière",
  week: "Hebdomadaire",
  month: "Mensuelle",
  year: "Annuelle",
};

/**
 * TelereleveChartsSection — Wrapper that owns the *shared* state between the
 * raw GRDF / Enedis chart (TelereleveBuildingChart) and the climate-corrected
 * performance chart (ClimateCorrectedChart) below it:
 *
 *   - The list of sites of the contract that have a PCE/PDL configured
 *   - The currently selected site
 *   - The date range
 *
 * The two charts are siblings, not parent/child, so when the user switches
 * building or picks a new date preset on the upper chart, the lower chart
 * follows automatically.
 */

interface Props {
  contractId: string;
}

function todayIso(): string {
  // Use local date to avoid the UTC-vs-local off-by-one in Paris winter
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfCurrentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function TelereleveChartsSection({ contractId }: Props) {
  // ─── Sites of the contract that have a PCE/PDL ──────────────────────
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingSites(true);
    fetch(`/api/contracts/${contractId}/sites`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SiteSummary[]) => {
        if (cancelled) return;
        const withMeter = (data || []).filter(
          (s) => s.pce !== null || s.pdl !== null
        );
        setSites(withMeter);
      })
      .catch(() => {
        if (!cancelled) setSites([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSites(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  // ─── Shared state — selected site + date range + frequency ─────────
  // Default to "this month so far" with monthly frequency — both charts
  // share these so the user only ever picks them once.
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>(startOfCurrentMonthIso());
  const [dateTo, setDateTo] = useState<string>(todayIso());
  const [frequency, setFrequency] = useState<Frequency>("month");
  // Reported by the GRDF chart based on the actual data shape — used to
  // disable frequency options finer than what's available.
  const [naturalGranularity, setNaturalGranularity] =
    useState<Frequency>("day");

  const handleNaturalGranularity = useCallback((g: Frequency) => {
    setNaturalGranularity(g);
    // If the user previously picked something finer, bump it up
    setFrequency((prev) =>
      FREQUENCY_ORDER.indexOf(prev) < FREQUENCY_ORDER.indexOf(g) ? g : prev
    );
  }, []);

  // ─── Date preset definitions (used for both buttons and active state) ─
  const datePresets = useMemo(
    () => [
      { id: "this-month", label: "Ce mois", from: startOfCurrentMonthIso() },
      { id: "30d", label: "30 j", from: daysAgoIso(30) },
      { id: "90d", label: "90 j", from: daysAgoIso(90) },
      { id: "1y", label: "1 an", from: daysAgoIso(365) },
      { id: "3y", label: "3 ans", from: daysAgoIso(365 * 3) },
    ],
    []
  );

  const today = todayIso();
  const activePresetId = useMemo(() => {
    if (dateTo !== today) return null;
    return datePresets.find((p) => p.from === dateFrom)?.id ?? null;
  }, [dateFrom, dateTo, today, datePresets]);

  // Auto-select the first site once the list is loaded
  useEffect(() => {
    if (selectedSiteId === null && sites.length > 0) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || null,
    [sites, selectedSiteId]
  );

  // ─── Loading / empty states for the contract's site list ────────────
  if (loadingSites) {
    return (
      <ChartCard title="Suivi télérelevé" subtitle="Données du distributeur">
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-accent" />
        </div>
      </ChartCard>
    );
  }

  if (sites.length === 0) {
    return (
      <ChartCard title="Suivi télérelevé" subtitle="Données du distributeur">
        <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
          <Wifi size={32} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">
            Aucun site avec un PCE ou PDL configuré sur ce contrat
          </p>
          <p className="text-xs text-gray-500 mt-1 text-center max-w-md">
            Renseignez le PCE (gaz) ou le PDL (électricité) sur la fiche
            de chaque bâtiment pour activer la télérelève.
          </p>
        </div>
      </ChartCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shared toolbar — building + frequency + date range + presets.
          Everything that affects BOTH charts lives here, so the user
          only ever picks them once. */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[260px]">
          <label className="text-xs font-medium text-text-secondary">
            Bâtiment
          </label>
          <select
            value={selectedSiteId || ""}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.pce ? ` · PCE ${s.pce}` : ""}
                {s.pdl ? ` · PDL ${s.pdl}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">
            Fréquence
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            {FREQUENCY_ORDER.map((f) => {
              const isFinerThanData =
                FREQUENCY_ORDER.indexOf(f) <
                FREQUENCY_ORDER.indexOf(naturalGranularity);
              return (
                <option key={f} value={f} disabled={isFinerThanData}>
                  {FREQUENCY_LABELS[f]}
                  {isFinerThanData ? " (non disponible)" : ""}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Du</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Au</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={today}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          />
        </div>

        <div className="flex gap-1">
          {datePresets.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  setDateFrom(preset.from);
                  setDateTo(today);
                }}
                className={cn(
                  "px-2.5 py-2 rounded-lg border text-xs transition-colors",
                  isActive
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2-column layout on desktop (≥ xl). Stacks on smaller screens.
          min-w-0 on each child prevents inner content from pushing one
          column past 50%. items-stretch keeps the two cards at the
          same height (no more visually unbalanced rows). */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        <div className="min-w-0 flex">
          <TelereleveBuildingChart
            sites={sites}
            selectedSiteId={selectedSiteId}
            dateFrom={dateFrom}
            dateTo={dateTo}
            frequency={frequency}
            onNaturalGranularityChange={handleNaturalGranularity}
          />
        </div>

        {selectedSite && (
          <div className="min-w-0 flex">
            <ClimateCorrectedChart
              siteId={selectedSite.id}
              siteName={selectedSite.name}
              dateFrom={dateFrom}
              dateTo={dateTo}
            />
          </div>
        )}
      </div>
    </div>
  );
}
