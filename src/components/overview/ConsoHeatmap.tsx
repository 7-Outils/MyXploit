"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Flame, Loader2 } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { ChartCard } from "@/components/dashboard/chart-card";

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
  status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT";
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

// Palette resserrée : on évite les rouges flashy + transitions douces.
// delta = (nc - nbPrime) / nbPrime * 100
function deltaCell(delta: number | null): { bg: string; text: string; label: string } {
  if (delta === null) return { bg: "bg-gray-50", text: "text-gray-300", label: "—" };
  const v = Math.round(delta);
  const signed = v > 0 ? `+${v}` : `${v}`;
  if (v <= -15) return { bg: "bg-emerald-600",  text: "text-white",         label: signed };
  if (v <=  -5) return { bg: "bg-emerald-200",  text: "text-emerald-900",   label: signed };
  if (v <    5) return { bg: "bg-stone-100",    text: "text-stone-500",     label: signed };
  if (v <   15) return { bg: "bg-amber-200",    text: "text-amber-900",     label: signed };
  if (v <   30) return { bg: "bg-orange-400",   text: "text-white",         label: signed };
  return           { bg: "bg-rose-600",       text: "text-white",         label: signed };
}

function currentHeatingSeasonYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

function fmtSignedPct(v: number): string {
  const r = Math.round(v * 10) / 10;
  return (r > 0 ? "+" : "") + r.toFixed(1) + "%";
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
    return order.map((mm) => ({
      key: mm,
      label: MONTH_SHORT[parseInt(mm, 10) - 1],
    }));
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

  // Aggrégat par mois (delta moyen pondéré par N'B)
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
  const total = summary
    ? summary.sitesEnEconomie + summary.sitesObjectifAtteint + summary.sitesEnDepassement
    : 0;

  return (
    <ChartCard
      title={
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-accent" />
          <span>Performance énergétique</span>
        </div>
      }
      subtitle={
        comparableSites.length > 0
          ? `${comparableSites.length} site${comparableSites.length > 1 ? "s" : ""} avec cible · écart NC vs N'B (ajusté DJU)`
          : "Écart consommation réelle vs cible théorique ajustée au climat"
      }
      action={
        <div className="flex items-center gap-0.5 text-xs bg-gray-50 rounded-lg p-0.5">
          <button
            onClick={() => setYear(year - 1)}
            className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-md text-text-secondary font-semibold"
          >
            ←
          </button>
          <span className="px-3 tabular-nums font-semibold text-primary-dark min-w-[96px] text-center">
            {periodLabel}
          </span>
          <button
            onClick={() => setYear(year + 1)}
            disabled={!canNext}
            className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-md text-text-secondary font-semibold disabled:opacity-30"
          >
            →
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : comparableSites.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-gray-50 mb-3">
            <Flame size={20} className="text-gray-300" />
          </div>
          <p className="text-sm text-text-secondary">
            Aucun site avec cible (NB) renseignée pour cette période.
          </p>
        </div>
      ) : (
        <>
          {/* HERO : verdict global ──────────────────────────────────────── */}
          {summary && total > 0 && (
            <div className="mb-6 grid grid-cols-[auto_1fr] gap-6 items-end">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-secondary font-semibold mb-1">
                  Écart global sur la période
                </div>
                <div className="flex items-baseline gap-2">
                  <div
                    className={`text-5xl font-bold tracking-tight tabular-nums ${
                      summary.deltaPercent <= -5
                        ? "text-emerald-600"
                        : summary.deltaPercent >= 5
                        ? "text-orange-600"
                        : "text-stone-600"
                    }`}
                  >
                    {fmtSignedPct(summary.deltaPercent)}
                  </div>
                  <div className="text-xs text-text-secondary tabular-nums pb-1">
                    {Math.round(summary.totalNc / 1000).toLocaleString("fr-FR")} MWh réel · cible {Math.round(summary.totalNbPrime / 1000).toLocaleString("fr-FR")} MWh
                  </div>
                </div>
              </div>
              <div>
                <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${(summary.sitesEnEconomie / total) * 100}%` }}
                  />
                  <div
                    className="bg-stone-300 h-full transition-all"
                    style={{ width: `${(summary.sitesObjectifAtteint / total) * 100}%` }}
                  />
                  <div
                    className="bg-orange-500 h-full transition-all"
                    style={{ width: `${(summary.sitesEnDepassement / total) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[11px] font-medium">
                  <span className="text-emerald-700 tabular-nums">
                    ● {summary.sitesEnEconomie} économie
                  </span>
                  <span className="text-stone-600 tabular-nums">
                    ● {summary.sitesObjectifAtteint} à l&apos;objectif
                  </span>
                  <span className="text-orange-700 tabular-nums">
                    ● {summary.sitesEnDepassement} dépassement
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* HEATMAP ──────────────────────────────────────────────────── */}
          <div className="relative -mx-6 -mb-6">
            <div className="overflow-auto max-h-[60vh]">
              <table className="border-separate border-spacing-0" style={{ minWidth: "max-content" }}>
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 bg-white z-30 text-left px-5 py-3 w-[260px] min-w-[260px] border-b-2 border-r border-gray-100">
                      <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-[0.14em]">
                        Site
                      </div>
                    </th>
                    {monthCols.map((m) => (
                      <th
                        key={m.key}
                        className="sticky top-0 bg-white z-20 px-2 py-3 w-[56px] min-w-[56px] border-b-2 border-gray-100"
                      >
                        <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider text-center">
                          {m.label}
                        </div>
                      </th>
                    ))}
                    <th className="sticky top-0 bg-white z-20 px-3 py-3 w-[120px] min-w-[120px] border-b-2 border-l border-gray-100">
                      <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider text-center">
                        Cumulé
                      </div>
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
                        style={{ animationDelay: `${Math.min(rowIdx * 12, 300)}ms`, animationFillMode: "backwards" }}
                      >
                        <td
                          className={`sticky left-0 z-10 px-5 py-1.5 w-[260px] min-w-[260px] border-b border-r border-gray-100 ${
                            rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                          } group-hover:bg-accent/5`}
                        >
                          <Link
                            href={`/energy/sites/${site.siteId}`}
                            className="flex items-center gap-2.5 group/link"
                          >
                            <span className="text-[10px] tabular-nums text-gray-300 font-semibold w-6">
                              {String(rowIdx + 1).padStart(2, "0")}
                            </span>
                            <span className="text-sm font-medium text-primary-dark truncate group-hover/link:text-accent transition-colors">
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
                            <td key={col.key} className="border-b border-gray-100 p-0.5 align-middle">
                              <div
                                title={
                                  hasData && delta !== null
                                    ? `${site.siteName} · ${col.label}\n${cell.label}%\nNC ${Math.round((md?.nc ?? 0) / 1000)} MWh — N'B ${Math.round((md?.nbPrime ?? 0) / 1000)} MWh`
                                    : `${site.siteName} · ${col.label} : pas de données`
                                }
                                className={`h-7 flex items-center justify-center rounded-sm text-[10px] font-semibold tabular-nums transition-transform hover:scale-110 hover:shadow-sm ${cell.bg} ${cell.text} ${hasData ? "cursor-help" : ""}`}
                              >
                                {hasData ? cell.label : ""}
                              </div>
                            </td>
                          );
                        })}
                        <td className="border-b border-l border-gray-100 p-0.5 align-middle">
                          <div
                            className={`h-7 flex items-center justify-center rounded-sm text-xs font-bold tabular-nums ${yearly.bg} ${yearly.text}`}
                          >
                            {yearly.label}%
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/80">
                    <td className="sticky left-0 z-10 bg-gray-50/80 px-5 py-2 w-[260px] min-w-[260px] border-t-2 border-r border-gray-100">
                      <div className="text-[10px] uppercase tracking-widest font-bold text-primary-dark">
                        Moyenne mensuelle
                      </div>
                    </td>
                    {monthCols.map((col) => {
                      const agg = monthAggregates.get(col.key) ?? null;
                      const cell = deltaCell(agg);
                      return (
                        <td key={col.key} className="border-t-2 border-gray-100 p-0.5 align-middle">
                          <div
                            className={`h-7 flex items-center justify-center rounded-sm text-[10px] font-bold tabular-nums ${cell.bg} ${cell.text}`}
                            title={agg !== null ? `Moyenne ${col.label} : ${cell.label}%` : "Pas de données"}
                          >
                            {agg !== null ? cell.label : ""}
                          </div>
                        </td>
                      );
                    })}
                    <td className="border-t-2 border-l border-gray-100 p-0.5 align-middle">
                      <div
                        className={`h-7 flex items-center justify-center rounded-sm text-xs font-bold tabular-nums ${
                          summary ? deltaCell(summary.deltaPercent).bg : "bg-gray-100"
                        } ${summary ? deltaCell(summary.deltaPercent).text : "text-gray-500"}`}
                      >
                        {summary ? fmtSignedPct(summary.deltaPercent) : "—"}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* LEGEND ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100 text-[10px] text-text-secondary">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="uppercase tracking-widest font-bold text-primary-dark mr-2">Écart</span>
              <LegendChip bg="bg-emerald-600"  label="≤ −15" />
              <LegendChip bg="bg-emerald-200"  label="−5" textMuted />
              <LegendChip bg="bg-stone-100"    label="objectif" textMuted />
              <LegendChip bg="bg-amber-200"    label="+5" textMuted />
              <LegendChip bg="bg-orange-400"   label="+15" />
              <LegendChip bg="bg-rose-600"     label="≥ +30" />
            </div>
            <div className="italic">Clic site → détail conso</div>
          </div>
        </>
      )}
    </ChartCard>
  );
}

function LegendChip({ bg, label, textMuted }: { bg: string; label: string; textMuted?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`w-3 h-3 rounded-sm ${bg}`} />
      <span className={`tabular-nums ${textMuted ? "text-gray-400" : ""}`}>{label}</span>
    </div>
  );
}
