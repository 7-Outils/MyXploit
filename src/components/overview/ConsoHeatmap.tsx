"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { editorialDisplay as display, editorialMono as mono } from "@/lib/editorial-fonts";

interface MonthData {
  month: string;
  label: string;
  nc: number;
  nbPrime: number;
}

interface SitePerf {
  siteId: string;
  siteName: string;
  nb: number | null;
  monthlyData: MonthData[];
  deltaPercent: number;
  status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT";
  nc: number;
  nbPrime: number;
}

interface SummaryPayload {
  totalSites: number;
  totalNc: number;
  totalNbPrime: number;
  totalDelta: number;
  deltaPercent: number;
  sitesEnEconomie: number;
  sitesObjectifAtteint: number;
  sitesEnDepassement: number;
}

interface AnalyticsResponse {
  year: number;
  sites: SitePerf[];
  summary: SummaryPayload;
}

interface Props {
  contractId: string;
  yearType: "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";
}

const MONTH_ORDER_HEATING = ["07", "08", "09", "10", "11", "12", "01", "02", "03", "04", "05", "06"];
const MONTH_ORDER_CIVIL = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MONTH_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// Palette resserrée — axe froid→chaud en trois paliers par sens. Pas d'orange/amber
// (visuellement trop "trafic"), on reste sur emerald→stone→rose pour un rendu éditorial.
function deltaCell(delta: number | null): { bg: string; text: string; label: string } {
  if (delta === null) return { bg: "bg-stone-50", text: "text-stone-300", label: "—" };
  const v = Math.round(delta);
  const signed = v > 0 ? `+${v}` : `${v}`;
  if (v <= -15) return { bg: "bg-emerald-700", text: "text-white",       label: signed };
  if (v <=  -5) return { bg: "bg-emerald-300", text: "text-emerald-950", label: signed };
  if (v <    5) return { bg: "bg-stone-100",   text: "text-stone-500",   label: signed };
  if (v <   15) return { bg: "bg-rose-200",    text: "text-rose-950",    label: signed };
  if (v <   30) return { bg: "bg-rose-500",    text: "text-white",       label: signed };
  return           { bg: "bg-rose-800",     text: "text-white",       label: signed };
}

function currentHeatingSeasonYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

function fmtSignedPct1(v: number): string {
  const r = Math.round(v * 10) / 10;
  return (r > 0 ? "+" : r === 0 ? "" : "") + r.toFixed(1) + "%";
}

function fmtMwh(kwh: number): string {
  return Math.round(kwh / 1000).toLocaleString("fr-FR");
}

