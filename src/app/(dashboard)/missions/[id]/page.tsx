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
  PROSPECT: { label: "Pipeline", color: "bg-white text-ink/60 border border-ink/20" },
  ACTIVE: { label: "Active", color: "bg-green-50 text-green-700 border border-green-600/20" },
  EN_PAUSE: { label: "En pause", color: "bg-amber-50 text-amber-700 border border-amber-600/20" },
  TERMINEE: { label: "Terminee", color: "bg-white text-ink/50 border border-ink/15" },
  ANNULEE: { label: "Annulee", color: "bg-red-50 text-red-700 border border-red-600/20" },
};

const DELIVERABLE_STATUS: Record<string, { label: string; icon: React.ComponentType<{ size?: number | string; className?: string }>; color: string }> = {
  A_FAIRE: { label: "A faire", icon: Clock, color: "text-ink/60 bg-white border border-ink/20" },
  EN_COURS: { label: "En cours", icon: Pencil, color: "text-accent bg-accent/5 border border-accent/30" },
  PRODUIT: { label: "Produit", icon: CheckCircle, color: "text-green-700 bg-green-50 border border-green-600/20" },
  TRANSMIS: { label: "Transmis", icon: Send, color: "text-ink bg-ink/5 border border-ink/20" },
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
        <p className="text-ink/50">Mission introuvable</p>
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
      <div className="flex items-start justify-between border-b border-ink/10 pb-4">
        <div>
          <Link
            href="/missions"
            className="mb-3 inline-flex items-center gap-1 text-sm text-ink/50 hover:text-accent"
          >
            <ArrowLeft size={16} />
            Missions
          </Link>
          <div className="mb-1 flex items-center gap-3">
            <h1 className="text-xl font-semibold text-ink">{mission.title}</h1>
            <span className={`px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-sm text-ink/50">
            <span className="font-mono tabular-nums">{mission.reference}</span> • {mission.missionType.name} • {mission.client.name}
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Supprimer"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex w-fit items-center border border-ink/10 divide-x divide-ink/10">
        {[
          { key: "livrables" as const, label: `Livrables (${mission.deliverables.length})` },
          { key: "infos" as const, label: "Informations" },
          { key: "rattachements" as const, label: `Sites & Contrats (${mission.sites.length + mission.contracts.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-accent/5 text-accent"
                : "text-ink/60 hover:bg-ink/[0.02] hover:text-ink"
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
            <div className="flex items-center gap-2 border border-red-600/20 bg-red-50 p-3">
              <AlertTriangle size={16} className="flex-shrink-0 text-red-600" />
              <span className="text-sm text-red-700">
                <span className="font-mono tabular-nums">{overdueDeliverables.length}</span> livrable(s) en retard
              </span>
            </div>
          )}

          {/* Add button */}
          <div className="flex items-center justify-between">
            <h3 className="label-tech">Livrables</h3>
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
            <div className="panel space-y-3 p-4">
              <input
                type="text"
                value={deliverableForm.title}
                onChange={(e) => setDeliverableForm({ ...deliverableForm, title: e.target.value })}
                placeholder="Titre du livrable (ex: Rapport annuel)"
                className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={deliverableForm.description}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, description: e.target.value })}
                  placeholder="Description (optionnel)"
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
                <input
                  type="date"
                  value={deliverableForm.dueDate}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, dueDate: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm tabular-nums focus:border-accent focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddDeliverable}
                  disabled={addingDeliverable || !deliverableForm.title.trim()}
                  className="flex items-center gap-1 bg-ink px-3 py-1.5 text-sm text-paper transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {addingDeliverable && <Loader2 size={12} className="animate-spin" />}
                  Ajouter
                </button>
                <button
                  onClick={() => setShowAddDeliverable(false)}
                  className="border border-ink/20 px-3 py-1.5 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Deliverables list */}
          {mission.deliverables.length === 0 ? (
            <div className="panel py-12 text-center">
              <FileText size={28} className="mx-auto mb-3 text-ink/20" />
              <p className="text-sm text-ink/50">Aucun livrable defini</p>
              <button
                onClick={() => setShowAddDeliverable(true)}
                className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-2"
              >
                <Plus size={14} />
                Ajouter le premier livrable
              </button>
            </div>
          ) : (
            <div className="panel divide-y divide-ink/10">
              {mission.deliverables.map((d) => {
                const dStatus = DELIVERABLE_STATUS[d.status] || DELIVERABLE_STATUS.A_FAIRE;
                const isOverdue = d.dueDate && new Date(d.dueDate) < now && d.status !== "TRANSMIS" && d.status !== "PRODUIT";
                const IconComponent = dStatus.icon;

                return (
                  <div key={d.id} className={`flex items-center gap-4 px-4 py-2.5 ${isOverdue ? "bg-red-50/50" : ""}`}>
                    <IconComponent size={16} className="flex-shrink-0 text-ink/40" />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{d.title}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        {d.dueDate && (
                          <span className={`text-xs tabular-nums ${isOverdue ? "font-medium text-red-600" : "text-ink/50"}`}>
                            Echeance : {new Date(d.dueDate).toLocaleDateString("fr-FR")}
                            {isOverdue && " (en retard)"}
                          </span>
                        )}
                        {d.description && (
                          <span className="text-xs text-ink/40">• {d.description}</span>
                        )}
                      </div>
                    </div>

                    {/* Status dropdown */}
                    <select
                      value={d.status}
                      onChange={(e) => handleDeliverableStatusChange(d.id, e.target.value)}
                      className={`cursor-pointer px-2 py-1 text-xs font-medium focus:outline-none ${dStatus.color}`}
                    >
                      <option value="A_FAIRE">A faire</option>
                      <option value="EN_COURS">En cours</option>
                      <option value="PRODUIT">Produit</option>
                      <option value="TRANSMIS">Transmis</option>
                    </select>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteDeliverable(d.id)}
                      className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Supprimer"
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
        <div className="panel p-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="label-tech">Client</label>
                <p className="mt-1 text-sm text-ink">
                  <Link href={`/clients/${mission.client.id}`} className="text-accent hover:underline">
                    {mission.client.name}
                  </Link>
                  {mission.client.city && <span className="text-ink/50"> • {mission.client.city}</span>}
                </p>
              </div>
              <div>
                <label className="label-tech">Type de mission</label>
                <p className="mt-1 text-sm text-ink">{mission.missionType.name}</p>
              </div>
              <div>
                <label className="label-tech">Description</label>
                <p className="mt-1 text-sm text-ink">{mission.description || "-"}</p>
              </div>
              <div>
                <label className="label-tech">Statut</label>
                <p className="mt-1">
                  <span className={`px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech">Date debut</label>
                  <p className="mt-1 font-mono text-sm tabular-nums text-ink">
                    {mission.startDate ? new Date(mission.startDate).toLocaleDateString("fr-FR") : "-"}
                  </p>
                </div>
                <div>
                  <label className="label-tech">Date fin</label>
                  <p className="mt-1 font-mono text-sm tabular-nums text-ink">
                    {mission.endDate ? new Date(mission.endDate).toLocaleDateString("fr-FR") : "-"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech">Montant HT</label>
                  <p className="mt-1 font-mono text-sm tabular-nums text-ink">
                    {mission.amountHT ? `${mission.amountHT.toLocaleString("fr-FR")} €` : "-"}
                  </p>
                </div>
                <div>
                  <label className="label-tech">Facturation</label>
                  <p className="mt-1 text-sm text-ink">
                    {mission.billingModality ? BILLING_LABELS[mission.billingModality] || mission.billingModality : "-"}
                  </p>
                </div>
              </div>
              <div>
                <label className="label-tech">Ingenieur(s) affecte(s)</label>
                {mission.engineers.length === 0 ? (
                  <p className="text-sm text-ink/40 mt-1">Aucun ingenieur affecte</p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {mission.engineers.map((e) => (
                      <p key={e.id} className="text-sm text-ink">
                        {e.user.firstName || ""} {e.user.lastName || ""}{" "}
                        <span className="text-ink/50">({e.user.email})</span>
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
            <h3 className="label-tech mb-3 flex items-center gap-2">
              <MapPin size={14} />
              Sites rattaches ({mission.sites.length})
            </h3>
            {mission.sites.length === 0 ? (
              <div className="panel py-8 text-center">
                <p className="text-sm text-ink/40">Aucun site rattache</p>
              </div>
            ) : (
              <div className="panel divide-y divide-ink/10">
                {mission.sites.map((ms) => (
                  <Link
                    key={ms.id}
                    href={`/buildings/${ms.site.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink/[0.02]"
                  >
                    <MapPin size={16} className="text-ink/40 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-ink">{ms.site.name}</p>
                      <p className="text-xs text-ink/50">{ms.site.city} • {ms.site.type}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Contrats */}
          <div>
            <h3 className="label-tech mb-3 flex items-center gap-2">
              <Building2 size={14} />
              Contrats d&apos;exploitation ({mission.contracts.length})
            </h3>
            {mission.contracts.length === 0 ? (
              <div className="panel py-8 text-center">
                <p className="text-sm text-ink/40">Aucun contrat rattache</p>
              </div>
            ) : (
              <div className="panel divide-y divide-ink/10">
                {mission.contracts.map((mc) => (
                  <div key={mc.id} className="flex items-center gap-3 px-4 py-2.5">
                    <FileText size={16} className="text-ink/40 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-ink">{mc.contract.title}</p>
                      <p className="text-xs text-ink/50">{mc.contract.reference} • {mc.contract.provider}</p>
                    </div>
                    <span className={`ml-auto px-2 py-0.5 text-xs font-medium ${
                      mc.contract.status === "ACTIF" ? "border border-green-600/20 bg-green-50 text-green-700" : "border border-ink/15 bg-white text-ink/50"
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
