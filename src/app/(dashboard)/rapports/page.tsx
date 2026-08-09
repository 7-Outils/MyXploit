"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Send,
  Pencil,
  Filter,
  Sliders,
  ChevronRight,
} from "lucide-react";
import { useContract } from "@/contexts/ContractContext";

interface DeliverableItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  completedDate: string | null;
  transmittedDate: string | null;
  mission: {
    id: string;
    reference: string;
    title: string;
    client: { id: string; name: string };
    engineers: Array<{
      user: { id: string; firstName: string | null; lastName: string | null };
    }>;
  };
}

interface Stats {
  total: number;
  aFaire: number;
  enCours: number;
  produit: number;
  transmis: number;
  enRetard: number;
  produitCeMois: number;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ size?: number | string; className?: string }>; color: string; bg: string }> = {
  A_FAIRE: { label: "A faire", icon: Clock, color: "text-ink/50", bg: "bg-white border border-ink/15" },
  EN_COURS: { label: "En cours", icon: Pencil, color: "text-accent", bg: "bg-white border border-accent/30" },
  PRODUIT: { label: "Produit", icon: CheckCircle, color: "text-green-700", bg: "bg-green-50 border border-green-600/20" },
  TRANSMIS: { label: "Transmis", icon: Send, color: "text-ink", bg: "bg-white border border-ink/20" },
};

