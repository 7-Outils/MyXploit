"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import {
  ConsumptionTimeChart,
  type ConsumptionPoint,
} from "@/components/dashboard/consumption-time-chart";
import { cn } from "@/lib/utils";
import type { ConsumptionRecord } from "@/components/buildings/types";
import { ENERGY_COLORS, ENERGY_LABELS } from "@/components/buildings/constants";

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export function EnergyTab({ siteId }: { siteId: string }) {
  const [consumptions, setConsumptions] = useState<ConsumptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>(daysAgoIso(90));
  const [dateTo, setDateTo] = useState<string>(todayIso());
  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/consumptions?siteId=${siteId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Erreur de chargement des consommations");
        return r.json();
      })
      .then((data: ConsumptionRecord[]) => {
        if (cancelled) return;
        // Only keep exploitant data (manually imported with a meterName).
        // Raw GRDF/Enedis sync data has meterName === null and lives in
        // the Télérelève tab, not here.
        setConsumptions(data.filter((c) => c.meterName !== null));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  // Available energy types in this site's exploitant data
  const availableEnergies = useMemo(() => {
    const set = new Set<string>();
    consumptions.forEach((c) => set.add(c.energyType));
    return Array.from(set).sort();
  }, [consumptions]);

  // Default selected energy when data first loads
  useEffect(() => {
    if (selectedEnergy === null && availableEnergies.length > 0) {
      // Prefer GAZ, then ELECTRICITE, otherwise first available
      const preferred = availableEnergies.includes("GAZ")
        ? "GAZ"
        : availableEnergies.includes("ELECTRICITE")
        ? "ELECTRICITE"
        : availableEnergies[0];
      setSelectedEnergy(preferred);
    }
  }, [availableEnergies, selectedEnergy]);

  // Filtered records (energy type + date range)
  const filtered = useMemo(() => {
    if (!selectedEnergy) return [];
    const fromTs = new Date(dateFrom).getTime();
    const toTs = new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1;
    return consumptions.filter((c) => {
      if (c.energyType !== selectedEnergy) return false;
      const t = new Date(c.period).getTime();
      return t >= fromTs && t <= toTs;
    });
  }, [consumptions, selectedEnergy, dateFrom, dateTo]);

  // Convert to chart format
  const chartData: ConsumptionPoint[] = useMemo(
    () =>
      filtered
        .map((c) => ({ date: c.period, kwh: c.quantity }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [filtered]
  );

  // KPIs
  const totals = useMemo(() => {
    const total = filtered.reduce((acc, c) => acc + c.quantity, 0);
    const cost = filtered.reduce((acc, c) => acc + (c.cost || 0), 0);
    return { total, cost };
  }, [filtered]);

  // YoY comparison: same period one year ago
  const yoyDelta = useMemo(() => {
    if (!selectedEnergy || filtered.length === 0) return null;
    const fromTs = new Date(dateFrom).getTime() - 365 * 24 * 60 * 60 * 1000;
    const toTs = new Date(dateTo).getTime() - 365 * 24 * 60 * 60 * 1000;
    const lastYear = consumptions
      .filter((c) => c.energyType === selectedEnergy)
      .filter((c) => {
        const t = new Date(c.period).getTime();
        return t >= fromTs && t <= toTs + 24 * 60 * 60 * 1000 - 1;
      })
      .reduce((acc, c) => acc + c.quantity, 0);
    if (lastYear === 0) return null;
    return Math.round(((totals.total - lastYear) / lastYear) * 100);
  }, [consumptions, selectedEnergy, dateFrom, dateTo, totals.total, filtered.length]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-accent mb-3" />
        <p className="text-sm text-ink/60">
          Chargement des consommations...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BarChart3 size={36} className="text-red-600/40 mb-3" />
        <h3 className="text-base font-semibold text-ink mb-1">
          Impossible de charger les consommations
        </h3>
        <p className="text-sm text-ink/60">{error}</p>
      </div>
    );
  }

  if (consumptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BarChart3 size={36} className="text-ink/20 mb-3" />
        <h3 className="text-base font-semibold text-ink mb-1">
          Aucun relevé exploitant pour ce site
        </h3>
        <p className="text-sm text-ink/50 mb-4 text-center max-w-md">
          Cet onglet affiche les consommations transmises par votre exploitant
          (import Excel mensuel ou saisie manuelle). Pour la donnée brute du
          distributeur (GRDF, Enedis), rendez-vous dans l&apos;onglet
          <strong> Télérelève</strong> du module Énergie.
        </p>
        <Link href={`/energy/sites/${siteId}`}>
          <Button variant="outline">
            <BarChart3 size={16} className="mr-2" />
            Voir le suivi énergétique détaillé
          </Button>
        </Link>
      </div>
    );
  }

  const chartColor = selectedEnergy
    ? ENERGY_COLORS[selectedEnergy] || "#6b7280"
    : "#6b7280";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="panel flex flex-wrap items-end gap-4 p-4">
        {availableEnergies.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="label-tech">
              Énergie
            </label>
            <div className="flex gap-1">
              {availableEnergies.map((energy) => (
                <button
                  key={energy}
                  onClick={() => setSelectedEnergy(energy)}
                  className={cn(
                    "border px-3 py-1.5 text-sm font-medium transition-colors",
                    selectedEnergy === energy
                      ? "border-accent bg-accent/5 text-accent"
                      : "border-ink/20 bg-white text-ink/60 hover:border-accent/40 hover:text-accent"
                  )}
                >
                  {ENERGY_LABELS[energy] || energy}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="label-tech">Du</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-ink/20 bg-white px-3 py-1.5 text-sm tabular-nums focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="label-tech">Au</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={todayIso()}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-ink/20 bg-white px-3 py-1.5 text-sm tabular-nums focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex gap-1 ml-auto">
          {[
            { label: "30 j", days: 30 },
            { label: "90 j", days: 90 },
            { label: "1 an", days: 365 },
            { label: "3 ans", days: 365 * 3 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setDateFrom(daysAgoIso(preset.days));
                setDateTo(todayIso());
              }}
              className="label-tech border border-ink/20 bg-white px-3 py-1.5 hover:border-accent hover:text-accent transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="panel grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-ink/10">
        <div className="p-4">
          <p className="label-tech">
            Conso totale
          </p>
          <p className="mt-1 font-mono tabular-nums text-2xl font-semibold text-ink">
            {totals.total >= 5000
              ? `${(totals.total / 1000).toLocaleString("fr-FR", {
                  maximumFractionDigits: 1,
                })} MWh`
              : `${Math.round(totals.total).toLocaleString("fr-FR")} kWh`}
          </p>
          <p className="text-xs text-ink/50 mt-1">
            sur la période sélectionnée
          </p>
        </div>

        <div className="p-4">
          <p className="label-tech">
            Coût estimé
          </p>
          <p className="mt-1 font-mono tabular-nums text-2xl font-semibold text-ink">
            {totals.cost > 0
              ? `${Math.round(totals.cost).toLocaleString("fr-FR")} €`
              : "—"}
          </p>
          <p className="text-xs text-ink/50 mt-1">
            {totals.cost > 0 ? "sur la période" : "non renseigné"}
          </p>
        </div>

        <div className="p-4">
          <p className="label-tech">
            Évolution N-1
          </p>
          <p
            className={cn(
              "mt-1 font-mono tabular-nums text-2xl font-semibold",
              yoyDelta === null
                ? "text-ink/40"
                : yoyDelta > 0
                ? "text-red-600"
                : yoyDelta < 0
                ? "text-green-700"
                : "text-ink"
            )}
          >
            {yoyDelta === null
              ? "—"
              : `${yoyDelta > 0 ? "+" : ""}${yoyDelta} %`}
          </p>
          <p className="text-xs text-ink/50 mt-1">
            {yoyDelta === null
              ? "pas de données N-1"
              : "vs même période l'an dernier"}
          </p>
        </div>
      </div>

      {/* Chart */}
      <ChartCard
        title={`Consommation ${
          selectedEnergy ? ENERGY_LABELS[selectedEnergy] || selectedEnergy : ""
        }`}
        subtitle="Relevés transmis par l'exploitant"
      >
        <ConsumptionTimeChart data={chartData} color={chartColor} height={320} />
      </ChartCard>
    </div>
  );
}
