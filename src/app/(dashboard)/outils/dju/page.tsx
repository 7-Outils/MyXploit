"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { Thermometer, Loader2, CalendarRange } from "lucide-react";
import { StationMap, type Station } from "@/components/outils/StationMap";

type CalcResult = {
  station: string;
  stationKey: string;
  djuTrentenaire: number | null;
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

  const ecart = useMemo(() => {
    if (!result?.djuTrentenaire) return null;
    const diff = result.djuTotal - result.djuTrentenaire;
    const pct = Math.round((diff / result.djuTrentenaire) * 100);
    return { diff, pct };
  }, [result]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <Thermometer size={20} className="text-accent" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">Calculateur DJU</h1>
      </div>

      {/* Carte à gauche, résultat à droite */}
      <div className="grid grid-cols-1 lg:grid-cols-[480px_1fr] gap-6 items-start">
        {/* Colonne gauche : contrôles compacts + carte (ou saisie code postal) */}
        <div className="space-y-3">
          {/* Contrôles : toggle au-dessus, puis période + bouton sur la même ligne */}
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setMode("station")}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                mode === "station"
                  ? "bg-accent text-white"
                  : "bg-gray-100 text-text-secondary hover:bg-gray-200"
              }`}
            >
              Carte
            </button>
            <button
              onClick={() => setMode("postalCode")}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                mode === "postalCode"
                  ? "bg-accent text-white"
                  : "bg-gray-100 text-text-secondary hover:bg-gray-200"
              }`}
            >
              Code postal
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Période : un seul champ regroupant les deux dates */}
            <div className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-gray-300 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
              <CalendarRange size={14} className="text-text-muted shrink-0" />
              <input
                type="date"
                value={start}
                max={end || undefined}
                onChange={(e) => setDates((d) => ({ ...d, start: e.target.value }))}
                className="bg-transparent text-sm outline-none text-text-primary w-[112px]"
              />
              <span className="text-text-muted text-sm">→</span>
              <input
                type="date"
                value={end}
                min={start || undefined}
                onChange={(e) => setDates((d) => ({ ...d, end: e.target.value }))}
                className="bg-transparent text-sm outline-none text-text-primary w-[112px]"
              />
            </div>

            <button
              onClick={handleCalculate}
              disabled={!canSubmit || loading}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Calculer
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

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
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              />
              <p className="mt-1 text-xs text-text-muted">
                La station Météo France la plus proche sera utilisée.
              </p>
            </div>
          )}
        </div>

        {/* Colonne droite : résultat */}
        <div>
          {result ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-soft overflow-hidden">
              {/* KPIs */}
              <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 border-b border-gray-100">
                <div className="p-5">
                  <div className="text-xs text-text-muted uppercase tracking-wide">DJU total</div>
                  <div className="mt-1 text-3xl font-semibold text-accent tabular-nums">
                    {result.djuTotal.toLocaleString("fr-FR")}
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-xs text-text-muted uppercase tracking-wide">Station</div>
                  <div className="mt-1 text-sm font-medium text-text-primary">{result.station}</div>
                  <div className="text-xs text-text-muted">{result.days} jours</div>
                </div>
                <div className="p-5">
                  <div className="text-xs text-text-muted uppercase tracking-wide">Trentenaire</div>
                  <div className="mt-1 text-sm font-medium text-text-primary tabular-nums">
                    {result.djuTrentenaire ? result.djuTrentenaire.toLocaleString("fr-FR") : "—"}
                  </div>
                  <div className="text-xs text-text-muted">moyenne annuelle</div>
                </div>
                <div className="p-5">
                  <div className="text-xs text-text-muted uppercase tracking-wide">Écart trentenaire</div>
                  {ecart ? (
                    <div
                      className={`mt-1 text-sm font-medium tabular-nums ${
                        ecart.diff >= 0 ? "text-orange-600" : "text-blue-600"
                      }`}
                    >
                      {ecart.diff >= 0 ? "+" : ""}
                      {ecart.diff.toLocaleString("fr-FR")} ({ecart.pct >= 0 ? "+" : ""}
                      {ecart.pct}%)
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-text-muted">—</div>
                  )}
                  <div className="text-xs text-text-muted">
                    {ecart && ecart.diff >= 0 ? "plus froid" : ecart ? "plus doux" : ""}
                  </div>
                </div>
              </div>

              {/* Détail mensuel */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-text-muted uppercase tracking-wide bg-gray-50">
                    <th className="text-left font-medium px-5 py-2.5">Mois</th>
                    <th className="text-right font-medium px-5 py-2.5">Jours</th>
                    <th className="text-right font-medium px-5 py-2.5">DJU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {result.monthlyData.map((m) => (
                    <tr key={m.month} className="hover:bg-gray-50/50">
                      <td className="px-5 py-2 text-text-primary">{m.label}</td>
                      <td className="px-5 py-2 text-right text-text-secondary tabular-nums">{m.days}</td>
                      <td className="px-5 py-2 text-right font-medium text-text-primary tabular-nums">
                        {m.dju.toLocaleString("fr-FR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 font-semibold bg-gray-50/50">
                    <td className="px-5 py-2.5 text-text-primary">Total</td>
                    <td className="px-5 py-2.5 text-right text-text-secondary tabular-nums">{result.days}</td>
                    <td className="px-5 py-2.5 text-right text-accent tabular-nums">
                      {result.djuTotal.toLocaleString("fr-FR")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="h-full min-h-[200px] rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-sm text-text-muted">
              Choisissez une station et une période, puis cliquez sur Calculer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
