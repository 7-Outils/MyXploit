"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { Loader2 } from "lucide-react";

type PType = "P1" | "P2" | "P3";

interface SiteTimeline {
  contractSiteId: string;
  siteId: string;
  siteName: string;
  siteCity: string;
  baseByP: Record<PType, number | null>;
  amountsByP: Record<PType, Record<number, number | null>>;
}

interface TimelineData {
  startYear: number;
  endYear: number;
  years: number[];
  sites: SiteTimeline[];
  totalsByP: Record<PType, Record<number, number>>;
}

function formatEuro(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " €";
}

function formatDelta(prev: number | null | undefined, curr: number | null | undefined): string | null {
  if (prev == null || curr == null || prev === 0) return null;
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 0.01) return null;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export default function ContractMontantsTab({ contractId }: { contractId: string }) {
  const { data, isLoading } = useSWR<TimelineData>(
    `/api/contracts/${contractId}/amounts-timeline`, fetcher
  );
  const [selectedP, setSelectedP] = useState<PType>("P3");

  const sitesWithP = useMemo(() => {
    if (!data) return [];
    return data.sites.filter((s) => {
      const vals = Object.values(s.amountsByP[selectedP]);
      return vals.some((v) => v != null && v !== 0);
    });
  }, [data, selectedP]);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!data || data.sites.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-ink/50">Aucun site rattaché au contrat</p>
      </div>
    );
  }

  const { years, totalsByP } = data;

  return (
    <div className="space-y-4">
      {/* Sélecteur P */}
      <div className="inline-flex border border-ink/20">
        {(["P1", "P2", "P3"] as PType[]).map((p) => (
          <button
            key={p}
            onClick={() => setSelectedP(p)}
            className={`px-4 py-1.5 font-mono text-xs uppercase tracking-widest transition-colors ${
              selectedP === p ? "bg-accent/5 text-accent" : "text-ink/50 hover:text-accent"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Tableau */}
      {sitesWithP.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="text-sm text-ink/50">Aucun site avec un forfait {selectedP}</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink/10">
                <tr>
                  <th className="label-tech whitespace-nowrap px-4 py-2.5 text-left">Site</th>
                  {years.map((y) => (
                    <th key={y} className="label-tech whitespace-nowrap px-4 py-2.5 text-right">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {sitesWithP.map((s) => (
                  <tr key={s.contractSiteId} className="hover:bg-ink/[0.02]">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-ink">{s.siteName}</div>
                      {s.siteCity && <div className="text-xs text-ink/50">{s.siteCity}</div>}
                    </td>
                    {years.map((y, i) => {
                      const val = s.amountsByP[selectedP][y];
                      const prev = i > 0 ? s.amountsByP[selectedP][years[i - 1]] : null;
                      const delta = formatDelta(prev, val);
                      return (
                        <td key={y} className="px-4 py-2.5 text-right">
                          <div className="font-mono tabular-nums text-ink">{formatEuro(val)}</div>
                          {delta && <div className="font-mono tabular-nums text-xs text-ink/40">{delta}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-ink/20">
                <tr>
                  <td className="label-tech px-4 py-2.5">Total</td>
                  {years.map((y, i) => {
                    const val = totalsByP[selectedP][y];
                    const prev = i > 0 ? totalsByP[selectedP][years[i - 1]] : null;
                    const delta = formatDelta(prev, val);
                    return (
                      <td key={y} className="px-4 py-2.5 text-right">
                        <div className="font-mono tabular-nums font-semibold text-ink">{formatEuro(val)}</div>
                        {delta && <div className="font-mono tabular-nums text-xs text-ink/50">{delta}</div>}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-ink/50">
        Les montants affichés sont ceux applicables au 1<sup>er</sup> janvier de chaque année (dernière révision en vigueur à cette date, ou forfait initial P₀ si aucune révision).
      </p>
    </div>
  );
}
