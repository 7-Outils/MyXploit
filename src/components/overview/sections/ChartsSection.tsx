"use client";

import Link from "next/link";
import {
  Building2,
  TrendingDown,
  CheckCircle,
  Wrench,
  Bell,
  ChevronRight,
} from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { consumptionData } from "../constants";
import type { Equipment, ExpiringContract } from "../types";

interface ChartsSectionProps {
  profile: "CLIENT" | "AMO" | "EXPLOITANT" | null;
  equipmentInMaintenance: Equipment[];
  uniqueSitesFromActiveContracts: Array<{ id: string; name: string }>;
  expiringContracts: ExpiringContract[];
}

export function ChartsSection({
  profile,
  equipmentInMaintenance,
  uniqueSitesFromActiveContracts,
  expiringContracts,
}: ChartsSectionProps) {
  return (
    <>
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Consumption Chart */}
        <ChartCard
          title="Consommation énergétique"
          subtitle={profile === "AMO" ? "NC vs N'B (Performance)" : "Réel vs Référence (MWh)"}
          className="lg:col-span-2"
          action={
            <Link href="/energy" className="text-sm text-accent hover:underline">
              Voir détails
            </Link>
          }
        >
          <SimpleBarChart data={consumptionData} height={220} />
          <div className="flex items-center justify-center gap-4 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gradient-to-t from-accent to-accent-light rounded" />
              <span className="text-text-secondary">{profile === "AMO" ? "NC (Réel)" : "Réel"}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-200 rounded" />
              <span className="text-text-secondary">{profile === "AMO" ? "N'B (Théorique)" : "Référence"}</span>
            </div>
          </div>
        </ChartCard>

        {/* Profile-specific side panel */}
        {profile === "EXPLOITANT" ? (
          <ChartCard title="Équipements à traiter" subtitle={`${equipmentInMaintenance.length} intervention(s)`}>
            {equipmentInMaintenance.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
                <p className="text-sm text-text-secondary">Tous les équipements sont opérationnels</p>
              </div>
            ) : (
              <div className="space-y-4">
                {equipmentInMaintenance.slice(0, 5).map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${eq.status === "PANNE" ? "bg-red-500" : "bg-orange-500"}`} />
                      <div>
                        <span className="text-sm text-primary-dark truncate block max-w-[140px]">
                          {eq.name || eq.type}
                        </span>
                        <span className="text-xs text-gray-500">{eq.site.name}</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${eq.status === "PANNE" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                      {eq.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        ) : (
          <ChartCard title="Sites sous contrat" subtitle={`${uniqueSitesFromActiveContracts.length} sites actifs`}>
            {uniqueSitesFromActiveContracts.length === 0 ? (
              <div className="text-center py-8">
                <Building2 size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-text-secondary">Aucun site sous contrat actif</p>
                <Link href="/contracts" className="text-sm text-accent hover:underline">
                  Voir les contrats
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {uniqueSitesFromActiveContracts.slice(0, 5).map((site, index) => (
                  <div key={site.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center text-xs font-medium text-accent">
                        {index + 1}
                      </span>
                      <span className="text-sm text-primary-dark truncate max-w-[140px]">
                        {site.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary">
                        <TrendingDown size={12} className="inline text-green-600" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        )}
      </div>

      {/* Expiring Contracts Alert for EXPLOITANT */}
      {profile === "EXPLOITANT" && expiringContracts.length > 0 && (
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <Bell size={18} className="text-orange-500" />
              Contrats à renouveler
            </span>
          }
          subtitle={`${expiringContracts.length} contrat(s) arrivent à échéance dans les 6 prochains mois`}
          action={
            <Link href="/renewals" className="text-sm text-accent hover:underline flex items-center gap-1">
              Voir tout <ChevronRight size={14} />
            </Link>
          }
        >
          <div className="space-y-3">
            {expiringContracts.slice(0, 4).map((contract) => {
              const urgencyConfig = {
                EXPIRED: { color: "bg-gray-100 text-gray-700", dot: "bg-gray-500", label: "Expiré" },
                CRITICAL: { color: "bg-red-100 text-red-700", dot: "bg-red-500", label: "Critique" },
                HIGH: { color: "bg-orange-100 text-orange-700", dot: "bg-orange-500", label: "Urgent" },
                MEDIUM: { color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500", label: "Moyen" },
                LOW: { color: "bg-blue-100 text-blue-700", dot: "bg-blue-500", label: "Planifié" },
              };
              const config = urgencyConfig[contract.urgency];

              return (
                <Link
                  key={contract.id}
                  href={`/dimensioning?contractId=${contract.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary-dark truncate">{contract.title}</p>
                      <p className="text-xs text-gray-500">{contract.siteCount} site(s) • {contract.provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded ${config.color}`}>
                      {contract.daysUntilExpiry < 0
                        ? `Expiré depuis ${Math.abs(contract.daysUntilExpiry)}j`
                        : contract.daysUntilExpiry === 0
                        ? "Aujourd'hui"
                        : `${contract.daysUntilExpiry}j`}
                    </span>
                    <ChevronRight size={14} className="text-gray-400" />
                  </div>
                </Link>
              );
            })}
          </div>
          {expiringContracts.length > 4 && (
            <Link
              href="/renewals"
              className="mt-4 block text-center text-sm text-accent hover:underline"
            >
              +{expiringContracts.length - 4} autre(s) contrat(s)
            </Link>
          )}
        </ChartCard>
      )}
    </>
  );
}
