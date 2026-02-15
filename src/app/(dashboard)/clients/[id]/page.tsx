"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  X,
  Check,
  Phone,
  Mail,
  Wrench,
  AlertTriangle,
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

  useEffect(() => {
    const fetchClient = async () => {
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
    };
    fetchClient();
  }, [clientId, router]);

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
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {client.contracts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Aucun contrat rattache a ce client</div>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
