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
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Overdue deliverables */}
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <Clock size={18} className="text-red-500" />
              Livrables en retard
            </span>
          }
          subtitle={`${missionStats.overdueDeliverables.length} livrable(s) en retard`}
          action={
            <Link href="/rapports?status=EN_RETARD" className="text-sm text-accent hover:underline flex items-center gap-1">
              Voir tous <ChevronRight size={14} />
            </Link>
          }
        >
          {missionStats.overdueDeliverables.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
              <p className="text-sm text-gray-500">Aucun livrable en retard</p>
            </div>
          ) : (
            <div className="space-y-3">
              {missionStats.overdueDeliverables.slice(0, 5).map((d) => (
                <Link
                  key={d.id}
                  href={`/missions/${d.mission.id}`}
                  className="flex items-center justify-between p-3 bg-red-50/50 rounded-lg hover:bg-red-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.title}</p>
                    <p className="text-xs text-gray-500">{d.mission.reference} • {d.mission.client.name}</p>
                  </div>
                  <span className="text-xs text-red-600 font-medium flex-shrink-0">
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
              <TrendingDown size={18} className="text-purple-500" style={{ transform: "scaleY(-1)" }} />
              Pipeline
            </span>
          }
          subtitle={`${missionStats.pipeline.missions.length} mission(s) • ${(missionStats.pipeline.totalAmount / 1000).toFixed(0)}k€ potentiel`}
          action={
            <Link href="/missions?status=PROSPECT" className="text-sm text-accent hover:underline flex items-center gap-1">
              Voir tout <ChevronRight size={14} />
            </Link>
          }
        >
          {missionStats.pipeline.missions.length === 0 ? (
            <div className="text-center py-8">
              <FolderKanban size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Aucune mission en negociation</p>
            </div>
          ) : (
            <div className="space-y-3">
              {missionStats.pipeline.missions.slice(0, 5).map((m) => (
                <Link
                  key={m.id}
                  href={`/missions/${m.id}`}
                  className="flex items-center justify-between p-3 bg-purple-50/50 rounded-lg hover:bg-purple-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                    <p className="text-xs text-gray-500">{m.missionType.name} • {m.client.name}</p>
                  </div>
                  {m.amountHT && (
                    <span className="text-sm text-purple-700 font-medium flex-shrink-0">
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
              <Users size={18} className="text-purple-600" />
              Charge equipe
            </span>
          }
          subtitle={`${missionStats.engineerWorkload.length} ingenieur(s)`}
          action={
            <Link href="/team" className="text-sm text-accent hover:underline flex items-center gap-1">
              Gerer <ChevronRight size={14} />
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Ingenieur</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-500">Missions actives</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-500">Livrables a produire</th>
                </tr>
              </thead>
              <tbody>
                {missionStats.engineerWorkload.map((eng) => (
                  <tr key={eng.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <p className="text-sm font-medium text-gray-900">
                        {eng.firstName || ""} {eng.lastName || ""}
                      </p>
                      <p className="text-xs text-gray-500">{eng.email}</p>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        eng.activeMissions > 0 ? "bg-accent/10 text-accent" : "bg-gray-100 text-gray-500"
                      }`}>
                        {eng.activeMissions}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        eng.pendingDeliverables > 0 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
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
              <Bell size={18} className="text-orange-500" />
              Missions a renouveler
            </span>
          }
          subtitle={`${missionStats.expiringMissions.length} mission(s) arrivent a echeance dans les 6 prochains mois`}
          action={
            <Link href="/missions" className="text-sm text-accent hover:underline flex items-center gap-1">
              Voir tout <ChevronRight size={14} />
            </Link>
          }
        >
          <div className="space-y-3">
            {missionStats.expiringMissions.slice(0, 5).map((m) => {
              const daysUntil = Math.ceil((new Date(m.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <Link
                  key={m.id}
                  href={`/missions/${m.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                    <p className="text-xs text-gray-500">{m.missionType.name} • {m.client.name}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-medium flex-shrink-0 ${
                    daysUntil <= 30 ? "bg-red-100 text-red-700" :
                    daysUntil <= 90 ? "bg-orange-100 text-orange-700" :
                    "bg-yellow-100 text-yellow-700"
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
              <Bell size={18} className="text-orange-500" />
              Contrats à échéance
            </span>
          }
          subtitle={`${expiringContracts.length} contrat(s) arrivent à échéance dans les 6 prochains mois`}
          action={
            <Link href="/administratif" className="text-sm text-accent hover:underline flex items-center gap-1">
              Voir tous les contrats <ChevronRight size={14} />
            </Link>
          }
        >
          <div className="space-y-3">
            {expiringContracts.slice(0, 5).map((contract) => {
              const urgencyConfig = {
                EXPIRED: { color: "bg-gray-100 text-gray-700", dot: "bg-gray-500", label: "Expiré" },
                CRITICAL: { color: "bg-red-100 text-red-700", dot: "bg-red-500", label: "Critique" },
                HIGH: { color: "bg-orange-100 text-orange-700", dot: "bg-orange-500", label: "Urgent" },
                MEDIUM: { color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500", label: "Moyen" },
                LOW: { color: "bg-blue-100 text-blue-700", dot: "bg-blue-500", label: "Planifié" },
              };
              const config = urgencyConfig[contract.urgency];

              return (
                <div
                  key={contract.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary-dark truncate">{contract.title}</p>
                      <p className="text-xs text-gray-500">{contract.reference} • {contract.provider} • {contract.siteCount} site(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${config.color}`}>
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
              href="/administratif"
              className="mt-4 block text-center text-sm text-accent hover:underline"
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
              <AlertTriangle size={18} className="text-red-500" />
              Alertes récentes
            </span>
          }
          subtitle={`${activeAlerts.length} alerte(s) non lue(s)`}
        >
          <div className="space-y-3">
            {activeAlerts.slice(0, 5).map((alert) => {
              const priorityConfig = {
                CRITIQUE: { color: "bg-red-100 text-red-700", dot: "bg-red-500" },
                HAUTE: { color: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
                MOYENNE: { color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500" },
                BASSE: { color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
              };
              const config = priorityConfig[alert.priority];

              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary-dark truncate">{alert.title}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {alert.site?.name ? `${alert.site.name} — ` : ""}{alert.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${config.color}`}>
                      {alert.priority}
                    </span>
                    <span className="text-xs text-gray-400">
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
