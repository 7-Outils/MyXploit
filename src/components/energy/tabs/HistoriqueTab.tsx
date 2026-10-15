"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { cn } from "@/lib/utils";

interface History {
  years: Array<{ year: string; total: number; dju: number | null; kwhPerDju: number | null; sitesWithData: number }>;
  sites: Array<{ id: string; name: string; byYear: Record<string, number> }>;
  currentYear: string;
}

const mwh = (v: number) => (v > 0 ? (v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—");
const delta = (a: number, b: number) => (a > 0 && b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);

/** Historique des consommations par année civile : total, DJU, kWh/DJU, puis sites × années. */
export function HistoriqueContent({ contractId }: { contractId: string | null }) {
  const { data, isLoading } = useSWR<History>(contractId ? `/api/consumptions/history?contractId=${contractId}` : null, fetcher);
  const years = useMemo(() => (Array.isArray(data?.years) ? data.years : []), [data]);
  const sites = useMemo(() => (Array.isArray(data?.sites) ? data.sites : []), [data]);

  if (isLoading && !data) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }
  if (years.length === 0) {
    return <div className="panel p-10 text-center text-sm text-ink/40">Aucune consommation enregistrée.</div>;
  }
  const current = data?.currentYear;

  return (
    <div className="space-y-4">
      {/* Par année */}
      <div className="panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ink/10 text-left">
              <th className="label-tech px-4 py-2.5">Année</th>
              <th className="label-tech px-4 py-2.5 text-right">MWh</th>
              <th className="label-tech px-4 py-2.5 text-right">Δ année −1</th>
              <th className="label-tech px-4 py-2.5 text-right">DJU</th>
              <th className="label-tech px-4 py-2.5 text-right">kWh / DJU</th>
              <th className="label-tech px-4 py-2.5 text-right">Sites avec données</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {years.slice().reverse().map((y, i, arr) => {
              const prev = arr[i + 1];
              const d = prev && y.year !== current ? delta(y.total, prev.total) : null;
              return (
                <tr key={y.year} className="hover:bg-ink/[0.02]">
                  <td className="px-4 py-2 font-mono text-sm tabular-nums text-ink">
                    {y.year}{y.year === current && <span className="ml-2 text-[10px] text-ink/35">en cours</span>}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-sm font-medium tabular-nums text-ink">{mwh(y.total)}</td>
                  <td className={cn("px-4 py-2 text-right font-mono text-xs tabular-nums", d === null ? "text-ink/25" : d > 0 ? "text-red-700" : d < 0 ? "text-green-700" : "text-ink/50")}>
                    {d === null ? "—" : `${d > 0 ? "+" : ""}${d.toLocaleString("fr-FR")} %`}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-ink/60">{y.dju == null ? "—" : y.dju.toLocaleString("fr-FR")}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-ink/60">{y.kwhPerDju == null ? "—" : y.kwhPerDju.toLocaleString("fr-FR")}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-ink/60">{y.sitesWithData}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sites × années */}
      <div className="panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ink/10 text-left">
              <th className="label-tech sticky left-0 bg-white px-4 py-2.5">Site</th>
              {years.map((y) => <th key={y.year} className="label-tech px-4 py-2.5 text-right">{y.year}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {sites.map((s) => (
              <tr key={s.id} className="hover:bg-ink/[0.02]">
                <td className="sticky left-0 max-w-[260px] truncate bg-white px-4 py-1.5 text-sm text-ink">{s.name}</td>
                {years.map((y) => (
                  <td key={y.year} className={cn("px-4 py-1.5 text-right font-mono text-sm tabular-nums", s.byYear[y.year] > 0 ? "text-ink" : "text-ink/25")}>{mwh(s.byYear[y.year])}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink/15">
              <td className="label-tech sticky left-0 bg-white px-4 py-2">Total · MWh</td>
              {years.map((y) => <td key={y.year} className="px-4 py-2 text-right font-mono text-sm font-medium tabular-nums text-ink">{mwh(y.total)}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
