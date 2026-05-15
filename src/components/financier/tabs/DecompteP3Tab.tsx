"use client";

import { useState, useMemo } from "react";
import { Loader2, Building2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

/** Affiche un montant ou un tiret discret si nul */
function MoneyOrDash({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  if (value === 0) return <span className="text-gray-300">—</span>;
  return (
    <span className={className}>
      {value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
    </span>
  );
}

/** Solde signé avec coloration vert si positif, rouge si négatif, gris/tiret si zéro */
function SignedBalance({
  value,
  bold = false,
}: {
  value: number;
  bold?: boolean;
}) {
  if (value === 0) return <span className="text-gray-300">—</span>;
  const color = value > 0 ? "text-green-600" : "text-red-600";
  return (
    <span className={`${color} ${bold ? "font-semibold" : "font-medium"} tabular-nums`}>
      {value > 0 ? "+" : ""}
      {value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
    </span>
  );
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

  // Échelle pour le bar chart : max absolu sur recettes + dépenses
  const chartMax = useMemo(() => {
    if (!p3Data) return 0;
    let max = 0;
    for (const y of p3Data.years) {
      max = Math.max(max, y.totalInvoices, y.totalQuotes);
    }
    return max;
  }, [p3Data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!p3Data || p3Data.years.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <Building2 size={36} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-text-secondary">Aucune donnée P3 disponible pour ce contrat</p>
      </div>
    );
  }

  const sortedSites: SiteP3Analytics[] = siteAnalytics
    ? [...siteAnalytics.sites].sort((a, b) => {
        const diff = a[sortKey] - b[sortKey];
        return sortDir === "asc" ? diff : -diff;
      })
    : [];

  const { totalInvoices, totalQuotes, finalBalance } = p3Data.totals;

  return (
    <div className="space-y-4">
      {/* ─────────── Bandeau KPI ─────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Recettes cumulées</p>
          <p className="text-2xl font-semibold text-primary-dark mt-1 tabular-nums">
            {totalInvoices === 0 ? (
              <span className="text-gray-300">—</span>
            ) : (
              `${totalInvoices.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`
            )}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Dépenses cumulées</p>
          <p className="text-2xl font-semibold text-primary-dark mt-1 tabular-nums">
            {totalQuotes === 0 ? (
              <span className="text-gray-300">—</span>
            ) : (
              `${totalQuotes.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`
            )}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-text-secondary uppercase tracking-wider">Solde P3 actuel</p>
          <p
            className={`text-2xl font-semibold mt-1 tabular-nums ${
              finalBalance > 0 ? "text-green-600" : finalBalance < 0 ? "text-red-600" : "text-gray-300"
            }`}
          >
            {finalBalance === 0
              ? "—"
              : `${finalBalance > 0 ? "+" : ""}${finalBalance.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}
          </p>
        </div>
      </div>

      {/* ─────────── Bar chart évolution annuelle ─────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-medium text-primary-dark">Évolution sur la durée du contrat</h3>
          <p className="text-xs text-text-secondary">
            Les recettes (haut) et dépenses (bas) sont représentées en regard de chaque année.
          </p>
        </div>

        {chartMax === 0 ? (
          <p className="text-sm text-text-secondary py-8 text-center">
            Aucun flux P3 enregistré sur la durée du contrat
          </p>
        ) : (
          <div className="flex items-end gap-2 sm:gap-3 overflow-x-auto pb-2">
            {p3Data.years.map((y) => {
              const recHeight = chartMax > 0 ? (y.totalInvoices / chartMax) * 80 : 0;
              const depHeight = chartMax > 0 ? (y.totalQuotes / chartMax) * 80 : 0;
              const hasFlow = y.totalInvoices > 0 || y.totalQuotes > 0;
              return (
                <div key={y.year} className="flex-1 min-w-[60px] flex flex-col items-center gap-1">
                  {/* Recette (bar haut, vert) */}
                  <div className="w-full h-[80px] flex items-end justify-center">
                    {y.totalInvoices > 0 ? (
                      <div
                        className="w-full max-w-[40px] bg-green-500/80 rounded-t hover:bg-green-500 transition-colors"
                        style={{ height: `${Math.max(2, recHeight)}px` }}
                        title={`Recettes: ${y.totalInvoices.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}
                      />
                    ) : null}
                  </div>
                  {/* Axe milieu */}
                  <div className="w-full h-px bg-gray-200" />
                  {/* Dépense (bar bas, rouge) */}
                  <div className="w-full h-[80px] flex items-start justify-center">
                    {y.totalQuotes > 0 ? (
                      <div
                        className="w-full max-w-[40px] bg-red-500/80 rounded-b hover:bg-red-500 transition-colors"
                        style={{ height: `${Math.max(2, depHeight)}px` }}
                        title={`Dépenses: ${y.totalQuotes.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}
                      />
                    ) : null}
                  </div>
                  {/* Label Année */}
                  <div className="text-[10px] font-medium text-text-secondary mt-1 text-center">
                    Année {y.contractYearIndex}
                  </div>
                  {/* Solde annuel */}
                  <div className="text-[10px] tabular-nums">
                    {hasFlow ? (
                      <SignedBalance value={y.balance} />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Légende */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-green-500/80" /> Recettes
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-red-500/80" /> Dépenses
          </span>
        </div>
      </div>

      {/* ─────────── Détail année (tableau compact) ─────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50/60 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-600 uppercase tracking-wider">Année</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-600 uppercase tracking-wider">Recettes</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-600 uppercase tracking-wider">Dépenses</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-600 uppercase tracking-wider">Solde P3</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-600 uppercase tracking-wider">Solde cumulé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {p3Data.years.map((y) => (
              <tr key={y.year} className="hover:bg-gray-50/40 transition-colors">
                <td className="px-4 py-2 text-sm text-primary-dark">
                  <span className="font-medium">Année {y.contractYearIndex}</span>
                  <span className="text-text-secondary text-xs ml-2">{y.label}</span>
                </td>
                <td className="px-4 py-2 text-sm text-right text-primary-dark tabular-nums">
                  <MoneyOrDash value={y.totalInvoices} />
                </td>
                <td className="px-4 py-2 text-sm text-right text-primary-dark tabular-nums">
                  <MoneyOrDash value={y.totalQuotes} />
                </td>
                <td className="px-4 py-2 text-sm text-right tabular-nums">
                  <SignedBalance value={y.balance} />
                </td>
                <td className="px-4 py-2 text-sm text-right tabular-nums">
                  <SignedBalance value={y.cumulativeBalance} bold />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─────────── Tableau sites ─────────── */}
      {loadingSiteAnalytics ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : siteAnalytics && siteAnalytics.sites.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-medium text-primary-dark">Consommation du solde par site</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Trié par solde le plus déficitaire
            </p>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50/60 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-600 uppercase tracking-wider">Site</th>
                {(["p3Invoices", "p3Quotes", "p3Balance"] as SortKey[]).map((key) => (
                  <th key={key} className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort(key)}
                      className="flex items-center gap-1 ml-auto hover:text-primary-dark transition-colors"
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
                <tr key={site.siteId} className="hover:bg-gray-50/40 transition-colors">
                  <td className="px-4 py-2.5 text-sm">
                    <div className="font-medium text-primary-dark">{site.siteName}</div>
                    {site.siteCity && (
                      <p className="text-xs text-text-secondary mt-0.5">{site.siteCity}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right text-primary-dark tabular-nums">
                    <MoneyOrDash value={site.p3Invoices} />
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right text-primary-dark tabular-nums">
                    <MoneyOrDash value={site.p3Quotes} />
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right tabular-nums">
                    <SignedBalance value={site.p3Balance} bold />
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
