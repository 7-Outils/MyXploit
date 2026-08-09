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
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Consumption Chart */}
        <ChartCard
          title="Consommation énergétique"
          subtitle={profile === "AMO" ? "NC vs N'B (Performance)" : "Réel vs Référence (MWh)"}
          className="lg:col-span-2"
          action={
            <Link href="/energy" className="font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent transition-colors">
              Voir détails
            </Link>
          }
        >
          <SimpleBarChart data={consumptionData} height={220} />
          <div className="flex items-center justify-center gap-6 mt-3 border-t border-ink/10 pt-2.5">
            <span className="flex items-center gap-2 font-mono text-[11px] text-ink/60">
              <span className="inline-block h-px w-6 bg-accent" />
              {profile === "AMO" ? "NC (Réel)" : "Réel"}
            </span>
            <span className="flex items-center gap-2 font-mono text-[11px] text-ink/60">
              <span className="inline-block h-px w-6 bg-ink/25" />
              {profile === "AMO" ? "N'B (Théorique)" : "Référence"}
            </span>
          </div>
        </ChartCard>

        {/* Profile-specific side panel */}
        {profile === "EXPLOITANT" ? (
          <ChartCard title="Équipements à traiter" subtitle={`${equipmentInMaintenance.length} intervention(s)`}>
            {equipmentInMaintenance.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle size={24} className="mx-auto text-green-600 mb-2" />
                <p className="text-sm text-ink/50">Tous les équipements sont opérationnels</p>
              </div>
            ) : (
              <div className="-mx-4 -my-4 divide-y divide-ink/10">
                {equipmentInMaintenance.slice(0, 5).map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${eq.status === "PANNE" ? "bg-red-600" : "bg-amber-600"}`} />
                      <div className="min-w-0">
                        <span className="text-sm text-ink truncate block">
                          {eq.name || eq.type}
                        </span>
                        <span className="text-xs text-ink/50">{eq.site.name}</span>
                      </div>
                    </div>
                    <span className={`font-mono text-[10px] uppercase tracking-widest shrink-0 ${eq.status === "PANNE" ? "text-red-700" : "text-amber-700"}`}>
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
                <Building2 size={24} className="mx-auto text-ink/25 mb-2" />
                <p className="text-sm text-ink/50">Aucun site sous contrat actif</p>
                <Link href="/contracts" className="font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent transition-colors">
                  Voir les contrats
                </Link>
              </div>
            ) : (
              <div className="-mx-4 -my-4 divide-y divide-ink/10">
                {uniqueSitesFromActiveContracts.slice(0, 5).map((site, index) => (
                  <div key={site.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-[11px] tabular-nums text-ink/40 shrink-0">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm text-ink truncate">
                        {site.name}
                      </span>
                    </div>
                    <TrendingDown size={12} className="text-green-600 shrink-0" />
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
              <Bell size={14} className="text-amber-600" />
              Contrats à renouveler
            </span>
          }
          subtitle={`${expiringContracts.length} contrat(s) arrivent à échéance dans les 6 prochains mois`}
          action={
            <Link href="/renewals" className="font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent flex items-center gap-1 transition-colors">
              Voir tout <ChevronRight size={13} />
            </Link>
          }
        >
          <div className="-mx-4 -mt-4 divide-y divide-ink/10">
            {expiringContracts.slice(0, 4).map((contract) => {
              const urgencyConfig = {
                EXPIRED: { color: "text-ink/50", dot: "bg-ink/40", label: "Expiré" },
                CRITICAL: { color: "text-red-700", dot: "bg-red-600", label: "Critique" },
                HIGH: { color: "text-amber-700", dot: "bg-amber-600", label: "Urgent" },
                MEDIUM: { color: "text-amber-700", dot: "bg-amber-500", label: "Moyen" },
                LOW: { color: "text-ink/60", dot: "bg-ink/30", label: "Planifié" },
              };
              const config = urgencyConfig[contract.urgency];

              return (
                <Link
                  key={contract.id}
                  href={`/dimensioning?contractId=${contract.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-ink/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{contract.title}</p>
                      <p className="text-xs text-ink/50">{contract.siteCount} site(s) • {contract.provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`font-mono text-xs tabular-nums font-medium ${config.color}`}>
                      {contract.daysUntilExpiry < 0
                        ? `Expiré depuis ${Math.abs(contract.daysUntilExpiry)}j`
                        : contract.daysUntilExpiry === 0
                        ? "Aujourd'hui"
                        : `${contract.daysUntilExpiry}j`}
                    </span>
                    <ChevronRight size={13} className="text-ink/30" />
                  </div>
                </Link>
              );
            })}
          </div>
          {expiringContracts.length > 4 && (
            <Link
              href="/renewals"
              className="mt-3 block text-center font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent transition-colors"
            >
              +{expiringContracts.length - 4} autre(s) contrat(s)
            </Link>
          )}
        </ChartCard>
      )}
    </>
  );
}