export default function ConsoHeatmap({ contractId, yearType }: Props) {
  const [year, setYear] = useState<number>(() =>
    yearType === "CIVIL" ? new Date().getFullYear() : currentHeatingSeasonYear()
  );

  const key = `/api/consumptions/analytics?contractId=${contractId}&year=${year}&yearType=${yearType}`;
  const { data, isLoading } = useSWR<AnalyticsResponse>(key, fetcher);

  const comparableSites = useMemo(
    () => (data?.sites ?? []).filter((s) => s.nb != null),
    [data]
  );

  const monthCols = useMemo(() => {
    const order = yearType === "CIVIL" ? MONTH_ORDER_CIVIL : MONTH_ORDER_HEATING;
    return order.map((mm) => ({ key: mm, label: MONTH_SHORT[parseInt(mm, 10) - 1] }));
  }, [yearType]);

  const byCell = useMemo(() => {
    const m = new Map<string, Map<string, MonthData>>();
    comparableSites.forEach((s) => {
      const row = new Map<string, MonthData>();
      s.monthlyData.forEach((md) => {
        const mm = md.month.split("-")[1];
        row.set(mm, md);
      });
      m.set(s.siteId, row);
    });
    return m;
  }, [comparableSites]);

  const monthAggregates = useMemo(() => {
    const totals = new Map<string, { nc: number; nbPrime: number }>();
    comparableSites.forEach((s) => {
      s.monthlyData.forEach((md) => {
        const mm = md.month.split("-")[1];
        const prev = totals.get(mm) || { nc: 0, nbPrime: 0 };
        totals.set(mm, { nc: prev.nc + md.nc, nbPrime: prev.nbPrime + md.nbPrime });
      });
    });
    const out = new Map<string, number | null>();
    totals.forEach((v, k) => {
      out.set(k, v.nbPrime > 0 ? ((v.nc - v.nbPrime) / v.nbPrime) * 100 : null);
    });
    return out;
  }, [comparableSites]);

  const rankedSites = useMemo(
    () => [...comparableSites].sort((a, b) => b.deltaPercent - a.deltaPercent),
    [comparableSites]
  );

  const periodLabel = yearType === "CIVIL" ? `${year}` : `${year - 1} — ${year}`;
  const canNext = yearType === "CIVIL"
    ? year < new Date().getFullYear()
    : year < currentHeatingSeasonYear();

  const summary = data?.summary;
  const totalSites = summary
    ? summary.sitesEnEconomie + summary.sitesObjectifAtteint + summary.sitesEnDepassement
    : 0;
  const maxSegment = summary ? Math.max(summary.sitesEnEconomie, summary.sitesObjectifAtteint, summary.sitesEnDepassement) : 1;

  const deltaColor = summary
    ? summary.deltaPercent <= -5 ? "text-emerald-700"
    : summary.deltaPercent >=  5 ? "text-rose-700"
    : "text-stone-700"
    : "text-stone-500";

  return (
    <section className={`${display.variable} ${mono.variable} bg-white rounded-xl border border-stone-200/70 overflow-hidden`}>
      {/* BANDEAU DE TÊTE ──────────────────────────────────────────────── */}
      <header className="flex items-end justify-between px-8 pt-7 pb-5 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-stone-400 font-semibold">
            <span>§</span>
            <span>Performance énergétique</span>
          </div>
          <h2 className="text-lg font-semibold text-stone-900 mt-1.5">
            Consommation réelle vs cible théorique
          </h2>
        </div>
        <nav className="flex items-center gap-3 text-[11px] text-stone-400">
          <button
            onClick={() => setYear(year - 1)}
            className="hover:text-stone-900 transition-colors font-semibold"
          >
            ← précédent
          </button>
          <span className={`${mono.className} text-stone-900 tabular-nums text-xs font-medium min-w-[90px] text-center`}>
            {periodLabel}
          </span>
          <button
            onClick={() => setYear(year + 1)}
            disabled={!canNext}
            className="hover:text-stone-900 transition-colors font-semibold disabled:opacity-30 disabled:hover:text-stone-400"
          >
            suivant →
          </button>
        </nav>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      ) : comparableSites.length === 0 || !summary ? (
        <div className="text-center py-16">
          <p className="text-sm text-stone-500">
            Aucun site avec cible (NB) renseignée pour cette période.
          </p>
        </div>
      ) : (
        <>
          {/* HERO : verdict global éditorial ───────────────────────────── */}
          <div className="grid grid-cols-[minmax(280px,auto)_1fr] gap-12 px-8 py-10 border-b border-stone-100">
            {/* Chiffre display */}
            <div className="relative">
              <div className="text-[9px] uppercase tracking-[0.24em] text-stone-400 font-semibold mb-3">
                Écart cumulé
              </div>
              <div
                className={`${display.className} italic ${deltaColor} leading-none tabular-nums`}
                style={{
                  fontSize: "clamp(72px, 8vw, 112px)",
                  animation: "heatmapRise 800ms cubic-bezier(0.16, 1, 0.3, 1) both",
                }}
              >
                {fmtSignedPct1(summary.deltaPercent)}
              </div>
              <dl className={`${mono.className} mt-5 flex gap-6 text-[11px] tabular-nums`}>
                <div>
                  <dt className="text-[9px] uppercase tracking-widest text-stone-400 mb-0.5">Réel</dt>
                  <dd className="text-stone-900 font-medium">{fmtMwh(summary.totalNc)} MWh</dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-widest text-stone-400 mb-0.5">Cible</dt>
                  <dd className="text-stone-900 font-medium">{fmtMwh(summary.totalNbPrime)} MWh</dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-widest text-stone-400 mb-0.5">Delta</dt>
                  <dd className={`font-medium ${summary.totalDelta > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {summary.totalDelta > 0 ? "+" : ""}{fmtMwh(summary.totalDelta)} MWh
                  </dd>
                </div>
              </dl>
            </div>

            {/* Répartition — 3 barres verticales type diagramme éditorial */}
            <div className="border-l border-stone-100 pl-12">
              <div className="text-[9px] uppercase tracking-[0.24em] text-stone-400 font-semibold mb-5">
                Répartition des sites
                <span className={`${mono.className} text-stone-500 ml-3 tabular-nums`}>n = {totalSites}</span>
              </div>
              <div className="grid grid-cols-3 gap-8">
                <DistSegment
                  label="Économie"
                  count={summary.sitesEnEconomie}
                  max={maxSegment}
                  color="bg-emerald-600"
                  tone="text-emerald-700"
                />
                <DistSegment
                  label="Objectif"
                  count={summary.sitesObjectifAtteint}
                  max={maxSegment}
                  color="bg-stone-400"
                  tone="text-stone-700"
                />
                <DistSegment
                  label="Dépassement"
                  count={summary.sitesEnDepassement}
                  max={maxSegment}
                  color="bg-rose-600"
                  tone="text-rose-700"
                />
              </div>
            </div>
          </div>

          {/* HEATMAP ──────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between px-8 py-3 border-b border-stone-100">
              <div className="text-[9px] uppercase tracking-[0.22em] text-stone-400 font-semibold">
                Matrice site × mois
              </div>
              <div className={`${mono.className} text-[10px] text-stone-400 tabular-nums`}>
                {comparableSites.length} lignes · 12 colonnes · tri ↓ écart
              </div>
            </div>

            <div className="overflow-auto max-h-[60vh]">
              <table className="border-separate border-spacing-0" style={{ minWidth: "max-content" }}>
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 bg-white z-30 text-left px-6 py-3 w-[280px] min-w-[280px] border-b border-r border-stone-100">
                      <div className="text-[9px] font-semibold text-stone-400 uppercase tracking-[0.2em]">Site</div>
                    </th>
                    {monthCols.map((m) => (
                      <th key={m.key} className="sticky top-0 bg-white z-20 px-1 py-3 w-[52px] min-w-[52px] border-b border-stone-100">
                        <div className={`${mono.className} text-[10px] text-stone-500 font-medium text-center uppercase tracking-wider`}>
                          {m.label}
                        </div>
                      </th>
                    ))}
                    <th className="sticky top-0 bg-white z-20 px-3 py-3 w-[110px] min-w-[110px] border-b border-l border-stone-100">
                      <div className="text-[9px] font-semibold text-stone-400 uppercase tracking-[0.2em] text-center">Cumulé</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rankedSites.map((site, rowIdx) => {
                    const row = byCell.get(site.siteId);
                    const yearly = deltaCell(site.deltaPercent);
                    return (
                      <tr
                        key={site.siteId}
                        className="group motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
                        style={{ animationDelay: `${Math.min(rowIdx * 10, 240)}ms`, animationFillMode: "backwards" }}
                      >
                        <td
                          className={`sticky left-0 z-10 px-6 py-1.5 w-[280px] min-w-[280px] border-b border-r border-stone-100 bg-white group-hover:bg-stone-50/80 transition-colors`}
                        >
                          <Link href={`/energy/sites/${site.siteId}`} className="flex items-center gap-3">
                            <span className={`${mono.className} text-[10px] tabular-nums text-stone-300 font-medium w-5`}>
                              {String(rowIdx + 1).padStart(2, "0")}
                            </span>
                            <span className="text-sm font-medium text-stone-900 truncate group-hover:text-stone-700 transition-colors">
                              {site.siteName}
                            </span>
                          </Link>
                        </td>
                        {monthCols.map((col) => {
                          const md = row?.get(col.key);
                          const delta = md && md.nbPrime > 0
                            ? ((md.nc - md.nbPrime) / md.nbPrime) * 100
                            : null;
                          const cell = deltaCell(delta);
                          const hasData = md && md.nc > 0;
                          return (
                            <td key={col.key} className="border-b border-stone-100 p-[2px] align-middle">
                              <div
                                title={
                                  hasData && delta !== null
                                    ? `${site.siteName} · ${col.label}\n${cell.label}%\nNC ${fmtMwh(md!.nc)} MWh — N'B ${fmtMwh(md!.nbPrime)} MWh`
                                    : `${site.siteName} · ${col.label} : pas de données`
                                }
                                className={`${mono.className} h-7 flex items-center justify-center rounded-[3px] text-[10px] font-medium tabular-nums transition-all hover:scale-110 hover:shadow-sm ${cell.bg} ${cell.text} ${hasData ? "cursor-help" : ""}`}
                              >
                                {hasData ? cell.label : ""}
                              </div>
                            </td>
                          );
                        })}
                        <td className="border-b border-l border-stone-100 p-[2px] align-middle">
                          <div className={`${mono.className} h-7 flex items-center justify-center rounded-[3px] text-xs font-semibold tabular-nums ${yearly.bg} ${yearly.text}`}>
                            {yearly.label}%
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="sticky left-0 z-10 bg-stone-50 px-6 py-2.5 w-[280px] min-w-[280px] border-t-2 border-stone-200 border-r border-stone-100">
                      <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-stone-700">Moyenne mensuelle</div>
                    </td>
                    {monthCols.map((col) => {
                      const agg = monthAggregates.get(col.key) ?? null;
                      const cell = deltaCell(agg);
                      return (
                        <td key={col.key} className="border-t-2 border-stone-200 p-[2px] align-middle bg-stone-50">
                          <div className={`${mono.className} h-7 flex items-center justify-center rounded-[3px] text-[10px] font-semibold tabular-nums ${cell.bg} ${cell.text}`}>
                            {agg !== null ? cell.label : ""}
                          </div>
                        </td>
                      );
                    })}
                    <td className="border-t-2 border-stone-200 border-l border-stone-100 p-[2px] align-middle bg-stone-50">
                      <div className={`${mono.className} h-7 flex items-center justify-center rounded-[3px] text-xs font-bold tabular-nums ${deltaCell(summary.deltaPercent).bg} ${deltaCell(summary.deltaPercent).text}`}>
                        {fmtSignedPct1(summary.deltaPercent)}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* LEGEND ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-8 py-4 border-t border-stone-100 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="uppercase tracking-[0.2em] font-bold text-stone-700 mr-3">Échelle</span>
                <LegendSwatch bg="bg-emerald-700"  value="≤ −15" />
                <LegendSwatch bg="bg-emerald-300"  value="−5" />
                <LegendSwatch bg="bg-stone-100"    value="±5" />
                <LegendSwatch bg="bg-rose-200"     value="+5" />
                <LegendSwatch bg="bg-rose-500"     value="+15" />
                <LegendSwatch bg="bg-rose-800"     value="≥ +30" />
              </div>
              <div className={`${mono.className} text-stone-400 tabular-nums italic`}>
                clic site → détail
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes heatmapRise {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}

function DistSegment({
  label,
  count,
  max,
  color,
  tone,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
  tone: string;
}) {
  const height = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="h-16 flex items-end">
        <div
          className={`${color} w-full rounded-sm`}
          style={{
            height: `${Math.max(4, height)}%`,
            animation: "heatmapRise 900ms cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        />
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-semibold tabular-nums ${tone}`}>{count}</span>
        <span className="text-[10px] uppercase tracking-widest text-stone-400 font-medium">{label}</span>
      </div>
    </div>
  );
}

function LegendSwatch({ bg, value }: { bg: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 mr-2">
      <span className={`w-3 h-3 rounded-[2px] ${bg} inline-block`} />
      <span className="tabular-nums text-stone-500">{value}</span>
    </span>
  );
}
