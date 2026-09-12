"use client";

import { useState } from "react";
import { Loader2, Building2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { P3BalanceData, SiteAnalyticsData, SiteP3Analytics } from "@/components/financier/types";

/**
 * Solde P3 : une ligne de tête avec le seul chiffre qui compte (le cumulé),
 * puis deux tableaux côte à côte — par année, par site — sur une largeur
 * contenue. Pas de graphique : les colonnes alignées se lisent mieux.
 */

type SortKey = "p3Invoices" | "p3Quotes" | "p3Balance";
type SortDir = "asc" | "desc";

interface DecompteP3TabProps {
  loading: boolean;
  p3Data: P3BalanceData | null;
  siteAnalytics: SiteAnalyticsData | null;
  loadingSiteAnalytics: boolean;
}

const fmt = (v: number, digits = 0) => v.toLocaleString("fr-FR", { maximumFractionDigits: digits });

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown size={12} className="text-ink/30" />;
  return sortDir === "asc" ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />;
}

/** Montant, ou tiret discret si nul. */
function Money({ value }: { value: number }) {
  if (value === 0) return <span className="text-ink/25">—</span>;
  return <>{fmt(value)} €</>;
}

/** Solde signé : vert positif, rouge négatif, tiret si nul. */
function Signed({ value, bold = false }: { value: number; bold?: boolean }) {
  if (value === 0) return <span className="text-ink/25">—</span>;
  return (
    <span className={`${value > 0 ? "text-green-700" : "text-red-700"} ${bold ? "font-semibold" : ""}`}>
      {value > 0 ? "+" : "−"}
      {fmt(Math.abs(value))} €
    </span>
  );
}

const NUM = "px-3 py-2 text-right font-mono text-[13px] tabular-nums text-ink";
const TH_NUM = "label-tech px-3 py-2.5 text-right";

export function DecompteP3Tab({ loading, p3Data, siteAnalytics, loadingSiteAnalytics }: DecompteP3TabProps) {
  const [sortKey, setSortKey] = useState<SortKey>("p3Balance");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const unallocated = siteAnalytics?.unallocatedP3Invoices ?? 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!p3Data || p3Data.years.length === 0) {
    return (
      <div className="border border-ink/10 bg-white py-12 text-center">
        <Building2 size={36} className="mx-auto mb-3 text-ink/25" />
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
  const startYear = new Date(p3Data.startDate).getFullYear();
  const endYear = new Date(p3Data.endDate).getFullYear();

  return (
    <div className="space-y-4">
      {/* ── Ligne de tête ── */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-ink/15 pb-3">
        <div>
          <p className="label-tech">Solde P3 cumulé</p>
          <p
            className={`mt-0.5 font-mono text-2xl font-semibold tabular-nums ${
              finalBalance > 0 ? "text-green-700" : finalBalance < 0 ? "text-red-700" : "text-ink/25"
            }`}
          >
            {finalBalance === 0 ? "—" : `${finalBalance > 0 ? "+" : "−"}${fmt(Math.abs(finalBalance))} €`}
          </p>
        </div>
        <p className="font-mono text-[12px] tabular-nums text-text-secondary">
          Recettes {fmt(totalInvoices)} € · Dépenses {fmt(totalQuotes)} € · {startYear} → {endYear}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Par année ── */}
        <div className="border border-ink/10 bg-white">
          <div className="border-b border-ink/10 px-4 py-2.5">
            <h3 className="label-tech">Par année</h3>
          </div>
          <table className="w-full">
            <thead className="bg-white">
              <tr>
                <th className="label-tech px-3 py-2.5 text-left">Année</th>
                <th className={TH_NUM}>Recettes</th>
                <th className={TH_NUM}>Dépenses</th>
                <th className={TH_NUM}>Solde</th>
                <th className={TH_NUM}>Cumulé</th>
              </tr>
            </thead>
            <tbody>
              {p3Data.years.map((y) => (
                <tr key={y.year} className="border-t border-ink/[0.06] hover:bg-ink/[0.02]">
                  <td className="px-3 py-2 text-[13px] text-ink">
                    <span className="font-mono tabular-nums text-ink/50">{y.contractYearIndex}</span>
                    <span className="ml-2">{y.label}</span>
                  </td>
                  <td className={NUM}><Money value={y.totalInvoices} /></td>
                  <td className={NUM}><Money value={y.totalQuotes} /></td>
                  <td className={NUM}><Signed value={y.balance} /></td>
                  <td className={NUM}><Signed value={y.cumulativeBalance} bold /></td>
                </tr>
              ))}
              <tr className="border-t border-ink/15 bg-ink/[0.02]">
                <td className="px-3 py-2 text-[13px] font-semibold text-ink">Total</td>
                <td className={`${NUM} font-semibold`}><Money value={totalInvoices} /></td>
                <td className={`${NUM} font-semibold`}><Money value={totalQuotes} /></td>
                <td className={NUM} />
                <td className={NUM}><Signed value={finalBalance} bold /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Par site ── */}
        <div className="border border-ink/10 bg-white">
          <div className="flex items-baseline justify-between border-b border-ink/10 px-4 py-2.5">
            <h3 className="label-tech">Par site</h3>
            <span className="text-[11px] text-text-secondary">
              {sortKey === "p3Balance" && sortDir === "asc" ? "déficit en tête" : ""}
            </span>
          </div>
          {loadingSiteAnalytics ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            </div>
          ) : sortedSites.length > 0 ? (
            <div className="max-h-[26rem] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="label-tech px-3 py-2.5 text-left">Site</th>
                    {(
                      [
                        ["p3Invoices", "Recettes"],
                        ["p3Quotes", "Dépenses"],
                        ["p3Balance", "Solde"],
                      ] as [SortKey, string][]
                    ).map(([key, label]) => (
                      <th key={key} className={TH_NUM}>
                        <button
                          type="button"
                          onClick={() => handleSort(key)}
                          title={`Trier par ${label.toLowerCase()}`}
                          className="ml-auto flex items-center gap-1 hover:text-ink"
                        >
                          {label}
                          <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedSites.map((site) => (
                    <tr key={site.siteId} className="border-t border-ink/[0.06] hover:bg-ink/[0.02]">
                      <td className="px-3 py-2 text-[13px] text-ink">
                        <span className="block truncate" title={site.siteCity ? `${site.siteName} — ${site.siteCity}` : site.siteName}>
                          {site.siteName}
                        </span>
                      </td>
                      <td className={NUM}><Money value={site.p3Invoices} /></td>
                      <td className={NUM}><Money value={site.p3Quotes} /></td>
                      <td className={NUM}><Signed value={site.p3Balance} bold /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-ink/50">Aucun site avec activité P3</p>
          )}
          {/* Lignes facturées sur un libellé qui ne correspond à aucun site du
              contrat : le montant existe, mais l'attribuer au prorata
              inventerait des recettes sur des sites qui n'ont rien reçu. */}
          {!loadingSiteAnalytics && unallocated > 0 && (
            <div className="flex items-baseline justify-between border-t border-ink/10 px-3 py-2">
              <span className="text-[12px] text-[#8a6200]">Non rattaché à un site</span>
              <span className="font-mono text-[13px] tabular-nums text-[#8a6200]">
                {fmt(unallocated)} €
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
