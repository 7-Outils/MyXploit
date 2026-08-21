"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { Loader2, Plus, Pencil, Trash2, Check, X, Users } from "lucide-react";
import { ReadOnlyGate } from "@/components/permissions";

interface ContractContact {
  id: string;
  name: string;
  email: string;
  role: string | null;
  side: "EXPLOITANT" | "CLIENT";
}

interface ContractContactsTabProps {
  contractId: string;
}

const emptyForm = { name: "", email: "", role: "", side: "EXPLOITANT" as "EXPLOITANT" | "CLIENT" };

const SIDE_LABELS: Record<string, string> = {
  EXPLOITANT: "Exploitant",
  CLIENT: "Client",
};

export default function ContractContactsTab({ contractId }: ContractContactsTabProps) {
  const { data, isLoading, mutate } = useSWR<ContractContact[]>(
    `/api/contracts/${contractId}/contacts`,
    fetcher
  );
  const contacts = data ?? [];

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (contact: ContractContact) => {
    setEditingId(contact.id);
    setForm({
      name: contact.name,
      email: contact.email,
      role: contact.role || "",
      side: contact.side,
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const url = editingId
        ? `/api/contracts/${contractId}/contacts/${editingId}`
        : `/api/contracts/${contractId}/contacts`;
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role.trim() || null,
          side: form.side,
        }),
      });
      if (res.ok) {
        cancelEdit();
        mutate();
      } else {
        const result = await res.json();
        setError(result.error || "Erreur lors de l'enregistrement");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (contact: ContractContact) => {
    if (!confirm(`Supprimer le contact ${contact.name} ?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/contacts/${contact.id}`, {
        method: "DELETE",
      });
      if (res.ok) mutate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/50">
        Qui fait quoi sur ce contrat. Les contacts exploitant sont proposés en
        destinataires des devis acceptés, les contacts client en copie.
      </p>

      <ReadOnlyGate>
        <form onSubmit={handleSubmit} className="panel p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nom *"
              required
              className="border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@domaine.fr *"
              required
              className="border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <input
              type="text"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="Fonction (ex: Resp. exploitation)"
              className="border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <select
              value={form.side}
              onChange={(e) => setForm({ ...form, side: e.target.value as "EXPLOITANT" | "CLIENT" })}
              className="border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value="EXPLOITANT">Exploitant</option>
              <option value="CLIENT">Client</option>
            </select>
            <div className="flex items-center gap-1">
              <button
                type="submit"
                disabled={busy || !form.name.trim() || !form.email.trim()}
                title={editingId ? "Enregistrer" : "Ajouter le contact"}
                className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : editingId ? <Check size={16} /> : <Plus size={16} />}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  title="Annuler la modification"
                  className="flex h-9 w-9 items-center justify-center border border-ink/10 text-ink/60 transition-colors hover:bg-ink/[0.02]"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-700">{error}</p>
          )}
        </form>
      </ReadOnlyGate>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-white border border-ink/10 p-12 text-center">
          <Users size={48} className="mx-auto text-ink/25 mb-4" />
          <p className="text-ink/60">Aucun contact pour ce contrat</p>
        </div>
      ) : (
        <div className="bg-white border border-ink/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white border-b border-ink/10">
                <tr>
                  <th className="label-tech px-4 py-2.5 text-left">Nom</th>
                  <th className="label-tech px-4 py-2.5 text-left">Fonction</th>
                  <th className="label-tech px-4 py-2.5 text-left">Email</th>
                  <th className="label-tech px-4 py-2.5 text-left">Côté</th>
                  <th className="label-tech px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-ink/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-ink">{contact.name}</td>
                    <td className="px-4 py-3 text-sm text-ink/60">{contact.role || "—"}</td>
                    <td className="px-4 py-3 text-sm text-ink/60">{contact.email}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 text-xs font-medium ${contact.side === "EXPLOITANT" ? "bg-accent/10 text-accent" : "bg-ink/5 text-ink/80 border border-ink/10"}`}>
                        {SIDE_LABELS[contact.side]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ReadOnlyGate>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(contact)}
                            title="Modifier"
                            className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(contact)}
                            disabled={busy}
                            title="Supprimer"
                            className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </ReadOnlyGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
