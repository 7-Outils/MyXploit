"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Loader2,
  X,
  Check,
  Clock,
  Send,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/permissions";

interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  contractsCount: number;
  createdAt: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "EDITOR",
  });

  const fetchTeam = async () => {
    try {
      const res = await fetch("/api/team");
      if (res.ok) setMembers(await res.json());
    } catch (err) {
      console.error("Error fetching team:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur");

      await fetchTeam();
      setShowModal(false);
      setFormData({ email: "", firstName: "", lastName: "", role: "EDITOR" });
      if (data.emailSent === false) {
        alert("Membre cree mais l'email d'invitation n'a pas pu etre envoye. Verifiez la configuration SMTP ou renvoyez l'invitation.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const handleResendInvite = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/resend-invitation`, { method: "POST" });
      if (res.ok) alert("Invitation renvoyee");
      else {
        const data = await res.json();
        alert(data.error || "Erreur");
      }
    } catch {
      alert("Erreur lors de l'envoi");
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Supprimer le membre "${email}" ?`)) return;
    try {
      const res = await fetch(`/api/team/${userId}`, { method: "DELETE" });
      if (res.ok) setMembers(members.filter((m) => m.id !== userId));
      else {
        const data = await res.json();
        alert(data.error || "Erreur");
      }
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  const activeCount = members.filter((m) => m.isActive).length;
  const pendingCount = members.filter((m) => !m.isActive).length;

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
          <p className="label-tech">Organisation</p>
          <h1 className="text-xl font-semibold text-ink mt-1">Equipe</h1>
          <p className="text-sm text-ink/50 mt-0.5">
            Gerez les membres de votre organisation
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          title="Inviter un membre"
          className="h-9 w-9 flex items-center justify-center bg-ink text-paper hover:bg-accent transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-ink/10 border border-ink/10 bg-white">
        <div className="p-4">
          <p className="label-tech flex items-center gap-1.5">
            <Users size={12} className="text-ink/40" />
            Total membres
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{members.length}</p>
        </div>
        <div className="p-4">
          <p className="label-tech flex items-center gap-1.5">
            <UserCheck size={12} className="text-ink/40" />
            Actifs
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{activeCount}</p>
        </div>
        <div className="p-4">
          <p className="label-tech flex items-center gap-1.5">
            <UserPlus size={12} className="text-ink/40" />
            En attente
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{pendingCount}</p>
        </div>
      </div>

      {/* Members Table */}
      <div className="panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-white border-b border-ink/10">
              <th className="label-tech whitespace-nowrap px-4 py-2.5 text-left">Membre</th>
              <th className="label-tech whitespace-nowrap px-4 py-2.5 text-left">Role</th>
              <th className="label-tech whitespace-nowrap px-4 py-2.5 text-left">Statut</th>
              <th className="label-tech whitespace-nowrap px-4 py-2.5 text-left">Contrats</th>
              <th className="label-tech whitespace-nowrap px-4 py-2.5 text-left">Depuis</th>
              <th className="label-tech whitespace-nowrap px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-ink/[0.02]">
                <td className="px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-xs text-ink/50">{member.email}</p>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className="border border-ink/15 px-2 py-0.5 text-xs font-medium text-ink/70">
                    {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {member.isActive ? (
                    <span className="flex w-fit items-center gap-1 border border-green-600/20 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      <Check size={12} /> Actif
                    </span>
                  ) : (
                    <span className="flex w-fit items-center gap-1 border border-amber-600/20 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <Clock size={12} /> En attente
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-sm tabular-nums text-ink/80">{member.contractsCount}</td>
                <td className="px-4 py-2.5 font-mono text-sm tabular-nums text-ink/50">
                  {new Date(member.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {!member.isActive && (
                      <button
                        onClick={() => handleResendInvite(member.id)}
                        className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
                        title="Renvoyer l'invitation"
                      >
                        <Send size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(member.id, member.email)}
                      className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && (
          <div className="border-t border-ink/10 px-4 py-10 text-center text-sm text-ink/40">
            Aucun membre dans l&apos;equipe. Invitez vos ingenieurs pour commencer.
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50">
          <div className="bg-white border border-ink/10 shadow-large w-full max-w-md mx-4 overflow-hidden">
            <div className="panel-header">
              <h2 className="label-tech">Inviter un membre</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-ink/50 hover:bg-ink/[0.03] hover:text-accent">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-4 space-y-4">
              {error && <div className="border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech mb-1 block">Prenom</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-1 block">Nom</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="label-tech mb-1 block">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="nom@cabinet.fr"
                />
              </div>

              <div>
                <label className="label-tech mb-1 block">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="EDITOR">Ingenieur</option>
                  <option value="READER">Lecteur</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-ink/20 px-4 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 bg-ink px-4 py-2 text-sm text-paper transition-colors hover:bg-accent disabled:opacity-50">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Envoyer l&apos;invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
