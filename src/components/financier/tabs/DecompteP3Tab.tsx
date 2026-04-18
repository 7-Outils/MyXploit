"use client";

import { Loader2, PiggyBank } from "lucide-react";
import type { P3BalanceData } from "@/components/financier/types";

interface DecompteP3TabProps {
  loading: boolean;
  p3Data: P3BalanceData | null;
  expandedP3Years: Set<string>;
  toggleP3Year: (year: string) => void;
}

export function DecompteP3Tab({ loading, p3Data }: DecompteP3TabProps) {
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

  const years = [...p3Data.years].reverse();

  return (
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
          {years.map(({ year, label, totalInvoices, totalQuotes, balance, cumulativeBalance }) => (
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
  );
}
