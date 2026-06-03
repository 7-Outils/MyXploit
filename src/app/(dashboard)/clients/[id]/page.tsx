"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  X,
  Check,
  Phone,
  Mail,
  Plus,
  Link2,
  Unlink,
  FileSpreadsheet,
} from "lucide-react";
import EditContractModal from "@/components/administratif/modals/EditContractModal";
import AEImportModal from "@/components/administratif/modals/AEImportModal";
import CreateContractModal from "@/components/administratif/modals/CreateContractModal";
import type { Contract as FullContract } from "@/components/administratif/types";

interface Site {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
  energyType: string;
  surface: number | null;
  _count: { equipments: number; alerts: number };
}

interface Contract {
  id: string;
  reference: string;
  title: string;
  provider: string;
  startDate: string;
  endDate: string;
  status: string;
  _count: { contractSites: number };
}

interface ClientDetail {
  id: string;
  name: string;
  siret: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  sites: Site[];
  contracts: Contract[];
  _count: { sites: number; contracts: number };
}

const STATUS_LABELS: Record<string, string> = {
  ACTIF: "Actif",
  EXPIRE: "Expire",
  EN_ATTENTE: "En attente",
  RESILIE: "Resilie",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIF: "bg-green-100 text-green-700",
  EXPIRE: "bg-red-100 text-red-700",
  EN_ATTENTE: "bg-yellow-100 text-yellow-700",
  RESILIE: "bg-gray-100 text-gray-700",
};

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"contracts" | "sites">("contracts");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ name: "", siret: "", contactName: "", contactEmail: "", contactPhone: "", city: "" });

  // Rattachement de contrats orphelins
  const [showAttach, setShowAttach] = useState(false);
  const [orphanContracts, setOrphanContracts] = useState<Contract[]>([]);
  const [loadingOrphans, setLoadingOrphans] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState(false);

  // Actions par contrat (Modifier / Importer AE sur un contrat existant)
  const [editingContract, setEditingContract] = useState<FullContract | null>(null);
  const [aeContractId, setAeContractId] = useState<string | null>(null);
  // Création d'un nouveau contrat rattaché à ce client
  const [showCreateContract, setShowCreateContract] = useState(false);
  const [showCreateAE, setShowCreateAE] = useState(false);

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data);
        setEditData({
          name: data.name,
          siret: data.siret || "",
          contactName: data.contactName || "",
          contactEmail: data.contactEmail || "",
          contactPhone: data.contactPhone || "",
          city: data.city || "",
        });
      } else {
        router.push("/clients");
      }
    } catch {
      router.push("/clients");
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  const openAttach = async () => {
    setShowAttach(true);
    setSelectedIds(new Set());
    setLoadingOrphans(true);
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) {
        const all: (Contract & { client: { id: string } | null })[] = await res.json();
        setOrphanContracts(all.filter((c) => !c.client));
      }
    } catch {
      // silencieux : la modal affichera "aucun contrat"
    } finally {
      setLoadingOrphans(false);
    }
  };

  const handleAttach = async () => {
    if (selectedIds.size === 0) return;
    setAttaching(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/contracts/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId }),
          })
        )
      );
      await fetchClient();
      setShowAttach(false);
    } catch {
      alert("Erreur lors du rattachement");
    } finally {
      setAttaching(false);
    }
  };

  const handleDetach = async (contractId: string, reference: string) => {
    if (!confirm(`Détacher le contrat "${reference}" de ce client ? Ses sites seront aussi détachés.`)) return;
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: null }),
      });
      if (res.ok) await fetchClient();
      else alert("Erreur lors du détachement");
    } catch {
      alert("Erreur lors du détachement");
    }
  };

  const openEdit = async (contractId: string) => {
    try {
      const res = await fetch(`/api/contracts/${contractId}`);
      if (res.ok) setEditingContract((await res.json()) as FullContract);
      else alert("Impossible de charger le contrat");
    } catch {
      alert("Impossible de charger le contrat");
    }
  };

  const handleDeleteContract = async (contractId: string, reference: string) => {
    const ok = confirm(
      `Supprimer définitivement le contrat « ${reference} » ?\n\n` +
        "Les sites partagés avec d'autres contrats sont conservés. " +
        "Seuls les sites propres à ce contrat (et leurs données) seront supprimés.\n\nCette action est irréversible."
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/contracts/${contractId}`, { method: "DELETE" });
      if (res.ok) await fetchClient();
      else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Échec de la suppression du contrat");
      }
    } catch {
      alert("Erreur réseau lors de la suppression");
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        const updated = await res.json();
        setClient((prev) => prev ? { ...prev, ...updated } : prev);
        setEditing(false);
      }
    } catch {
      alert("Erreur lors de la modification");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer le client "${client?.name}" ? Les sites et contrats seront detaches mais pas supprimes.`)) return;
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
      if (res.ok) router.push("/clients");
      else alert("Erreur lors de la suppression");
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  if (loading || !client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header compact : identité + métriques inline + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Link href="/clients" className="p-2 -ml-2 hover:bg-gray-100 rounded-lg text-gray-500 mt-0.5">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="text-xl font-bold px-2 py-1 border border-gray-200 rounded-lg"
                  autoFocus
                />
                <button onClick={handleSave} className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                  <Check size={18} />
                </button>
                <button onClick={() => setEditing(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-gray-900 truncate">{client.name}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
                  {client.city && <span className="flex items-center gap-1"><MapPin size={13} /> {client.city}</span>}
                  {client.siret && <span className="text-gray-400">SIRET {client.siret}</span>}
                  {client.contactName && <span className="text-gray-600 font-medium">{client.contactName}</span>}
                  {client.contactEmail && <a href={`mailto:${client.contactEmail}`} className="flex items-center gap-1 hover:text-accent"><Mail size={13} /> {client.contactEmail}</a>}
                  {client.contactPhone && <span className="flex items-center gap-1"><Phone size={13} /> {client.contactPhone}</span>}
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="flex items-center gap-1.5 text-gray-700"><FileText size={14} className="text-gray-400" /><strong className="font-semibold">{client._count.contracts}</strong> contrat{client._count.contracts > 1 ? "s" : ""}</span>
                  <span className="flex items-center gap-1.5 text-gray-700"><MapPin size={14} className="text-gray-400" /><strong className="font-semibold">{client._count.sites}</strong> site{client._count.sites > 1 ? "s" : ""}</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => setEditing(true)} title="Modifier le client" className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <Pencil size={16} />
          </button>
          <button onClick={handleDelete} title="Supprimer le client" className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Tabs + actions */}
      <div className="border-b border-gray-200 flex items-end justify-between gap-2">
        <div className="flex gap-1 -mb-px">
          {([
            { id: "contracts" as const, label: "Contrats", count: client.contracts.length },
            { id: "sites" as const, label: "Sites", count: client.sites.length },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 pb-2">
          <button
            onClick={() => setShowCreateContract(true)}
            title="Nouveau contrat"
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setShowCreateAE(true)}
            title="Créer un contrat depuis un fichier AE"
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet size={16} />
          </button>
          <button
            onClick={openAttach}
            title="Rattacher un contrat existant"
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Link2 size={16} />
          </button>
        </div>
      </div>

      {/* Sites */}
      {activeTab === "sites" && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {client.sites.length === 0 ? (
            <div className="p-10 text-center">
              <MapPin size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">Aucun site rattaché à ce client.</p>
              <p className="text-gray-400 text-xs mt-1">Les sites sont rattachés automatiquement via les contrats du client.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Site</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Ville</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Energie</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Surface</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {client.sites.map((site) => (
                  <tr key={site.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/buildings/${site.id}`)}>
                    <td className="px-5 py-4 font-medium text-gray-900">{site.name}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{site.city}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{site.type}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{site.energyType}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{site.surface ? `${site.surface} m²` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Contrats */}
      {activeTab === "contracts" && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {client.contracts.length === 0 ? (
              <div className="p-10 text-center">
                <FileText size={36} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-700 font-medium mb-1">Aucun contrat rattaché</p>
                <p className="text-gray-400 text-sm">Utilise les actions en haut à droite : nouveau contrat, importer un AE, ou rattacher un contrat existant.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Reference</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Titre</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Exploitant</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Echeance</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Sites</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {client.contracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-medium text-gray-900">{contract.reference}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{contract.title}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{contract.provider}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {new Date(contract.endDate).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[contract.status] || "bg-gray-100 text-gray-700"}`}>
                          {STATUS_LABELS[contract.status] || contract.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">{contract._count.contractSites}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(contract.id)}
                            title="Modifier le contrat"
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setAeContractId(contract.id)}
                            title="Importer un AE dans ce contrat"
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                          >
                            <FileSpreadsheet size={15} />
                          </button>
                          <button
                            onClick={() => handleDetach(contract.id, contract.reference)}
                            title="Détacher du client"
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                          >
                            <Unlink size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteContract(contract.id, contract.reference)}
                            title="Supprimer le contrat"
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      {/* Modal rattachement de contrats orphelins */}
      {showAttach && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-xl mx-4 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold">Rattacher un contrat</h2>
                <p className="text-sm text-gray-500">à {client.name}</p>
              </div>
              <button onClick={() => setShowAttach(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loadingOrphans ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-accent" />
                </div>
              ) : orphanContracts.length === 0 ? (
                <p className="p-8 text-center text-sm text-gray-500">
                  Aucun contrat sans client. Tous tes contrats sont déjà rattachés.
                </p>
              ) : (
                orphanContracts.map((c) => {
                  const checked = selectedIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        const next = new Set(selectedIds);
                        if (checked) next.delete(c.id);
                        else next.add(c.id);
                        setSelectedIds(next);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                        checked ? "bg-accent/5" : "hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                          checked ? "bg-accent border-accent" : "border-gray-300"
                        }`}
                      >
                        {checked && <Check size={14} className="text-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">{c.reference}</span>
                          <span className="text-xs text-gray-400">
                            {c._count.contractSites} site{c._count.contractSites > 1 ? "s" : ""}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{c.title} — {c.provider}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex gap-3 p-4 border-t">
              <button
                type="button"
                onClick={() => setShowAttach(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleAttach}
                disabled={attaching || selectedIds.size === 0}
                className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {attaching && <Loader2 size={16} className="animate-spin" />}
                Rattacher{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal édition contrat */}
      {editingContract && (
        <EditContractModal
          contractId={editingContract.id}
          contractDetail={editingContract}
          onClose={() => setEditingContract(null)}
          onUpdated={async () => { await fetchClient(); }}
        />
      )}

      {/* Modal import AE sur un contrat existant */}
      {aeContractId && (
        <AEImportModal
          contractId={aeContractId}
          onClose={() => { setAeContractId(null); fetchClient(); }}
        />
      )}

      {/* Modal création d'un nouveau contrat rattaché au client */}
      {showCreateContract && (
        <CreateContractModal
          clientId={clientId}
          onClose={() => setShowCreateContract(false)}
        />
      )}

      {/* Modal création d'un contrat depuis un AE, rattaché au client */}
      {showCreateAE && (
        <AEImportModal
          clientId={clientId}
          onClose={() => setShowCreateAE(false)}
        />
      )}
    </div>
  );
}
