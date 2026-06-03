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
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"sites" | "contracts">("sites");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ name: "", siret: "", contactName: "", contactEmail: "", contactPhone: "", city: "" });

  // Rattachement de contrats orphelins
  const [showAttach, setShowAttach] = useState(false);
  const [orphanContracts, setOrphanContracts] = useState<Contract[]>([]);
  const [loadingOrphans, setLoadingOrphans] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState(false);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clients" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="text-2xl font-bold px-2 py-1 border border-gray-200 rounded-lg"
                  autoFocus
                />
                <button onClick={handleSave} className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                  <Check size={20} />
                </button>
                <button onClick={() => setEditing(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                  {client.city && <span className="flex items-center gap-1"><MapPin size={14} /> {client.city}</span>}
                  {client.siret && <span>SIRET: {client.siret}</span>}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(true)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Modifier">
            <Pencil size={18} />
          </button>
          <button onClick={handleDelete} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Supprimer">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Contact Info */}
      {(client.contactName || client.contactEmail || client.contactPhone) && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-6">
          {client.contactName && (
            <span className="text-sm text-gray-700 font-medium">{client.contactName}</span>
          )}
          {client.contactEmail && (
            <span className="text-sm text-gray-500 flex items-center gap-1"><Mail size={14} /> {client.contactEmail}</span>
          )}
          {client.contactPhone && (
            <span className="text-sm text-gray-500 flex items-center gap-1"><Phone size={14} /> {client.contactPhone}</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <MapPin size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{client._count.sites}</p>
            <p className="text-sm text-gray-600">Sites</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <FileText size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{client._count.contracts}</p>
            <p className="text-sm text-gray-600">Contrats</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("sites")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "sites" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Sites ({client.sites.length})
        </button>
        <button
          onClick={() => setActiveTab("contracts")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "contracts" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Contrats ({client.contracts.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "sites" && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {client.sites.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Aucun site rattache a ce client</div>
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

      {activeTab === "contracts" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={openAttach}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
            >
              <Link2 size={16} />
              Rattacher un contrat
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {client.contracts.length === 0 ? (
              <div className="p-8 text-center">
                <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 mb-4">Aucun contrat rattaché à ce client</p>
                <button
                  onClick={openAttach}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
                >
                  <Plus size={16} />
                  Rattacher un contrat existant
                </button>
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
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleDetach(contract.id, contract.reference)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Détacher du client"
                        >
                          <Unlink size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
    </div>
  );
}
