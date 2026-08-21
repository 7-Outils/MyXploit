"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Loader2, Search, X } from "lucide-react";

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

const emptyForm = {
  name: "",
  siret: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
  city: "",
  postalCode: "",
};

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

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
    // ?new=1 : arrivée depuis "+ Nouveau client" du sélecteur, on ouvre
    // directement le formulaire de création.
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setShowModal(true);
    }
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

      // Nouveau client créé : sa fiche est le hub pour y rattacher des contrats.
      router.push(`/clients/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setSaving(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.city || "").toLowerCase().includes(q) ||
      (c.contactName || "").toLowerCase().includes(q)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-ink/10 pb-3">
        <div>
          <p className="label-tech">Portefeuille</p>
          <h1 className="mt-1 text-xl font-semibold text-ink">Clients</h1>
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/30" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56 border border-ink/20 bg-white pl-8 pr-3 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            title="Nouveau client"
            className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <Building2 size={40} className="mx-auto mb-4 text-ink/20" />
          <p className="text-sm text-ink/60">
            {search ? "Aucun client ne correspond à la recherche" : "Aucun client. Ajoutez le premier avec le bouton +"}
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink/10 text-left">
                  <th className="label-tech px-4 py-2.5">Client</th>
                  <th className="label-tech px-4 py-2.5">Ville</th>
                  <th className="label-tech px-4 py-2.5">Contact</th>
                  <th className="label-tech px-4 py-2.5">SIRET</th>
                  <th className="label-tech px-4 py-2.5 text-right">Contrats</th>
                  <th className="label-tech px-4 py-2.5 text-right">Sites</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="cursor-pointer transition-colors hover:bg-ink/[0.02]"
                  >
                    <td className="px-4 py-2 text-sm font-medium text-ink">{client.name}</td>
                    <td className="px-4 py-2 text-sm text-ink/60">
                      {client.city || <span className="text-ink/25">—</span>}
                    </td>
                    <td className="px-4 py-2 text-sm text-ink/60">
                      {client.contactName ? (
                        <>
                          {client.contactName}
                          {client.contactPhone && (
                            <span className="ml-2 font-mono text-xs tabular-nums text-ink/40">
                              {client.contactPhone}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-ink/25">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs tabular-nums text-ink/50">
                      {client.siret || <span className="text-ink/25">—</span>}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono text-sm tabular-nums ${client._count.contracts > 0 ? "text-ink" : "text-ink/25"}`}>
                      {client._count.contracts}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono text-sm tabular-nums ${client._count.sites > 0 ? "text-ink" : "text-ink/25"}`}>
                      {client._count.sites}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-ink/10 px-4 py-2">
            <p className="label-tech">
              <span className="tabular-nums">{filtered.length}</span>
              {search ? ` / ${clients.length}` : ""} client{clients.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Modal creation */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-lg overflow-hidden border border-ink/10 bg-white shadow-large">
            <div className="panel-header">
              <h2 className="label-tech">Nouveau client</h2>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center text-ink/50 transition-colors hover:text-accent"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 p-4">
              {error && (
                <div className="border border-red-600/20 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              <div>
                <label className="label-tech mb-1 block">Nom du client *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="Ex: Ville de Lyon"
                />
              </div>

              <div>
                <label className="label-tech mb-1 block">Adresse</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="1 place de la Mairie"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label-tech mb-1 block">Code postal</label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 font-mono text-sm tabular-nums focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="label-tech mb-1 block">Ville</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="label-tech mb-1 block">SIRET</label>
                <input
                  type="text"
                  value={formData.siret}
                  onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 font-mono text-sm tabular-nums focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-tech mb-1 block">Nom du contact</label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-1 block">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 font-mono text-sm tabular-nums focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="label-tech mb-1 block">Email contact</label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="Mis en copie des devis acceptés"
                />
              </div>

              <div className="-mx-4 mt-4 flex items-center justify-end gap-2 border-t border-ink/10 px-4 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border border-ink/20 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.name.trim()}
                  className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Créer le client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
