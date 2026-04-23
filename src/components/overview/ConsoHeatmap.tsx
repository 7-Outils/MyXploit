"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";

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
  delta: number;
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

function deltaCell(delta: number | null): { bg: string; text: string; label: string } {
  if (delta === null) return { bg: "bg-gray-50", text: "text-gray-300", label: "—" };
  const v = Math.round(delta);
  const signed = v > 0 ? `+${v}` : `${v}`;
  if (v <= -15) return { bg: "bg-emerald-600", text: "text-white",       label: signed };
  if (v <=  -5) return { bg: "bg-emerald-200", text: "text-emerald-900", label: signed };
  if (v <    5) return { bg: "bg-gray-100",    text: "text-gray-500",    label: signed };
  if (v <   15) return { bg: "bg-amber-200",   text: "text-amber-900",   label: signed };
  if (v <   30) return { bg: "bg-orange-400",  text: "text-white",       label: signed };
  return           { bg: "bg-red-500",        text: "text-white",       label: signed };
}

function currentHeatingSeasonYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

function fmtSignedPct(v: number, d = 1): string {
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return (r > 0 ? "+" : "") + r.toFixed(d);
}

function fmtMwh(kwh: number): string {
  return (kwh / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function fmtSignedMwh(kwh: number): string {
  const mwh = Math.round(kwh / 1000);
  return (mwh > 0 ? "+" : "") + mwh.toLocaleString("fr-FR");
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

  const periodLabel = yearType === "CIVIL" ? `${year}` : `${year - 1}–${year}`;
  const canNext = yearType === "CIVIL" ? year < new Date().getFullYear() : year < currentHeatingSeasonYear();
  const summary = data?.summary;
  const totalSites = summary ? summary.sitesEnEconomie + summary.sitesObjectifAtteint + summary.sitesEnDepassement : 0;

  const globalDeltaColor = summary
    ? summary.deltaPercent <= -5
      ? "text-emerald-700"
      : summary.deltaPercent >= 5
      ? "text-red-700"
      : "text-gray-600"
    : "text-gray-500";

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 overflow-hidden">
      {/* Header ligne 1 — titre + navigation ────────────────────────── */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-gray-100">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-primary-dark">Performance énergétique</span>
          <span className="text-text-secondary">·</span>
          <span className="text-text-secondary tabular-nums">
            {comparableSites.length} site{comparableSites.length > 1 ? "s" : ""} avec cible
          </span>
        </div>
        <div className="flex items-center gap-0.5 text-xs">
          <button
            onClick={() => setYear(year - 1)}
            className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-text-secondary"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 tabular-nums font-medium text-primary-dark min-w-[72px] text-center">
            {periodLabel}
          </span>
          <button
            onClick={() => setYear(year + 1)}
            disabled={!canNext}
            className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-text-secondary disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Strip KPI — 1 ligne dense ────────────────────────────────── */}
      {summary && totalSites > 0 && (
        <div className="flex items-center gap-6 px-4 h-11 border-b border-gray-100 text-xs">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">Écart</span>
            <span className={`text-base font-semibold tabular-nums ${globalDeltaColor}`}>
              {fmtSignedPct(summary.deltaPercent)}%
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">NC</span>
            <span className="tabular-nums text-primary-dark font-medium">{fmtMwh(summary.totalNc)} MWh</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">N&apos;B</span>
            <span className="tabular-nums text-primary-dark font-medium">{fmtMwh(summary.totalNbPrime)} MWh</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">Δ</span>
            <span className={`tabular-nums font-medium ${summary.totalDelta > 0 ? "text-red-700" : "text-emerald-700"}`}>
              {fmtSignedMwh(summary.totalDelta)} MWh
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 tabular-nums">
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{summary.sitesEnEconomie} économie
            </span>
            <span className="inline-flex items-center gap-1 text-gray-600">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />{summary.sitesObjectifAtteint} objectif
            </span>
            <span className="inline-flex items-center gap-1 text-red-700">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{summary.sitesEnDepassement} dépassement
            </span>
          </div>
        </div>
      )}

      {/* Matrice ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
        </div>
      ) : comparableSites.length === 0 ? (
        <div className="text-center py-12 text-xs text-text-secondary">
          Aucun site avec cible (NB) renseignée pour cette période.
        </div>
      ) : (
        <div className="overflow-auto max-h-[460px]">
          <table className="border-separate border-spacing-0 text-xs" style={{ minWidth: "max-content" }}>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 bg-white z-30 text-left px-3 h-8 w-[240px] min-w-[240px] border-b border-r border-gray-100">
                  <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Site</span>
                </th>
                {monthCols.map((m) => (
                  <th key={m.key} className="sticky top-0 bg-white z-20 w-[44px] min-w-[44px] h-8 border-b border-gray-100">
                    <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">{m.label}</span>
                  </th>
                ))}
                <ThDivider />
                <th className="sticky top-0 bg-white z-20 px-2 w-[80px] min-w-[80px] h-8 border-b border-gray-100 text-right">
                  <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">NC</span>
                </th>
                <th className="sticky top-0 bg-white z-20 px-2 w-[80px] min-w-[80px] h-8 border-b border-gray-100 text-right">
                  <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Δ MWh</span>
                </th>
                <th className="sticky top-0 bg-white z-20 px-2 w-[64px] min-w-[64px] h-8 border-b border-gray-100 text-center">
                  <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Δ%</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rankedSites.map((site, rowIdx) => {
                const row = byCell.get(site.siteId);
                const yearly = deltaCell(site.deltaPercent);
                return (
                  <tr key={site.siteId} className="group">
                    <td
                      className={`sticky left-0 z-10 px-3 h-7 w-[240px] min-w-[240px] border-b border-r border-gray-100 ${
                        rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                      } group-hover:bg-accent/5`}
                    >
                      <Link href={`/energy/sites/${site.siteId}`} className="flex items-center gap-2">
                        <span className="text-[10px] tabular-nums text-gray-300 font-medium w-4 shrink-0">
                          {rowIdx + 1}
                        </span>
                        <span className="text-xs font-medium text-primary-dark truncate group-hover:text-accent transition-colors">
                          {site.siteName}
                        </span>
                      </Link>
                    </td>
                    {monthCols.map((col) => {
                      const md = row?.get(col.key);
                      const delta = md && md.nbPrime > 0 ? ((md.nc - md.nbPrime) / md.nbPrime) * 100 : null;
                      const cell = deltaCell(delta);
                      const hasData = md && md.nc > 0;
                      return (
                        <td key={col.key} className="border-b border-gray-100 p-0.5 align-middle">
                          <div
                            title={
                              hasData && delta !== null
                                ? `${site.siteName} · ${col.label}\nΔ ${cell.label}% — NC ${fmtMwh(md!.nc)} / N'B ${fmtMwh(md!.nbPrime)} MWh`
                                : `${site.siteName} · ${col.label} : pas de données`
                            }
                            className={`h-6 flex items-center justify-center rounded-[2px] text-[10px] font-semibold tabular-nums ${cell.bg} ${cell.text} ${hasData ? "cursor-help" : ""}`}
                          >
                            {hasData ? cell.label : ""}
                          </div>
                        </td>
                      );
                    })}
                    <TdDivider />
                    <td className={`h-7 px-2 text-right tabular-nums border-b border-gray-100 ${rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                      <span className="text-xs text-primary-dark font-medium">{fmtMwh(site.nc)}</span>
                    </td>
                    <td className={`h-7 px-2 text-right tabular-nums border-b border-gray-100 ${rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                      <span className={`text-xs font-medium ${site.delta > 0 ? "text-red-700" : site.delta < 0 ? "text-emerald-700" : "text-gray-500"}`}>
                        {fmtSignedMwh(site.delta)}
                      </span>
                    </td>
                    <td className="h-7 p-0.5 align-middle border-b border-gray-100">
                      <div className={`h-6 flex items-center justify-center rounded-[2px] text-[11px] font-bold tabular-nums ${yearly.bg} ${yearly.text}`}>
                        {yearly.label}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 z-10 bg-gray-50 px-3 h-8 w-[240px] min-w-[240px] border-t-2 border-gray-200 border-r border-gray-100">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-primary-dark">Moyenne</span>
                </td>
                {monthCols.map((col) => {
                  const agg = monthAggregates.get(col.key) ?? null;
                  const cell = deltaCell(agg);
                  return (
                    <td key={col.key} className="border-t-2 border-gray-200 p-0.5 align-middle bg-gray-50">
                      <div className={`h-6 flex items-center justify-center rounded-[2px] text-[10px] font-bold tabular-nums ${cell.bg} ${cell.text}`}>
                        {agg !== null ? cell.label : ""}
                      </div>
                    </td>
                  );
                })}
                <TdDivider foot />
                <td className="border-t-2 border-gray-200 h-8 px-2 text-right tabular-nums bg-gray-50">
                  <span className="text-xs text-primary-dark font-semibold">{summary ? fmtMwh(summary.totalNc) : ""}</span>
                </td>
                <td className="border-t-2 border-gray-200 h-8 px-2 text-right tabular-nums bg-gray-50">
                  <span className={`text-xs font-semibold ${summary && summary.totalDelta > 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {summary ? fmtSignedMwh(summary.totalDelta) : ""}
                  </span>
                </td>
                <td className="border-t-2 border-gray-200 h-8 p-0.5 align-middle bg-gray-50">
                  <div className={`h-6 flex items-center justify-center rounded-[2px] text-[11px] font-bold tabular-nums ${summary ? deltaCell(summary.deltaPercent).bg : "bg-gray-100"} ${summary ? deltaCell(summary.deltaPercent).text : "text-gray-500"}`}>
                    {summary ? fmtSignedPct(summary.deltaPercent) + "%" : "—"}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Légende ──────────────────────────────────────────────────── */}
      {comparableSites.length > 0 && (
        <div className="flex items-center justify-between px-4 h-8 border-t border-gray-100 text-[10px] text-text-secondary">
          <div className="flex items-center gap-1.5">
            <span className="uppercase tracking-wider font-semibold text-primary-dark mr-1">Échelle</span>
            <LegendSwatch bg="bg-emerald-600" value="≤−15" />
            <LegendSwatch bg="bg-emerald-200" value="−5" />
            <LegendSwatch bg="bg-gray-100" value="±5" />
            <LegendSwatch bg="bg-amber-200" value="+5" />
            <LegendSwatch bg="bg-orange-400" value="+15" />
            <LegendSwatch bg="bg-red-500" value="≥+30" />
          </div>
          <div className="tabular-nums italic">Trié par écart ↓ · clic site → détail</div>
        </div>
      )}
    </div>
  );
}

function ThDivider() {
  return <th className="sticky top-0 bg-white z-20 w-[1px] min-w-[1px] h-8 border-b border-gray-100 border-l border-gray-200" aria-hidden />;
}

function TdDivider({ foot = false }: { foot?: boolean }) {
  return <td className={`${foot ? "bg-gray-50 border-t-2 border-gray-200" : ""} border-b border-gray-100 border-l border-gray-200 w-[1px] min-w-[1px]`} aria-hidden />;
}

function LegendSwatch({ bg, value }: { bg: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 mr-2">
      <span className={`w-2.5 h-2.5 rounded-[2px] ${bg}`} />
      <span className="tabular-nums">{value}</span>
    </span>
  );
}
