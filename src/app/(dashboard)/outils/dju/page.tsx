"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { Thermometer, Loader2, CalendarRange } from "lucide-react";
import { StationMap, type Station } from "@/components/outils/StationMap";

type CalcResult = {
  station: string;
  stationKey: string;
  period: { start: string; end: string };
  days: number;
  djuTotal: number;
  monthlyData: { month: string; label: string; dju: number; days: number }[];
};

// Valeurs par défaut : saison de chauffe en cours (1er oct → hier).
function defaultDates() {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  const year = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  const iso = (d: Date) => d.toISOString().split("T")[0];
  return { start: `${year}-10-01`, end: iso(yesterday) };
}

export default function DjuToolPage() {
  const { data: stationsData } = useSWR<{ stations: Station[] }>(
    "/api/dju/calculate?list=1",
    fetcher
  );
  const stations = useMemo(() => stationsData?.stations ?? [], [stationsData]);

  const [mode, setMode] = useState<"station" | "postalCode">("station");
  const [station, setStation] = useState("ORLY");
  const [postalCode, setPostalCode] = useState("");
  const [{ start, end }, setDates] = useState(defaultDates);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalcResult | null>(null);

  // Station par défaut = ORLY si présente, sinon 1re de la liste
  useEffect(() => {
    if (stations.length && !stations.some((s) => s.key === station)) {
      setStation(stations[0].key);
    }
  }, [stations, station]);

  async function handleCalculate() {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const params = new URLSearchParams({ start, end });
      if (mode === "postalCode") params.set("postalCode", postalCode);
      else params.set("station", station);

      const res = await fetch(`/api/dju/calculate?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de calcul");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    !!start &&
    !!end &&
    (mode === "station" ? !!station : /^\d{5}$/.test(postalCode));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-2.5">
        <Thermometer size={18} className="text-accent" />
        <h1 className="text-xl font-semibold text-ink">Calculateur DJU</h1>
      </div>

      {/* Contrôles compacts, au-dessus de la grille → carte et résultat
          démarrent à la même hauteur (alignés). */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex border border-ink/20">
          <button
            onClick={() => setMode("station")}
            className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors ${
              mode === "station"
                ? "bg-ink text-paper"
                : "text-ink/50 hover:text-ink"
            }`}
          >
            Carte
          </button>
          <button
            onClick={() => setMode("postalCode")}
            className={`border-l border-ink/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors ${
              mode === "postalCode"
                ? "bg-ink text-paper"
                : "text-ink/50 hover:text-ink"
            }`}
          >
            Code postal
          </button>
        </div>

        {/* Période : un seul champ regroupant les deux dates */}
        <div className="inline-flex h-9 items-center gap-1.5 border border-ink/20 px-2.5 focus-within:border-accent">
          <CalendarRange size={14} className="shrink-0 text-ink/40" />
          <input
            type="date"
            value={start}
            max={end || undefined}
            onChange={(e) => setDates((d) => ({ ...d, start: e.target.value }))}
            className="w-[112px] bg-transparent font-mono text-sm tabular-nums text-ink outline-none"
          />
          <span className="text-sm text-ink/40">→</span>
          <input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setDates((d) => ({ ...d, end: e.target.value }))}
            className="w-[112px] bg-transparent font-mono text-sm tabular-nums text-ink outline-none"
          />
        </div>

        <button
          onClick={handleCalculate}
          disabled={!canSubmit || loading}
          className="inline-flex h-9 items-center gap-2 bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          Calculer
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* Carte à gauche, résultat à droite — colonnes égales, tops alignés */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Colonne gauche : carte (ou saisie code postal) */}
        <div>
          {mode === "station" ? (
            <StationMap stations={stations} selected={station} onSelect={setStation} />
          ) : (
            <div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="ex. 91270"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                className="h-10 w-full border border-ink/20 bg-white px-3 font-mono text-sm tabular-nums text-ink outline-none focus:border-accent"
              />
              <p className="mt-1.5 text-xs text-ink/50">
                La station Météo France la plus proche sera utilisée.
              </p>
            </div>
          )}
        </div>

        {/* Colonne droite : résultat */}
        <div>
          {result ? (
            <div className="panel overflow-hidden">
              {/* KPIs */}
              <div className="grid grid-cols-2 divide-x divide-ink/10 border-b border-ink/10">
                <div className="px-4 py-3">
                  <div className="label-tech">DJU total</div>
                  <div className="mt-1 font-mono text-3xl font-semibold tabular-nums text-accent">
                    {result.djuTotal.toLocaleString("fr-FR")}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="label-tech">Station</div>
                  <div className="mt-1 text-sm font-medium text-ink">{result.station}</div>
                  <div className="font-mono text-xs tabular-nums text-ink/50">
                    {result.days} jours
                  </div>
                </div>
              </div>

              {/* Détail mensuel */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10">
                    <th className="label-tech px-4 py-2 text-left font-normal">Mois</th>
                    <th className="label-tech px-4 py-2 text-right font-normal">Jours</th>
                    <th className="label-tech px-4 py-2 text-right font-normal">DJU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/[0.06]">
                  {result.monthlyData.map((m) => (
                    <tr key={m.month} className="hover:bg-ink/[0.02]">
                      <td className="px-4 py-2 text-ink">{m.label}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-ink/60">
                        {m.days}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-medium tabular-nums text-ink">
                        {m.dju.toLocaleString("fr-FR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-ink/15 font-semibold">
                    <td className="px-4 py-2 text-ink">Total</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink/60">
                      {result.days}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-accent">
                      {result.djuTotal.toLocaleString("fr-FR")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center border border-dashed border-ink/15 text-sm text-ink/40">
              Choisissez une station et une période, puis cliquez sur Calculer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
