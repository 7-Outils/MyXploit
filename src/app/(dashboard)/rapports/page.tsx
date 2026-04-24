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
  A_FAIRE: { label: "A faire", icon: Clock, color: "text-gray-600", bg: "bg-gray-100" },
  EN_COURS: { label: "En cours", icon: Pencil, color: "text-blue-600", bg: "bg-blue-100" },
  PRODUIT: { label: "Produit", icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
  TRANSMIS: { label: "Transmis", icon: Send, color: "text-purple-600", bg: "bg-purple-100" },
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <ClipboardList size={28} className="text-accent" />
          Rapports & Livrables
        </h1>
        <p className="text-gray-500 mt-1">Vue croisee de tous les livrables</p>
      </div>

      {/* Rapports d'expertise — sous-rapports analytiques */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-text-secondary font-semibold mb-2">
          Rapports d&apos;expertise
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            href={selectedContract ? `/rapports/calibration-cibles?contract=${selectedContract.id}` : "/rapports/calibration-cibles"}
            className="group bg-white border border-gray-200 hover:border-accent/50 rounded-lg px-4 py-3 flex items-start gap-3 transition-colors"
          >
            <div className="w-9 h-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Sliders size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-primary-dark flex items-center gap-1 group-hover:text-accent">
                Calibration des cibles NB
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                Diagnostic par signature énergétique — cibles trop lâches ou trop serrées
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total livrables</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{stats.aFaire + stats.enCours}</p>
            <p className="text-sm text-gray-500">A produire</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4">
            <p className={`text-2xl font-bold ${stats.enRetard > 0 ? "text-red-600" : "text-gray-900"}`}>
              {stats.enRetard}
            </p>
            <p className="text-sm text-gray-500">En retard</p>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-4">
            <p className="text-2xl font-bold text-green-600">{stats.produit}</p>
            <p className="text-sm text-gray-500">Produits</p>
          </div>
          <div className="bg-white rounded-xl border border-purple-200 p-4">
            <p className="text-2xl font-bold text-purple-600">{stats.transmis}</p>
            <p className="text-sm text-gray-500">Transmis</p>
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-gray-400" />
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setLoading(true); setStatusFilter(tab.key); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              } ${tab.key === "EN_RETARD" && tab.count > 0 ? "text-red-600" : ""}`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Deliverables table */}
      {deliverables.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Aucun livrable</h3>
          <p className="text-gray-500">Les livrables apparaitront ici quand vous en ajouterez a vos missions</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Livrable</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Mission</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Ingenieur</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Echeance</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody>
                {deliverables.map((d) => {
                  const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.A_FAIRE;
                  const isOverdue = d.dueDate && new Date(d.dueDate) < now && d.status !== "TRANSMIS" && d.status !== "PRODUIT";
                  const IconComponent = cfg.icon;

                  return (
                    <tr key={d.id} className={`border-b border-gray-100 ${isOverdue ? "bg-red-50/50" : "hover:bg-gray-50"}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <IconComponent size={14} className={cfg.color} />
                          <span className="text-sm font-medium text-gray-900">{d.title}</span>
                          {isOverdue && <AlertTriangle size={12} className="text-red-500" />}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/missions/${d.mission.id}`}
                          className="text-sm text-accent hover:underline"
                        >
                          {d.mission.title}
                        </Link>
                        <p className="text-xs text-gray-400">{d.mission.reference}</p>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {d.mission.client.name}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {d.mission.engineers.length > 0
                          ? d.mission.engineers.map((e) =>
                              `${e.user.firstName || ""} ${e.user.lastName || ""}`.trim()
                            ).join(", ")
                          : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-sm ${isOverdue ? "text-red-600 font-medium" : "text-gray-700"}`}>
                          {d.dueDate ? new Date(d.dueDate).toLocaleDateString("fr-FR") : "-"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <select
                          value={d.status}
                          onChange={(e) => handleStatusChange(d.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded border-0 font-medium cursor-pointer ${cfg.bg} ${cfg.color}`}
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
