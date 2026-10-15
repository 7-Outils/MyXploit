"use client";

import { useMemo, useState } from "react";
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
  const [by, setBy] = useState<"civil" | "saison">("civil");
  const { data, isLoading } = useSWR<History>(contractId ? `/api/consumptions/history?contractId=${contractId}&by=${by}` : null, fetcher, { keepPreviousData: true });
  const years = useMemo(() => (Array.isArray(data?.years) ? data.years : []), [data]);
  const sites = useMemo(() => (Array.isArray(data?.sites) ? data.sites : []), [data]);

  if (isLoading && !data) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }
  const current = data?.currentYear;
  const label = by === "civil" ? "Année" : "Saison";
  const fmt = (y: string) => (by === "civil" ? y : y.replace("-", "/"));

  const Switch = (
    <div className="flex">
      {(["civil", "saison"] as const).map((v) => (
        <button key={v} type="button" onClick={() => setBy(v)} className={cn("h-9 border px-3 text-sm transition-colors -ml-px first:ml-0", by === v ? "border-accent bg-accent/5 text-accent" : "border-ink/20 bg-white text-ink/60 hover:text-ink")}>
          {v === "civil" ? "Année civile" : "Saison de chauffe"}
        </button>
      ))}
    </div>
  );

  if (years.length === 0) {
    return (
      <div className="space-y-4">
        {Switch}
        <div className="panel p-10 text-center text-sm text-ink/40">Aucune consommation enregistrée.</div>
      </div>
    );
  }

  const chart = (() => {
    const W = 960, H = 220, padL = 56, padR = 56, padT = 16, padB = 28;
    const n = years.length;
    const maxMwh = Math.max(1, ...years.map((y) => y.total / 1000));
    const ratios = years.map((y) => y.kwhPerDju ?? null);
    const maxRatio = Math.max(1, ...ratios.filter((r): r is number => r !== null));
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const slot = innerW / n;
    const x = (i: number) => padL + slot * i + slot / 2;
    const yM = (v: number) => padT + innerH - (v / maxMwh) * innerH;
    const yR = (v: number) => padT + innerH - (v / maxRatio) * innerH;
    const line = ratios.map((r, i) => (r === null ? null : `${x(i)},${yR(r)}`)).filter(Boolean).join(" ");
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Consommation par période et kWh par DJU">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={padL} x2={W - padR} y1={yM(maxMwh * f)} y2={yM(maxMwh * f)} stroke="rgba(15,30,51,.08)" />
        ))}
        {years.map((y, i) => {
          const bw = Math.min(48, slot * 0.55);
          const isCurrent = y.year === current;
          return (
            <g key={y.year}>
              <rect x={x(i) - bw / 2} y={yM(y.total / 1000)} width={bw} height={padT + innerH - yM(y.total / 1000)} fill={isCurrent ? "rgba(37,99,235,.35)" : "#2563eb"} />
              <text x={x(i)} y={yM(y.total / 1000) - 5} textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace" fill="#0f1e33">{mwh(y.total)}</text>
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace" fill="rgba(15,30,51,.5)">{fmt(y.year)}</text>
            </g>
          );
        })}
        {line && <polyline points={line} fill="none" stroke="#0f1e33" strokeWidth="1.5" strokeDasharray="4 3" />}
        {ratios.map((r, i) => r === null ? null : <circle key={i} cx={x(i)} cy={yR(r)} r="3" fill="#0f1e33" />)}
        <text x={padL - 6} y={padT + 10} textAnchor="end" fontSize="10" fontFamily="ui-monospace, monospace" fill="rgba(15,30,51,.5)">MWh</text>
        <text x={W - padR + 6} y={padT + 10} textAnchor="start" fontSize="10" fontFamily="ui-monospace, monospace" fill="rgba(15,30,51,.5)">kWh/DJU</text>
      </svg>
    );
  })();

  return (
    <div className="space-y-4">
      {Switch}
      <div className="panel">
        <div className="panel-header">
          <span className="label-tech">Consommation par {by === "civil" ? "année" : "saison"} · MWh</span>
          <span className="label-tech">— — kWh / DJU</span>
        </div>
        <div className="px-4 py-3">{chart}</div>
      </div>
      {/* Par année */}
      <div className="panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ink/10 text-left">
              <th className="label-tech px-4 py-2.5">{label}</th>
              <th className="label-tech px-4 py-2.5 text-right">MWh</th>
              <th className="label-tech px-4 py-2.5 text-right">Δ {by === "civil" ? "année" : "saison"} −1</th>
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
                    {fmt(y.year)}{y.year === current && <span className="ml-2 text-[10px] text-ink/35">en cours</span>}
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
              {years.map((y) => <th key={y.year} className="label-tech px-4 py-2.5 text-right">{fmt(y.year)}</th>)}
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
