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
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-text-secondary">Aucun site rattaché au contrat</p>
      </div>
    );
  }

  const { years, totalsByP } = data;

  return (
    <div className="space-y-4">
      {/* Sélecteur P */}
      <div className="inline-flex bg-gray-100 rounded-lg p-1">
        {(["P1", "P2", "P3"] as PType[]).map((p) => (
          <button
            key={p}
            onClick={() => setSelectedP(p)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              selectedP === p ? "bg-white shadow text-primary-dark font-medium" : "text-text-secondary hover:text-primary-dark"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Tableau */}
      {sitesWithP.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-text-secondary">Aucun site avec un forfait {selectedP}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Site</th>
                  {years.map((y) => (
                    <th key={y} className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sitesWithP.map((s) => (
                  <tr key={s.contractSiteId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{s.siteName}</div>
                      {s.siteCity && <div className="text-xs text-gray-500">{s.siteCity}</div>}
                    </td>
                    {years.map((y, i) => {
                      const val = s.amountsByP[selectedP][y];
                      const prev = i > 0 ? s.amountsByP[selectedP][years[i - 1]] : null;
                      const delta = formatDelta(prev, val);
                      return (
                        <td key={y} className="px-4 py-3 text-right">
                          <div className="font-medium text-gray-900">{formatEuro(val)}</div>
                          {delta && <div className="text-xs text-gray-400">{delta}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-900">Total</td>
                  {years.map((y, i) => {
                    const val = totalsByP[selectedP][y];
                    const prev = i > 0 ? totalsByP[selectedP][years[i - 1]] : null;
                    const delta = formatDelta(prev, val);
                    return (
                      <td key={y} className="px-4 py-3 text-right">
                        <div className="font-semibold text-gray-900">{formatEuro(val)}</div>
                        {delta && <div className="text-xs text-gray-500">{delta}</div>}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-text-secondary">
        Les montants affichés sont ceux applicables au 1<sup>er</sup> janvier de chaque année (dernière révision en vigueur à cette date, ou forfait initial P₀ si aucune révision).
      </p>
    </div>
  );
}
