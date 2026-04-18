"use client";

import { useState } from "react";
import { Loader2, PiggyBank, Building2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { P3BalanceData, SiteAnalyticsData, SiteP3Analytics } from "@/components/financier/types";

type SortKey = "p3Invoices" | "p3Quotes" | "p3Balance";
type SortDir = "asc" | "desc";

interface DecompteP3TabProps {
  loading: boolean;
  p3Data: P3BalanceData | null;
  expandedP3Years: Set<string>;
  toggleP3Year: (year: string) => void;
  siteAnalytics: SiteAnalyticsData | null;
  loadingSiteAnalytics: boolean;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown size={13} className="text-gray-400" />;
  return sortDir === "asc" ? <ArrowUp size={13} className="text-accent" /> : <ArrowDown size={13} className="text-accent" />;
}

export function DecompteP3Tab({ loading, p3Data, siteAnalytics, loadingSiteAnalytics }: DecompteP3TabProps) {
  const [sortKey, setSortKey] = useState<SortKey>("p3Balance");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!p3Data || p3Data.years.length === 0) {
    return (
      <div className="text-center py-12">
        <PiggyBank size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-text-secondary">Aucune donnée P3 disponible</p>
      </div>
    );
  }

  const sortedSites: SiteP3Analytics[] = siteAnalytics
    ? [...siteAnalytics.sites].sort((a, b) => {
        const diff = a[sortKey] - b[sortKey];
        return sortDir === "asc" ? diff : -diff;
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Par année — ordre croissant */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Année</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Recettes</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Dépenses</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Solde P3</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Solde cumulé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {p3Data.years.map(({ year, label, totalInvoices, totalQuotes, balance, cumulativeBalance }) => (
              <tr key={year} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{label}</td>
                <td className="px-4 py-3 text-sm text-right text-green-600">{totalInvoices.toLocaleString("fr-FR")} €</td>
                <td className="px-4 py-3 text-sm text-right text-red-600">{totalQuotes.toLocaleString("fr-FR")} €</td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {balance >= 0 ? "+" : ""}{balance.toLocaleString("fr-FR")} €
                </td>
                <td className={`px-4 py-3 text-sm text-right font-semibold ${cumulativeBalance >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {cumulativeBalance >= 0 ? "+" : ""}{cumulativeBalance.toLocaleString("fr-FR")} €
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Par site */}
      {loadingSiteAnalytics ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : siteAnalytics && siteAnalytics.sites.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Site</th>
                {(["p3Invoices", "p3Quotes", "p3Balance"] as SortKey[]).map((key) => (
                  <th key={key} className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort(key)}
                      className="flex items-center gap-1 ml-auto hover:text-gray-900 transition-colors"
                    >
                      {key === "p3Invoices" ? "Recettes" : key === "p3Quotes" ? "Dépenses" : "Solde P3"}
                      <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedSites.map((site) => (
                <tr key={site.siteId} className={`hover:bg-gray-50 transition-colors ${site.p3Balance < 0 ? "bg-red-50/40" : ""}`}>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{site.siteName}</span>
                      {site.p3Balance < 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">Déficit</span>}
                    </div>
                    <p className="text-xs text-gray-500">{site.siteCity}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-green-600">{site.p3Invoices.toLocaleString("fr-FR")} €</td>
                  <td className="px-4 py-3 text-sm text-right text-red-600">{site.p3Quotes.toLocaleString("fr-FR")} €</td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${site.p3Balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {site.p3Balance >= 0 ? "+" : ""}{site.p3Balance.toLocaleString("fr-FR")} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
          <Building2 size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Aucun site avec activité P3</p>
        </div>
      )}
    </div>
  );
}
