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
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
          <p className="text-gray-600 mt-1">
            Gerez les membres de votre organisation
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus size={18} />
          Inviter un membre
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Users size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{members.length}</p>
            <p className="text-sm text-gray-600">Total membres</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <UserCheck size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
            <p className="text-sm text-gray-600">Actifs</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <UserPlus size={20} className="text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
            <p className="text-sm text-gray-600">En attente</p>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Membre</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Contrats</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Depuis</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-5 py-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${ROLE_COLORS[member.role as keyof typeof ROLE_COLORS] || "bg-gray-100 text-gray-700"}`}>
                    {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {member.isActive ? (
                    <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded w-fit">
                      <Check size={12} /> Actif
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded w-fit">
                      <Clock size={12} /> En attente
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">{member.contractsCount}</td>
                <td className="px-5 py-4 text-sm text-gray-500">
                  {new Date(member.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {!member.isActive && (
                      <button
                        onClick={() => handleResendInvite(member.id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Renvoyer l'invitation"
                      >
                        <Send size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(member.id, member.email)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
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
          <div className="p-8 text-center text-gray-500">
            Aucun membre dans l&apos;equipe. Invitez vos ingenieurs pour commencer.
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Inviter un membre</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-4 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prenom</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="nom@cabinet.fr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                >
                  <option value="EDITOR">Ingenieur</option>
                  <option value="READER">Lecteur</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2">
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
