"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Loader2,
  Euro,
  Calculator,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Building2,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";

interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  status: string;
  _count?: {
    contractSites: number;
  };
}

interface P3Invoice {
  id: string;
  reference: string;
  amount: number;
  issueDate: string;
  siteName: string;
}

interface P3Quote {
  id: string;
  reference: string;
  title: string;
  amountHT: number;
  issueDate: string;
  siteName: string;
  status: string;
}

interface P3Year {
  year: number;
  label: string;
  totalInvoices: number;
  totalQuotes: number;
  balance: number;
  cumulativeBalance: number;
  invoices: P3Invoice[];
  quotes: P3Quote[];
}

interface P3Data {
  totals: {
    totalInvoices: number;
    totalQuotes: number;
    finalBalance: number;
  };
  years: P3Year[];
}

export default function DecompteP3Page() {
  // Contract selection
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [loadingContracts, setLoadingContracts] = useState(true);

  // P3 data
  const [p3Data, setP3Data] = useState<P3Data | null>(null);
  const [loadingP3, setLoadingP3] = useState(false);

  // UI state
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // Fetch contracts on mount
  useEffect(() => {
    fetchContracts();
  }, []);

  // Fetch P3 data when contract selected
  useEffect(() => {
    if (selectedContract) {
      fetchP3Data(selectedContract.id);
    }
  }, [selectedContract]);

  const fetchContracts = async () => {
    try {
      setLoadingContracts(true);
      const response = await fetch("/api/contracts");
      if (response.ok) {
        const data = await response.json();
        // Filter contracts that have P3
        setContracts(data.filter((c: Contract) => c.status === "ACTIF"));
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setLoadingContracts(false);
    }
  };

  const fetchP3Data = async (contractId: string) => {
    try {
      setLoadingP3(true);
      const response = await fetch(`/api/contracts/${contractId}/p3-balance`);
      if (response.ok) {
        const data = await response.json();
        setP3Data(data);
        // Expand current year by default
        const currentYear = new Date().getFullYear();
        const yearData = data.years?.find((y: P3Year) => y.year === currentYear);
        if (yearData) {
          setExpandedYears(new Set([yearData.year]));
        }
      }
    } catch (error) {
      console.error("Error fetching P3 data:", error);
    } finally {
      setLoadingP3(false);
    }
  };

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  // Loading contracts
  if (loadingContracts) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // No contract selected
  if (!selectedContract) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Décompte P3</h1>
          <p className="text-text-secondary">Suivi du pot P3 par contrat (recettes vs dépenses)</p>
        </div>

        {contracts.length === 0 ? (
          <ChartCard title="Aucun contrat actif">
            <div className="flex flex-col items-center justify-center py-8">
              <FileText size={48} className="text-gray-300 mb-4" />
              <p className="text-text-secondary">Créez d&apos;abord un contrat</p>
            </div>
          </ChartCard>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contracts.map((contract) => (
              <button
                key={contract.id}
                onClick={() => setSelectedContract(contract)}
                className="bg-white rounded-xl border border-gray-100 p-6 text-left hover:border-accent hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
                    <PiggyBank size={24} className="text-green-600" />
                  </div>
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    Actif
                  </span>
                </div>
                <h3 className="font-semibold text-primary-dark mb-1">{contract.reference}</h3>
                <p className="text-sm text-text-secondary mb-3 line-clamp-1">{contract.title}</p>
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {contract.provider}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 size={14} />
                    {contract._count?.contractSites || 0} sites
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Contract selected - show P3 balance
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => {
                setSelectedContract(null);
                setP3Data(null);
              }}
              className="text-text-secondary hover:text-primary-dark"
            >
              Décompte P3
            </button>
            <span className="text-text-secondary">/</span>
            <span className="text-primary-dark font-medium">{selectedContract.reference}</span>
          </div>
          <h1 className="text-2xl font-bold text-primary-dark">{selectedContract.title}</h1>
          <p className="text-text-secondary">{selectedContract.provider}</p>
        </div>
        <div>
          <select
            value={selectedContract.id}
            onChange={(e) => {
              const contract = contracts.find((c) => c.id === e.target.value);
              if (contract) setSelectedContract(contract);
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference} - {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadingP3 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : p3Data ? (
        <>
          {/* Summary Cards */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <TrendingUp size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Factures P3 (Recettes)</p>
                  <p className="text-xs text-text-secondary">Alimentation du pot</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600">
                +{p3Data.totals.totalInvoices.toLocaleString("fr-FR")} €
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                  <TrendingDown size={20} className="text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Devis P3 validés (Dépenses)</p>
                  <p className="text-xs text-text-secondary">Travaux réalisés</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-red-600">
                -{p3Data.totals.totalQuotes.toLocaleString("fr-FR")} €
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    p3Data.totals.finalBalance >= 0 ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  <Calculator
                    size={20}
                    className={p3Data.totals.finalBalance >= 0 ? "text-green-600" : "text-red-600"}
                  />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Solde P3</p>
                  <p className="text-xs text-text-secondary">
                    {p3Data.totals.finalBalance >= 0 ? "Excédent" : "Déficit"}
                  </p>
                </div>
              </div>
              <p
                className={`text-2xl font-bold ${
                  p3Data.totals.finalBalance >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {p3Data.totals.finalBalance >= 0 ? "+" : ""}
                {p3Data.totals.finalBalance.toLocaleString("fr-FR")} €
              </p>
            </div>
          </div>

          {/* Table by year */}
          <ChartCard title="Évolution par année">
            {p3Data.years.length === 0 ? (
              <div className="text-center py-8">
                <Calculator size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-text-secondary">Aucune facture ou devis P3 pour ce contrat</p>
                <p className="text-sm text-text-secondary mt-2">
                  Les factures de type P3 et les devis validés apparaîtront ici
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">
                        Période
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-green-600">
                        Factures P3
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-red-600">
                        Devis P3
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-text-secondary">
                        Solde
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-primary-dark">
                        Solde cumulé
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {p3Data.years.map((year) => (
                      <tr
                        key={year.year}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleYear(year.year)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {expandedYears.has(year.year) ? (
                              <ChevronDown size={16} className="text-text-secondary" />
                            ) : (
                              <ChevronRight size={16} className="text-text-secondary" />
                            )}
                            <span className="font-medium text-primary-dark">{year.label}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 font-medium">
                          +{year.totalInvoices.toLocaleString("fr-FR")} €
                        </td>
                        <td className="py-3 px-4 text-right text-red-600 font-medium">
                          -{year.totalQuotes.toLocaleString("fr-FR")} €
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-medium ${
                            year.balance >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {year.balance >= 0 ? "+" : ""}
                          {year.balance.toLocaleString("fr-FR")} €
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold ${
                            year.cumulativeBalance >= 0 ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {year.cumulativeBalance >= 0 ? "+" : ""}
                          {year.cumulativeBalance.toLocaleString("fr-FR")} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td className="py-3 px-4 text-primary-dark">Total</td>
                      <td className="py-3 px-4 text-right text-green-600">
                        +{p3Data.totals.totalInvoices.toLocaleString("fr-FR")} €
                      </td>
                      <td className="py-3 px-4 text-right text-red-600">
                        -{p3Data.totals.totalQuotes.toLocaleString("fr-FR")} €
                      </td>
                      <td
                        className={`py-3 px-4 text-right ${
                          p3Data.totals.finalBalance >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {p3Data.totals.finalBalance >= 0 ? "+" : ""}
                        {p3Data.totals.finalBalance.toLocaleString("fr-FR")} €
                      </td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </ChartCard>

          {/* Details by year */}
          {p3Data.years
            .filter((y) => expandedYears.has(y.year) && (y.invoices.length > 0 || y.quotes.length > 0))
            .map((year) => (
              <ChartCard key={year.year} title={`Détail ${year.label}`}>
                <div className="space-y-6">
                  {/* Invoices */}
                  {year.invoices.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-green-600 mb-3 flex items-center gap-2">
                        <Euro size={16} />
                        Factures P3 ({year.invoices.length})
                      </h4>
                      <div className="space-y-2">
                        {year.invoices.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-primary-dark">{inv.reference}</p>
                              <p className="text-sm text-text-secondary">
                                {inv.siteName} •{" "}
                                {new Date(inv.issueDate).toLocaleDateString("fr-FR")}
                              </p>
                            </div>
                            <span className="font-bold text-green-600">
                              +{inv.amount.toLocaleString("fr-FR")} €
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quotes */}
                  {year.quotes.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-red-600 mb-3 flex items-center gap-2">
                        <FileText size={16} />
                        Devis P3 validés ({year.quotes.length})
                      </h4>
                      <div className="space-y-2">
                        {year.quotes.map((quote) => (
                          <Link
                            key={quote.id}
                            href={`/quotes?id=${quote.id}`}
                            className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <div>
                              <p className="font-medium text-primary-dark">{quote.reference}</p>
                              <p className="text-sm text-text-secondary">{quote.title}</p>
                              <p className="text-xs text-text-secondary">
                                {quote.siteName || "—"} •{" "}
                                {new Date(quote.issueDate).toLocaleDateString("fr-FR")} •{" "}
                                {quote.status}
                              </p>
                            </div>
                            <span className="font-bold text-red-600">
                              -{quote.amountHT.toLocaleString("fr-FR")} €
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ChartCard>
            ))}
        </>
      ) : (
        <ChartCard title="">
          <div className="text-center py-12">
            <PiggyBank size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-text-secondary">Aucune donnée P3 disponible</p>
          </div>
        </ChartCard>
      )}
    </div>
  );
}
