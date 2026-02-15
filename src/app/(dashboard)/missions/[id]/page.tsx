"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Send,
  Pencil,
  MapPin,
  Building2,
} from "lucide-react";

interface Deliverable {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  completedDate: string | null;
  transmittedDate: string | null;
  fileUrl: string | null;
}

interface Engineer {
  id: string;
  userId: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
}

interface MissionSite {
  id: string;
  site: { id: string; name: string; city: string; type: string };
}

interface MissionContract {
  id: string;
  contract: { id: string; reference: string; title: string; provider: string; status: string };
}

interface MissionDetail {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  amountHT: number | null;
  billingModality: string | null;
  client: { id: string; name: string; city: string | null };
  missionType: { id: string; name: string };
  deliverables: Deliverable[];
  engineers: Engineer[];
  sites: MissionSite[];
  contracts: MissionContract[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PROSPECT: { label: "Pipeline", color: "bg-purple-100 text-purple-700" },
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-700" },
  EN_PAUSE: { label: "En pause", color: "bg-yellow-100 text-yellow-700" },
  TERMINEE: { label: "Terminee", color: "bg-gray-100 text-gray-700" },
  ANNULEE: { label: "Annulee", color: "bg-red-100 text-red-700" },
};

const DELIVERABLE_STATUS: Record<string, { label: string; icon: React.ComponentType<{ size?: number | string; className?: string }>; color: string }> = {
  A_FAIRE: { label: "A faire", icon: Clock, color: "text-gray-500 bg-gray-100" },
  EN_COURS: { label: "En cours", icon: Pencil, color: "text-blue-600 bg-blue-100" },
  PRODUIT: { label: "Produit", icon: CheckCircle, color: "text-green-600 bg-green-100" },
  TRANSMIS: { label: "Transmis", icon: Send, color: "text-purple-600 bg-purple-100" },
};

const BILLING_LABELS: Record<string, string> = {
  FORFAIT: "Forfait",
  REGIE: "Regie",
  POURCENTAGE: "% travaux",
  MIXTE: "Mixte",
};

export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"infos" | "livrables" | "rattachements">("livrables");
  const [deleting, setDeleting] = useState(false);

  // Livrable creation
  const [showAddDeliverable, setShowAddDeliverable] = useState(false);
  const [deliverableForm, setDeliverableForm] = useState({ title: "", description: "", dueDate: "" });
  const [addingDeliverable, setAddingDeliverable] = useState(false);

