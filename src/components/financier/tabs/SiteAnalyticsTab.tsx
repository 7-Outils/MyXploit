"use client";

import {
  Loader2,
  Building2,
  AlertCircle,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import type { SiteAnalyticsData } from "@/components/financier/types";

interface SiteAnalyticsTabProps {
  loading: boolean;
  data: SiteAnalyticsData | null;
}

export function SiteAnalyticsTab({
  loading,
  data,
}: SiteAnalyticsTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!data) {
    return (
      <ChartCard title="">
        <div className="text-center py-12">
          <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-text-secondary">Aucune donnée disponible</p>
        </div>
      </ChartCard>
    );
  }

  const { sites, totals } = data;

  // Sites with negative P3 balance (overspent P3)
  const p3OverspentSites = sites.filter(s => s.p3Balance < 0);
  const p3PositiveSites = sites.filter(s => s.p3Balance > 0);

  return (
    <>
      {/* Summary Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatsCard
          title="Factures P3 (encaissements)"
          value={`${totals.p3Invoices.toLocaleString("fr-FR")} €`}
          icon={ArrowUpRight}
          iconColor="text-green-600"
        />
        <StatsCard
          title="Devis P3 (dépenses)"
          value={`${totals.p3Quotes.toLocaleString("fr-FR")} €`}
          icon={ArrowDownRight}
          iconColor="text-red-600"
        />
        <StatsCard
          title="Solde P3 global"
          value={`${totals.p3Balance.toLocaleString("fr-FR")} €`}
          icon={PiggyBank}
          iconColor={totals.p3Balance >= 0 ? "text-green-600" : "text-red-600"}
        />
      </div>

      {/* Alerts */}
      {p3OverspentSites.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Sites avec solde P3 négatif</p>
              <p className="text-sm text-red-700 mt-1">
                {p3OverspentSites.length} site{p3OverspentSites.length > 1 ? "s ont" : " a"} sur-consommé leur cagnotte P3.
                À prévoir pour le prochain contrat : augmenter le P3 ou réduire les interventions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sites table */}
      <ChartCard title="Décompte P3 par site">
        {sites.length === 0 ? (
          <div className="text-center py-8">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-text-secondary">Aucun site avec activité P3</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Site</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-green-600">Factures P3</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-red-600">Devis P3</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-primary-dark">Solde P3</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => {
                  const isP3Negative = site.p3Balance < 0;
                  return (
                    <tr
                      key={site.siteId}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${isP3Negative ? "bg-red-50/50" : ""}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-primary-dark">{site.siteName}</span>
                          {isP3Negative && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">Déficit</span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary">{site.siteCity}</p>
                      </td>
                      <td className="py-3 px-4 text-right text-green-600">
                        +{site.p3Invoices.toLocaleString("fr-FR")} €
                        <span className="text-xs text-text-secondary ml-1">({site.p3InvoiceCount})</span>
                      </td>
                      <td className="py-3 px-4 text-right text-red-600">
                        -{site.p3Quotes.toLocaleString("fr-FR")} €
                        <span className="text-xs text-text-secondary ml-1">({site.p3QuoteCount})</span>
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${isP3Negative ? "text-red-600" : "text-green-600"}`}>
                        {site.p3Balance >= 0 ? "+" : ""}{site.p3Balance.toLocaleString("fr-FR")} €
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td className="py-3 px-4 text-primary-dark">Total ({sites.length} sites)</td>
                  <td className="py-3 px-4 text-right text-green-600">+{totals.p3Invoices.toLocaleString("fr-FR")} €</td>
                  <td className="py-3 px-4 text-right text-red-600">-{totals.p3Quotes.toLocaleString("fr-FR")} €</td>
                  <td className={`py-3 px-4 text-right ${totals.p3Balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {totals.p3Balance >= 0 ? "+" : ""}{totals.p3Balance.toLocaleString("fr-FR")} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </ChartCard>

      {/* Recommendation */}
      <div className="p-4 bg-blue-50 rounded-xl">
        <p className="text-sm text-blue-700">
          <strong>Pour le prochain contrat :</strong> Les sites en déficit P3 nécessitent soit une augmentation
          du montant P3 annuel, soit une réduction des interventions. Les sites avec excédent peuvent voir
          leur P3 réduit si le matériel est en bon état.
        </p>
        {p3OverspentSites.length > 0 && (
          <p className="text-sm text-red-700 mt-2">
            <strong>Déficit total à combler :</strong> {Math.abs(p3OverspentSites.reduce((sum, s) => sum + s.p3Balance, 0)).toLocaleString("fr-FR")} €
            sur {p3OverspentSites.length} site{p3OverspentSites.length > 1 ? "s" : ""}
          </p>
        )}
        {p3PositiveSites.length > 0 && (
          <p className="text-sm text-green-700 mt-2">
            <strong>Excédent disponible :</strong> {p3PositiveSites.reduce((sum, s) => sum + s.p3Balance, 0).toLocaleString("fr-FR")} €
            sur {p3PositiveSites.length} site{p3PositiveSites.length > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </>
  );
}