export default function RapportsPage() {
  const { selectedContract } = useContract();
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = statusFilter !== "all" ? `/api/deliverables?status=${statusFilter}` : "/api/deliverables";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setDeliverables(data.deliverables);
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Error fetching deliverables:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [statusFilter]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        // Refetch
        const url = statusFilter !== "all" ? `/api/deliverables?status=${statusFilter}` : "/api/deliverables";
        const refetchRes = await fetch(url);
        if (refetchRes.ok) {
          const data = await refetchRes.json();
          setDeliverables(data.deliverables);
          setStats(data.stats);
        }
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const now = new Date();

  const statusTabs = [
    { key: "all", label: "Tous", count: stats?.total || 0 },
    { key: "A_FAIRE", label: "A faire", count: stats?.aFaire || 0 },
    { key: "EN_COURS", label: "En cours", count: stats?.enCours || 0 },
    { key: "EN_RETARD", label: "En retard", count: stats?.enRetard || 0 },
    { key: "PRODUIT", label: "Produits", count: stats?.produit || 0 },
    { key: "TRANSMIS", label: "Transmis", count: stats?.transmis || 0 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-ink/10 pb-2">
        <ClipboardList size={16} className="text-ink/40" />
        <h1 className="text-xl font-semibold text-ink">Rapports &amp; Livrables</h1>
        <span className="label-tech">Vue croisee de tous les livrables</span>
      </div>

      {/* Rapports d'expertise — sous-rapports analytiques */}
      <div>
        <div className="label-tech mb-2">Rapports d&apos;expertise</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            href={selectedContract ? `/rapports/calibration-cibles?contract=${selectedContract.id}` : "/rapports/calibration-cibles"}
            className="group panel hover:border-accent/40 px-4 py-3 flex items-start gap-3 transition-colors"
          >
            <Sliders size={16} className="text-ink/40 shrink-0 mt-0.5 group-hover:text-accent transition-colors" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink flex items-center gap-1 group-hover:text-accent">
                Calibration des cibles NB
                <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-ink/50 mt-0.5 line-clamp-2">
                Diagnostic par signature énergétique — cibles trop lâches ou trop serrées
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Bandeau de faits : KPIs hairline, sans boîte colorée */}
      {stats && (
        <div className="border-y border-ink/15">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-ink/15">
            {[
              { label: "Total livrables", value: stats.total, tone: "text-ink" },
              { label: "A produire", value: stats.aFaire + stats.enCours, tone: "text-ink" },
              { label: "En retard", value: stats.enRetard, tone: stats.enRetard > 0 ? "text-red-700" : "text-ink" },
              { label: "Produits", value: stats.produit, tone: "text-green-700" },
              { label: "Transmis", value: stats.transmis, tone: "text-ink" },
            ].map((kpi) => (
              <div key={kpi.label} className="py-3 sm:px-5 first:sm:pl-0">
                <p className="label-tech mb-1">{kpi.label}</p>
                <p className={`font-mono text-xl font-semibold tabular-nums ${kpi.tone}`}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-ink/40" />
        <div className="flex items-center gap-0 border border-ink/15 divide-x divide-ink/15">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setLoading(true); setStatusFilter(tab.key); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-accent/5 text-accent"
                  : "text-ink/60 hover:text-ink hover:bg-ink/[0.02]"
              } ${tab.key === "EN_RETARD" && tab.count > 0 && statusFilter !== tab.key ? "text-red-700" : ""}`}
            >
              {tab.label} <span className="font-mono tabular-nums">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Deliverables table */}
      {deliverables.length === 0 ? (
        <div className="panel py-12 text-center">
          <ClipboardList size={28} className="mx-auto text-ink/25 mb-3" />
          <h3 className="text-sm font-semibold text-ink mb-1">Aucun livrable</h3>
          <p className="text-sm text-ink/50">Les livrables apparaitront ici quand vous en ajouterez a vos missions</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink/10">
                  <th className="label-tech text-left py-2 px-4">Livrable</th>
                  <th className="label-tech text-left py-2 px-4">Mission</th>
                  <th className="label-tech text-left py-2 px-4">Client</th>
                  <th className="label-tech text-left py-2 px-4">Ingenieur</th>
                  <th className="label-tech text-left py-2 px-4">Echeance</th>
                  <th className="label-tech text-center py-2 px-4">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {deliverables.map((d) => {
                  const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.A_FAIRE;
                  const isOverdue = d.dueDate && new Date(d.dueDate) < now && d.status !== "TRANSMIS" && d.status !== "PRODUIT";
                  const IconComponent = cfg.icon;

                  return (
                    <tr key={d.id} className={isOverdue ? "bg-red-50/60" : "hover:bg-ink/[0.02]"}>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <IconComponent size={13} className={cfg.color} />
                          <span className="text-sm font-medium text-ink">{d.title}</span>
                          {isOverdue && <AlertTriangle size={12} className="text-red-600" />}
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <Link
                          href={`/missions/${d.mission.id}`}
                          className="text-sm text-accent hover:underline"
                        >
                          {d.mission.title}
                        </Link>
                        <p className="font-mono text-[11px] text-ink/40">{d.mission.reference}</p>
                      </td>
                      <td className="py-2 px-4 text-sm text-ink/70">
                        {d.mission.client.name}
                      </td>
                      <td className="py-2 px-4 text-sm text-ink/70">
                        {d.mission.engineers.length > 0
                          ? d.mission.engineers.map((e) =>
                              `${e.user.firstName || ""} ${e.user.lastName || ""}`.trim()
                            ).join(", ")
                          : "-"}
                      </td>
                      <td className="py-2 px-4">
                        <span className={`font-mono text-xs tabular-nums ${isOverdue ? "text-red-700 font-medium" : "text-ink/70"}`}>
                          {d.dueDate ? new Date(d.dueDate).toLocaleDateString("fr-FR") : "-"}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-center">
                        <select
                          value={d.status}
                          onChange={(e) => handleStatusChange(d.id, e.target.value)}
                          className={`text-xs px-2 py-1 font-medium cursor-pointer focus:border-accent focus:outline-none ${cfg.bg} ${cfg.color}`}
                        >
                          <option value="A_FAIRE">A faire</option>
                          <option value="EN_COURS">En cours</option>
                          <option value="PRODUIT">Produit</option>
                          <option value="TRANSMIS">Transmis</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
