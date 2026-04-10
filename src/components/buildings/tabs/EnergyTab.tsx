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
        <p className="text-sm text-text-secondary">
          Chargement des consommations...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BarChart3 size={40} className="text-red-300 mb-3" />
        <h3 className="text-lg font-medium text-gray-700 mb-1">
          Impossible de charger les consommations
        </h3>
        <p className="text-sm text-text-secondary">{error}</p>
      </div>
    );
  }

  if (consumptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BarChart3 size={40} className="text-gray-300 mb-3" />
        <h3 className="text-lg font-medium text-gray-700 mb-1">
          Aucun relevé exploitant pour ce site
        </h3>
        <p className="text-sm text-gray-500 mb-4 text-center max-w-md">
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
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
        {availableEnergies.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">
              Énergie
            </label>
            <div className="flex gap-2">
              {availableEnergies.map((energy) => (
                <button
                  key={energy}
                  onClick={() => setSelectedEnergy(energy)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    selectedEnergy === energy
                      ? "text-white"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  )}
                  style={
                    selectedEnergy === energy
                      ? { backgroundColor: ENERGY_COLORS[energy] || "#6b7280" }
                      : undefined
                  }
                >
                  {ENERGY_LABELS[energy] || energy}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Du</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">Au</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={todayIso()}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
          />
        </div>

        <div className="flex gap-2 ml-auto">
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
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Conso totale
          </p>
          <p className="text-2xl font-semibold text-primary-dark mt-1">
            {totals.total >= 5000
              ? `${(totals.total / 1000).toLocaleString("fr-FR", {
                  maximumFractionDigits: 1,
                })} MWh`
              : `${Math.round(totals.total).toLocaleString("fr-FR")} kWh`}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            sur la période sélectionnée
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Coût estimé
          </p>
          <p className="text-2xl font-semibold text-primary-dark mt-1">
            {totals.cost > 0
              ? `${Math.round(totals.cost).toLocaleString("fr-FR")} €`
              : "—"}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            {totals.cost > 0 ? "sur la période" : "non renseigné"}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Évolution N-1
          </p>
          <p
            className={cn(
              "text-2xl font-semibold mt-1",
              yoyDelta === null
                ? "text-gray-400"
                : yoyDelta > 0
                ? "text-red-600"
                : yoyDelta < 0
                ? "text-green-600"
                : "text-primary-dark"
            )}
          >
            {yoyDelta === null
              ? "—"
              : `${yoyDelta > 0 ? "+" : ""}${yoyDelta} %`}
          </p>
          <p className="text-xs text-text-secondary mt-1">
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
