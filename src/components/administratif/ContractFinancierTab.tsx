"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Loader2,
  FileText,
  Euro,
  CheckCircle,
  Calculator,
} from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";

interface Acompte {
  number: number;
  label: string;
  periodStart: string;
  periodEnd: string;
  billingDate: string;
  percentage: number;
  amountP2: number;
  amountP3: number;
  total: number;
  isPaid: boolean;
  isCurrent: boolean;
}

interface SeasonSite {
  siteId: string;
  siteName: string;
  amountP2: number;
  amountP3: number;
  total: number;
}

interface Season {
  label: string;
  startDate: string;
  endDate: string;
  totalP2: number;
  totalP3: number;
  total: number;
  acomptes: Acompte[];
  sites: SeasonSite[];
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
}

interface FinancialSummary {
  currentSeasonLabel: string;
  currentSeasonTotal: number;
  currentSeasonPaid: number;
  currentSeasonRemaining: number;
  totalPastSeasons: number;
  totalFutureSeasons: number;
  totalContract: number;
  seasonCount: number;
}

interface FinancialData {
  contract?: {
    id: string;
    reference: string;
    title: string;
    startDate: string;
    endDate: string;
    yearType?: "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";
    billingFrequency?: "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";
  };
  summary: FinancialSummary;
  seasons: Season[];
  periodLabel?: string;
  billingFrequency?: string;
}

interface ContractSite {
  id: string;
  contractType: string;
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
  hasP4: boolean;
  amountP2: number | null;
  amountP3: number | null;
  site: { id: string; name: string };
}

interface Contract {
  id: string;
  contractSites: ContractSite[];
}

interface ContractFinancierTabProps {
  contractId: string;
  contract: Contract;
}

export default function ContractFinancierTab({ contractId, contract }: ContractFinancierTabProps) {
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);

  const fetchFinancials = async () => {
    setLoadingFinancials(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/financials`);
      if (response.ok) {
        const data = await response.json();
        setFinancialData(data);
      }
    } catch (error) {
      console.error("Error fetching financials:", error);
    } finally {
      setLoadingFinancials(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, [contractId]);

  const hasAnyP2 = contract.contractSites.some((cs) => cs.hasP2);
  const hasAnyP3 = contract.contractSites.some((cs) => cs.hasP3);

  if (loadingFinancials) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!financialData) {
    return (
      <ChartCard title="">
        <div className="text-center py-12">
          <Euro size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-text-secondary">Aucune donnée financière disponible</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ChartCard title="" className="text-center">
          <div className="flex flex-col items-center -mt-2">
            <Euro size={24} className="text-accent mb-2" />
            <p className="text-xs text-text-secondary">Total contrat</p>
            <p className="text-2xl font-bold text-primary-dark">
              {financialData.summary.totalContract.toLocaleString("fr-FR")} €
            </p>
            <p className="text-xs text-text-secondary">
              {financialData.summary.seasonCount} {financialData.periodLabel?.toLowerCase() || "périodes"}
            </p>
          </div>
        </ChartCard>

        <ChartCard title="" className="text-center">
          <div className="flex flex-col items-center -mt-2">
            <Calendar size={24} className="text-blue-600 mb-2" />
            <p className="text-xs text-text-secondary">Période en cours</p>
            <p className="text-2xl font-bold text-primary-dark">
              {financialData.summary.currentSeasonTotal.toLocaleString("fr-FR")} €
            </p>
            <p className="text-xs text-text-secondary">{financialData.summary.currentSeasonLabel}</p>
          </div>
        </ChartCard>

        <ChartCard title="" className="text-center">
          <div className="flex flex-col items-center -mt-2">
            <CheckCircle size={24} className="text-green-600 mb-2" />
            <p className="text-xs text-text-secondary">Payé cette période</p>
            <p className="text-2xl font-bold text-green-600">
              {financialData.summary.currentSeasonPaid.toLocaleString("fr-FR")} €
            </p>
            <p className="text-xs text-text-secondary">
              Reste: {financialData.summary.currentSeasonRemaining.toLocaleString("fr-FR")} €
            </p>
          </div>
        </ChartCard>
      </div>

      {/* Quick Links */}
      <ChartCard title="Accès rapide">
        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            href="/invoices"
            className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-accent hover:bg-accent/5 transition-all group"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <FileText size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-primary-dark">Facturation</p>
              <p className="text-sm text-text-secondary">Acomptes et échéances</p>
            </div>
          </Link>

          <Link
            href="/budget"
            className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-accent hover:bg-accent/5 transition-all group"
          >
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <Euro size={24} className="text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-primary-dark">Budget</p>
              <p className="text-sm text-text-secondary">Analyse par période</p>
            </div>
          </Link>

          {hasAnyP3 && (
            <Link
              href="/decompte-p3"
              className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-accent hover:bg-accent/5 transition-all group"
            >
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                <Calculator size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-primary-dark">Décompte P3</p>
                <p className="text-sm text-text-secondary">Pot P3 et solde</p>
              </div>
            </Link>
          )}
        </div>
      </ChartCard>

      {/* Montants par site */}
      <ChartCard title="Montants contractuels par site">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Site</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Type</th>
                {hasAnyP2 && <th className="text-right py-3 px-4 text-sm font-medium text-blue-600">P2 / an</th>}
                {hasAnyP3 && <th className="text-right py-3 px-4 text-sm font-medium text-green-600">P3 / an</th>}
                <th className="text-right py-3 px-4 text-sm font-medium text-primary-dark">Total / an</th>
              </tr>
            </thead>
            <tbody>
              {contract.contractSites.map((cs) => (
                <tr key={cs.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="font-medium text-primary-dark">{cs.site.name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">{cs.contractType}</span>
                  </td>
                  {hasAnyP2 && (
                    <td className="py-3 px-4 text-right text-blue-600 font-medium">
                      {cs.amountP2 ? `${cs.amountP2.toLocaleString("fr-FR")} €` : "-"}
                    </td>
                  )}
                  {hasAnyP3 && (
                    <td className="py-3 px-4 text-right text-green-600 font-medium">
                      {cs.amountP3 ? `${cs.amountP3.toLocaleString("fr-FR")} €` : "-"}
                    </td>
                  )}
                  <td className="py-3 px-4 text-right font-bold text-primary-dark">
                    {((cs.amountP2 || 0) + (cs.amountP3 || 0)).toLocaleString("fr-FR")} €
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-bold">
                <td className="py-3 px-4 text-primary-dark" colSpan={2}>Total annuel</td>
                {hasAnyP2 && (
                  <td className="py-3 px-4 text-right text-blue-600">
                    {contract.contractSites.reduce((sum, cs) => sum + (cs.amountP2 || 0), 0).toLocaleString("fr-FR")} €
                  </td>
                )}
                {hasAnyP3 && (
                  <td className="py-3 px-4 text-right text-green-600">
                    {contract.contractSites.reduce((sum, cs) => sum + (cs.amountP3 || 0), 0).toLocaleString("fr-FR")} €
                  </td>
                )}
                <td className="py-3 px-4 text-right text-primary-dark">
                  {contract.contractSites.reduce((sum, cs) => sum + (cs.amountP2 || 0) + (cs.amountP3 || 0), 0).toLocaleString("fr-FR")} €
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
