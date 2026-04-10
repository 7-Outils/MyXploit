"use client";

import {
  Loader2,
  PiggyBank,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import type { P3BalanceData } from "@/components/financier/types";

interface DecompteP3TabProps {
  loading: boolean;
  p3Data: P3BalanceData | null;
  expandedP3Years: Set<string>;
  toggleP3Year: (year: string) => void;
}

export function DecompteP3Tab({
  loading,
  p3Data,
  expandedP3Years,
  toggleP3Year,
}: DecompteP3TabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!p3Data) {
    return (
      <ChartCard title="">
        <div className="text-center py-12">
          <PiggyBank size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-text-secondary">Aucune donnée P3 disponible</p>
        </div>
      </ChartCard>
    );
  }

  const { totals, years } = p3Data;

  return (
    <>
      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatsCard title="Factures P3 (encaissements)" value={`${totals.totalInvoices.toLocaleString("fr-FR")} €`} icon={ArrowUpRight} iconColor="text-green-600" />
        <StatsCard title="Devis P3 (dépenses)" value={`${totals.totalQuotes.toLocaleString("fr-FR")} €`} icon={ArrowDownRight} iconColor="text-red-600" />
        <StatsCard
          title="Solde cagnotte P3"
          value={`${totals.finalBalance.toLocaleString("fr-FR")} €`}
          icon={PiggyBank}
          iconColor={totals.finalBalance >= 0 ? "text-green-600" : "text-red-600"}
        />
      </div>

      {/* By year */}
      {years.length === 0 ? (
        <ChartCard title="">
          <div className="text-center py-12">
            <PiggyBank size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-text-secondary">Aucun mouvement P3</p>
          </div>
        </ChartCard>
      ) : (
        <div className="space-y-4">
          {[...years].reverse().map((yearData) => {
            const { year, label, invoices, quotes, totalInvoices, totalQuotes, balance, cumulativeBalance } = yearData;
            const isExpanded = expandedP3Years.has(year);
            const currentYear = new Date().getFullYear().toString();
            const isCurrent = year === currentYear || year.startsWith(currentYear);

            return (
              <div key={year} className={`border rounded-xl overflow-hidden ${isCurrent ? "border-accent" : "border-gray-200"}`}>
                <button
                  onClick={() => toggleP3Year(year)}
                  className={`w-full flex items-center justify-between p-4 transition-colors ${isCurrent ? "bg-accent/5 hover:bg-accent/10" : "bg-gray-50 hover:bg-gray-100"}`}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={18} className="text-text-secondary" /> : <ChevronRight size={18} className="text-text-secondary" />}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary-dark">{label}</span>
                        {isCurrent && <span className="px-2 py-0.5 bg-accent text-white text-xs rounded-full">En cours</span>}
                      </div>
                      <span className="text-xs text-text-secondary">
                        {invoices.length} facture{invoices.length > 1 ? "s" : ""} • {quotes.length} devis
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {balance >= 0 ? "+" : ""}
                      {balance.toLocaleString("fr-FR")} €
                    </p>
                    <p className="text-xs text-text-secondary">Solde cumulé: {cumulativeBalance.toLocaleString("fr-FR")} €</p>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-white space-y-4">
                    {invoices.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                          <ArrowUpRight size={14} />
                          Factures P3 (+{totalInvoices.toLocaleString("fr-FR")} €)
                        </p>
                        <div className="space-y-2">
                          {invoices.map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                              <div>
                                <p className="font-medium text-primary-dark text-sm">{inv.reference}</p>
                                <p className="text-xs text-text-secondary">
                                  {new Date(inv.issueDate).toLocaleDateString("fr-FR")}
                                  {inv.siteName && ` • ${inv.siteName}`}
                                </p>
                              </div>
                              <p className="font-medium text-green-600">+{inv.amount.toLocaleString("fr-FR")} €</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {quotes.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-700 mb-2 flex items-center gap-1">
                          <ArrowDownRight size={14} />
                          Devis P3 (-{totalQuotes.toLocaleString("fr-FR")} €)
                        </p>
                        <div className="space-y-2">
                          {quotes.map((q) => (
                            <div key={q.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                              <div>
                                <p className="font-medium text-primary-dark text-sm">{q.reference}</p>
                                <p className="text-xs text-text-secondary">
                                  {new Date(q.issueDate).toLocaleDateString("fr-FR")}
                                  {q.siteName && ` • ${q.siteName}`}
                                </p>
                              </div>
                              <p className="font-medium text-red-600">-{q.amountHT.toLocaleString("fr-FR")} €</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
