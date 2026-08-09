"use client";

import Link from "next/link";
import {
  AlertTriangle,
  TrendingDown,
  CheckCircle,
  Bell,
  ChevronRight,
  Users,
  FolderKanban,
  Clock,
} from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import type { MissionStats, ExpiringContract, Alert } from "../types";

interface AdminDashboardProps {
  missionStats: MissionStats;
  expiringContracts: ExpiringContract[];
  activeAlerts: Alert[];
}

export function AdminDashboard({
  missionStats,
  expiringContracts,
  activeAlerts,
}: AdminDashboardProps) {
  return (
    <>
      {/* Overdue Deliverables + Pipeline side by side */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Overdue deliverables */}
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <Clock size={14} className="text-red-600" />
              Livrables en retard
            </span>
          }
          subtitle={`${missionStats.overdueDeliverables.length} livrable(s) en retard`}
          action={
            <Link href="/rapports?status=EN_RETARD" className="font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent flex items-center gap-1 transition-colors">
              Voir tous <ChevronRight size={13} />
            </Link>
          }
        >
          {missionStats.overdueDeliverables.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={24} className="mx-auto text-green-600 mb-2" />
              <p className="text-sm text-ink/50">Aucun livrable en retard</p>
            </div>
          ) : (
            <div className="-mx-4 -my-4 divide-y divide-ink/10">
              {missionStats.overdueDeliverables.slice(0, 5).map((d) => (
                <Link
                  key={d.id}
                  href={`/missions/${d.mission.id}`}
                  className="flex items-center justify-between gap-3 border-l-2 border-l-red-600 px-4 py-2.5 hover:bg-ink/[0.02] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{d.title}</p>
                    <p className="text-xs text-ink/50">{d.mission.reference} • {d.mission.client.name}</p>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-red-700 font-medium flex-shrink-0">
                    {new Date(d.dueDate).toLocaleDateString("fr-FR")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </ChartCard>

        {/* Pipeline */}
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <TrendingDown size={14} className="text-ink/40" style={{ transform: "scaleY(-1)" }} />
              Pipeline
            </span>
          }
          subtitle={`${missionStats.pipeline.missions.length} mission(s) • ${(missionStats.pipeline.totalAmount / 1000).toFixed(0)}k€ potentiel`}
          action={
            <Link href="/missions?status=PROSPECT" className="font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent flex items-center gap-1 transition-colors">
              Voir tout <ChevronRight size={13} />
            </Link>
          }
        >
          {missionStats.pipeline.missions.length === 0 ? (
            <div className="text-center py-8">
              <FolderKanban size={24} className="mx-auto text-ink/25 mb-2" />
              <p className="text-sm text-ink/50">Aucune mission en negociation</p>
            </div>
          ) : (
            <div className="-mx-4 -my-4 divide-y divide-ink/10">
              {missionStats.pipeline.missions.slice(0, 5).map((m) => (
                <Link
                  key={m.id}
                  href={`/missions/${m.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-ink/[0.02] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{m.title}</p>
                    <p className="text-xs text-ink/50">{m.missionType.name} • {m.client.name}</p>
                  </div>
                  {m.amountHT && (
                    <span className="font-mono text-sm tabular-nums text-ink font-medium flex-shrink-0">
                      {m.amountHT.toLocaleString("fr-FR")} €
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Engineer Workload (mission-based) */}
      {missionStats.engineerWorkload.length > 0 && (
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <Users size={14} className="text-ink/40" />
              Charge equipe
            </span>
          }
          subtitle={`${missionStats.engineerWorkload.length} ingenieur(s)`}
          action={
            <Link href="/team" className="font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent flex items-center gap-1 transition-colors">
              Gerer <ChevronRight size={13} />
            </Link>
          }
        >
          <div className="overflow-x-auto -mx-4 -my-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink/10">
                  <th className="label-tech text-left py-2 px-4">Ingenieur</th>
                  <th className="label-tech text-center py-2 px-4">Missions actives</th>
                  <th className="label-tech text-center py-2 px-4">Livrables a produire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {missionStats.engineerWorkload.map((eng) => (
                  <tr key={eng.id} className="hover:bg-ink/[0.02]">
                    <td className="py-2 px-4">
                      <p className="text-sm font-medium text-ink">
                        {eng.firstName || ""} {eng.lastName || ""}
                      </p>
                      <p className="text-xs text-ink/50">{eng.email}</p>
                    </td>
                    <td className="py-2 px-4 text-center">
                      <span className={`font-mono text-sm tabular-nums font-medium ${
                        eng.activeMissions > 0 ? "text-ink" : "text-ink/30"
                      }`}>
                        {eng.activeMissions}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-center">
                      <span className={`font-mono text-sm tabular-nums font-medium ${
                        eng.pendingDeliverables > 0 ? "text-amber-700" : "text-ink/30"
                      }`}>
                        {eng.pendingDeliverables}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* Expiring Missions */}
      {missionStats.expiringMissions.length > 0 && (
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <Bell size={14} className="text-amber-600" />
              Missions a renouveler
            </span>
          }
          subtitle={`${missionStats.expiringMissions.length} mission(s) arrivent a echeance dans les 6 prochains mois`}
          action={
            <Link href="/missions" className="font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent flex items-center gap-1 transition-colors">
              Voir tout <ChevronRight size={13} />
            </Link>
          }
        >
          <div className="-mx-4 -my-4 divide-y divide-ink/10">
            {missionStats.expiringMissions.slice(0, 5).map((m) => {
              const daysUntil = Math.ceil((new Date(m.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <Link
                  key={m.id}
                  href={`/missions/${m.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-ink/[0.02] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{m.title}</p>
                    <p className="text-xs text-ink/50">{m.missionType.name} • {m.client.name}</p>
                  </div>
                  <span className={`font-mono text-xs tabular-nums font-medium flex-shrink-0 ${
                    daysUntil <= 30 ? "text-red-700" :
                    daysUntil <= 90 ? "text-amber-700" :
                    "text-ink/60"
                  }`}>
                    {daysUntil}j
                  </span>
                </Link>
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* Expiring Contracts - ADMIN */}
      {expiringContracts.length > 0 && (
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <Bell size={14} className="text-amber-600" />
              Contrats à échéance
            </span>
          }
          subtitle={`${expiringContracts.length} contrat(s) arrivent à échéance dans les 6 prochains mois`}
          action={
            <Link href="/contrat" className="font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent flex items-center gap-1 transition-colors">
              Voir tous les contrats <ChevronRight size={13} />
            </Link>
          }
        >
          <div className="-mx-4 -mt-4 divide-y divide-ink/10">
            {expiringContracts.slice(0, 5).map((contract) => {
              const urgencyConfig = {
                EXPIRED: { color: "text-ink/50", dot: "bg-ink/40", label: "Expiré" },
                CRITICAL: { color: "text-red-700", dot: "bg-red-600", label: "Critique" },
                HIGH: { color: "text-amber-700", dot: "bg-amber-600", label: "Urgent" },
                MEDIUM: { color: "text-amber-700", dot: "bg-amber-500", label: "Moyen" },
                LOW: { color: "text-ink/60", dot: "bg-ink/30", label: "Planifié" },
              };
              const config = urgencyConfig[contract.urgency];

              return (
                <div
                  key={contract.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{contract.title}</p>
                      <p className="text-xs text-ink/50">{contract.reference} • {contract.provider} • {contract.siteCount} site(s)</p>
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
                  </div>
                </div>
              );
            })}
          </div>
          {expiringContracts.length > 5 && (
            <Link
              href="/contrat"
              className="mt-3 block text-center font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent transition-colors"
            >
              +{expiringContracts.length - 5} autre(s) contrat(s)
            </Link>
          )}
        </ChartCard>
      )}

      {/* Recent Alerts - ADMIN */}
      {activeAlerts.length > 0 && (
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-600" />
              Alertes récentes
            </span>
          }
          subtitle={`${activeAlerts.length} alerte(s) non lue(s)`}
        >
          <div className="-mx-4 -my-4 divide-y divide-ink/10">
            {activeAlerts.slice(0, 5).map((alert) => {
              const priorityConfig = {
                CRITIQUE: { color: "text-red-700 border-red-600/25 bg-red-50", dot: "bg-red-600" },
                HAUTE: { color: "text-amber-700 border-amber-600/25 bg-amber-50", dot: "bg-amber-600" },
                MOYENNE: { color: "text-amber-700 border-amber-500/25 bg-amber-50/60", dot: "bg-amber-500" },
                BASSE: { color: "text-ink/60 border-ink/15 bg-ink/[0.03]", dot: "bg-ink/30" },
              };
              const config = priorityConfig[alert.priority];

              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{alert.title}</p>
                      <p className="text-xs text-ink/50 truncate">
                        {alert.site?.name ? `${alert.site.name} — ` : ""}{alert.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 border ${config.color}`}>
                      {alert.priority}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-ink/40">
                      {new Date(alert.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}
    </>
  );
}