  const fetchMission = useCallback(async () => {
    try {
      const res = await fetch(`/api/missions/${id}`);
      if (res.ok) {
        setMission(await res.json());
      }
    } catch (err) {
      console.error("Error fetching mission:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMission();
  }, [fetchMission]);

  const handleDelete = async () => {
    if (!confirm("Supprimer cette mission ? Cette action est irreversible.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/missions/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/missions");
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const handleAddDeliverable = async () => {
    if (!deliverableForm.title.trim()) return;
    setAddingDeliverable(true);
    try {
      const res = await fetch(`/api/missions/${id}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deliverableForm),
      });
      if (res.ok) {
        setDeliverableForm({ title: "", description: "", dueDate: "" });
        setShowAddDeliverable(false);
        fetchMission();
      }
    } catch {
      // ignore
    } finally {
      setAddingDeliverable(false);
    }
  };

  const handleDeliverableStatusChange = async (deliverableId: string, newStatus: string) => {
    try {
      await fetch(`/api/deliverables/${deliverableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchMission();
    } catch {
      // ignore
    }
  };

  const handleDeleteDeliverable = async (deliverableId: string) => {
    if (!confirm("Supprimer ce livrable ?")) return;
    try {
      await fetch(`/api/deliverables/${deliverableId}`, { method: "DELETE" });
      fetchMission();
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

  if (!mission) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Mission introuvable</p>
        <Link href="/missions" className="text-accent hover:underline mt-2 inline-block">
          Retour aux missions
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[mission.status] || STATUS_CONFIG.ACTIVE;
  const now = new Date();

  const overdueDeliverables = mission.deliverables.filter(
    (d) => d.dueDate && new Date(d.dueDate) < now && d.status !== "TRANSMIS" && d.status !== "PRODUIT"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/missions"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft size={16} />
            Missions
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{mission.title}</h1>
            <span className={`text-xs px-2 py-1 rounded font-medium ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-gray-500">
            {mission.reference} • {mission.missionType.name} • {mission.client.name}
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
          title="Supprimer"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: "livrables" as const, label: `Livrables (${mission.deliverables.length})` },
          { key: "infos" as const, label: "Informations" },
          { key: "rattachements" as const, label: `Sites & Contrats (${mission.sites.length + mission.contracts.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Livrables */}
      {activeTab === "livrables" && (
        <div className="space-y-4">
          {/* Overdue alert */}
          {overdueDeliverables.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700">
                {overdueDeliverables.length} livrable(s) en retard
              </span>
            </div>
          )}

          {/* Add button */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500 uppercase">Livrables</h3>
            <button
              onClick={() => setShowAddDeliverable(true)}
              className="flex items-center gap-1 text-sm text-accent hover:underline"
            >
              <Plus size={14} />
              Ajouter un livrable
            </button>
          </div>

          {/* Add form inline */}
          {showAddDeliverable && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              <input
                type="text"
                value={deliverableForm.title}
                onChange={(e) => setDeliverableForm({ ...deliverableForm, title: e.target.value })}
                placeholder="Titre du livrable (ex: Rapport annuel)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={deliverableForm.description}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, description: e.target.value })}
                  placeholder="Description (optionnel)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={deliverableForm.dueDate}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddDeliverable}
                  disabled={addingDeliverable || !deliverableForm.title.trim()}
                  className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1"
                >
                  {addingDeliverable && <Loader2 size={12} className="animate-spin" />}
                  Ajouter
                </button>
                <button
                  onClick={() => setShowAddDeliverable(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Deliverables list */}
          {mission.deliverables.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <FileText size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">Aucun livrable defini</p>
              <button
                onClick={() => setShowAddDeliverable(true)}
                className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-2"
              >
                <Plus size={14} />
                Ajouter le premier livrable
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y">
              {mission.deliverables.map((d) => {
                const dStatus = DELIVERABLE_STATUS[d.status] || DELIVERABLE_STATUS.A_FAIRE;
                const isOverdue = d.dueDate && new Date(d.dueDate) < now && d.status !== "TRANSMIS" && d.status !== "PRODUIT";
                const IconComponent = dStatus.icon;

                return (
                  <div key={d.id} className={`p-4 flex items-center gap-4 ${isOverdue ? "bg-red-50/50" : ""}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${dStatus.color}`}>
                      <IconComponent size={16} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{d.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {d.dueDate && (
                          <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                            Echeance : {new Date(d.dueDate).toLocaleDateString("fr-FR")}
                            {isOverdue && " (en retard)"}
                          </span>
                        )}
                        {d.description && (
                          <span className="text-xs text-gray-400">• {d.description}</span>
                        )}
                      </div>
                    </div>

                    {/* Status dropdown */}
                    <select
                      value={d.status}
                      onChange={(e) => handleDeliverableStatusChange(d.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded border-0 font-medium cursor-pointer ${dStatus.color}`}
                    >
                      <option value="A_FAIRE">A faire</option>
                      <option value="EN_COURS">En cours</option>
                      <option value="PRODUIT">Produit</option>
                      <option value="TRANSMIS">Transmis</option>
                    </select>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteDeliverable(d.id)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Informations */}
      {activeTab === "infos" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Client</label>
                <p className="text-sm text-gray-900 mt-1">
                  <Link href={`/clients/${mission.client.id}`} className="text-accent hover:underline">
                    {mission.client.name}
                  </Link>
                  {mission.client.city && <span className="text-gray-500"> • {mission.client.city}</span>}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Type de mission</label>
                <p className="text-sm text-gray-900 mt-1">{mission.missionType.name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Description</label>
                <p className="text-sm text-gray-900 mt-1">{mission.description || "-"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Statut</label>
                <p className="mt-1">
                  <span className={`text-xs px-2 py-1 rounded font-medium ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Date debut</label>
                  <p className="text-sm text-gray-900 mt-1">
                    {mission.startDate ? new Date(mission.startDate).toLocaleDateString("fr-FR") : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Date fin</label>
                  <p className="text-sm text-gray-900 mt-1">
                    {mission.endDate ? new Date(mission.endDate).toLocaleDateString("fr-FR") : "-"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Montant HT</label>
                  <p className="text-sm text-gray-900 mt-1">
                    {mission.amountHT ? `${mission.amountHT.toLocaleString("fr-FR")} €` : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Facturation</label>
                  <p className="text-sm text-gray-900 mt-1">
                    {mission.billingModality ? BILLING_LABELS[mission.billingModality] || mission.billingModality : "-"}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Ingenieur(s) affecte(s)</label>
                {mission.engineers.length === 0 ? (
                  <p className="text-sm text-gray-400 mt-1">Aucun ingenieur affecte</p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {mission.engineers.map((e) => (
                      <p key={e.id} className="text-sm text-gray-900">
                        {e.user.firstName || ""} {e.user.lastName || ""}{" "}
                        <span className="text-gray-500">({e.user.email})</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Sites & Contrats */}
      {activeTab === "rattachements" && (
        <div className="space-y-6">
          {/* Sites */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase mb-3 flex items-center gap-2">
              <MapPin size={14} />
              Sites rattaches ({mission.sites.length})
            </h3>
            {mission.sites.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
                <p className="text-sm text-gray-400">Aucun site rattache</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y">
                {mission.sites.map((ms) => (
                  <Link
                    key={ms.id}
                    href={`/buildings/${ms.site.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50"
                  >
                    <MapPin size={16} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ms.site.name}</p>
                      <p className="text-xs text-gray-500">{ms.site.city} • {ms.site.type}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Contrats */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase mb-3 flex items-center gap-2">
              <Building2 size={14} />
              Contrats d&apos;exploitation ({mission.contracts.length})
            </h3>
            {mission.contracts.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
                <p className="text-sm text-gray-400">Aucun contrat rattache</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y">
                {mission.contracts.map((mc) => (
                  <div key={mc.id} className="flex items-center gap-3 p-3">
                    <FileText size={16} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{mc.contract.title}</p>
                      <p className="text-xs text-gray-500">{mc.contract.reference} • {mc.contract.provider}</p>
                    </div>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                      mc.contract.status === "ACTIF" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {mc.contract.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
