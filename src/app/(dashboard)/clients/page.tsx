"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Loader2,
  Search,
  X,
  MapPin,
  FileText,
  Phone,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  siret: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  city: string | null;
  _count: {
    sites: number;
    contracts: number;
  };
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    siret: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    city: "",
    postalCode: "",
  });

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/clients");
      if (res.ok) setClients(await res.json());
    } catch (err) {
      console.error("Error fetching clients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur");

      await fetchClients();
      setShowModal(false);
      setFormData({ name: "", siret: "", contactName: "", contactEmail: "", contactPhone: "", address: "", city: "", postalCode: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.city || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink/10 pb-4">
        <div>
          <p className="label-tech">Portefeuille</p>
          <h1 className="text-xl font-semibold text-ink mt-1">Clients</h1>
          <p className="text-sm text-ink/50 mt-0.5">
            <span className="font-mono tabular-nums">{clients.length}</span> client{clients.length > 1 ? "s" : ""} dans votre portefeuille
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          title="Nouveau client"
          className="h-10 w-10 flex items-center justify-center bg-ink text-paper hover:bg-accent transition-colors"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
        <input
          type="text"
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-ink/20 bg-white pl-9 pr-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      {/* Clients Grid */}
      {filtered.length === 0 ? (
        <div className="panel p-10 text-center">
          <Building2 size={40} className="mx-auto text-ink/20 mb-4" />
          <h3 className="text-base font-semibold text-ink mb-1">
            {search ? "Aucun client trouve" : "Aucun client"}
          </h3>
          <p className="text-sm text-ink/50 mb-4">
            {search ? "Essayez un autre terme de recherche" : "Ajoutez votre premier client pour commencer"}
          </p>
          {!search && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-ink text-paper hover:bg-accent transition-colors"
            >
              <Plus size={16} />
              Ajouter un client
            </button>
          )}
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink/10 text-left">
                <th className="label-tech px-4 py-2.5">Client</th>
                <th className="label-tech px-4 py-2.5">Ville</th>
                <th className="label-tech px-4 py-2.5">Contact</th>
                <th className="label-tech px-4 py-2.5 text-right">Contrats</th>
                <th className="label-tech px-4 py-2.5 text-right">Sites</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/clients/${client.id}`)}
                  className="hover:bg-ink/[0.02] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Building2 size={16} className="text-ink/40 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-ink truncate">{client.name}</p>
                        {client.siret && <p className="label-tech mt-0.5">SIRET <span className="tabular-nums">{client.siret}</span></p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-ink/60">
                    {client.city ? (
                      <span className="flex items-center gap-1"><MapPin size={13} className="text-ink/40" /> {client.city}</span>
                    ) : <span className="text-ink/25">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-ink/60">
                    {client.contactName ? (
                      <span className="flex items-center gap-1"><Phone size={13} className="text-ink/40" /> {client.contactName}</span>
                    ) : <span className="text-ink/25">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`inline-flex items-center gap-1.5 text-sm font-mono tabular-nums ${client._count.contracts > 0 ? "text-ink font-medium" : "text-ink/25"}`}>
                      <FileText size={13} className="text-ink/40" /> {client._count.contracts}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`inline-flex items-center gap-1.5 text-sm font-mono tabular-nums ${client._count.sites > 0 ? "text-ink font-medium" : "text-ink/25"}`}>
                      <MapPin size={13} className="text-ink/40" /> {client._count.sites}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal creation */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50">
          <div className="bg-white border border-ink/10 shadow-large w-full max-w-lg mx-4 overflow-hidden">
            <div className="panel-header">
              <h2 className="label-tech">Nouveau client</h2>
              <button onClick={() => setShowModal(false)} className="h-8 w-8 flex items-center justify-center text-ink/50 hover:text-accent transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              {error && <div className="border border-red-600/20 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

              <div>
                <label className="label-tech block mb-1">Nom du client *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="Ex: Ville de Lyon"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech block mb-1">SIRET</label>
                  <input
                    type="text"
                    value={formData.siret}
                    onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech block mb-1">Ville</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="label-tech block mb-1">Nom du contact</label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech block mb-1">Email contact</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech block mb-1">Telephone</label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 text-sm font-medium border border-ink/20 text-ink hover:border-accent hover:text-accent transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium bg-ink text-paper hover:bg-accent disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Creer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
