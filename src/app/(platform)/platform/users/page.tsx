"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Users,
  Search,
  Mail,
  Clock,
  Send,
  Plus,
  X,
  Check,
  Pencil,
  Trash2,
  Building2,
} from "lucide-react";
import { ROLE_LABELS, ASSIGNABLE_ROLES } from "@/lib/permissions";

interface Organization {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  password: string | null;
  organization: Organization;
  createdAt: string;
}

export default function PlatformUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [filterRole, setFilterRole] = useState("");

  // Create user modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "READER",
    organizationId: "",
  });

  // Edit user modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState({
    firstName: "",
    lastName: "",
    role: "READER",
    organizationId: "",
  });

  const fetchData = async () => {
    try {
      const [usersRes, orgsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/organizations"),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (orgsRes.ok) setOrganizations(await orgsRes.json());
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur");

      await fetchData();
      setShowModal(false);
      setFormData({ email: "", firstName: "", lastName: "", role: "READER", organizationId: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role,
      organizationId: user.organization.id,
    });
    setShowEditModal(true);
    setError(null);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de la modification");

      await fetchData();
      setShowEditModal(false);
      setEditingUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Supprimer l'utilisateur "${email}" ?`)) return;
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (response.ok) {
        setUsers(users.filter((u) => u.id !== userId));
      } else {
        const data = await response.json();
        alert(data.error || "Erreur");
      }
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  const handleResendInvite = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/resend-invitation`, { method: "POST" });
      if (response.ok) {
        alert("Invitation renvoyee");
      } else {
        const data = await response.json();
        alert(data.error || "Erreur");
      }
    } catch {
      alert("Erreur lors de l'envoi");
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchSearch =
      !search ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      (user.firstName || "").toLowerCase().includes(search.toLowerCase()) ||
      (user.lastName || "").toLowerCase().includes(search.toLowerCase());
    const matchOrg = !filterOrg || user.organization.id === filterOrg;
    const matchRole = !filterRole || user.role === filterRole;
    return matchSearch && matchOrg && matchRole;
  });

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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Utilisateurs</h1>
          <p className="text-sm text-text-secondary mt-1">
            {users.length} utilisateurs sur la plateforme
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          title="Nouvel utilisateur"
          className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-ink/20 bg-white py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink/30 focus:border-accent focus:outline-none"
          />
        </div>
        <select
          value={filterOrg}
          onChange={(e) => setFilterOrg(e.target.value)}
          className="border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        >
          <option value="">Toutes les organisations</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        >
          <option value="">Tous les roles</option>
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
      </div>

      {/* Users Table */}
      <div className="panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ink/10">
              <th className="label-tech px-4 py-2.5 text-left">Utilisateur</th>
              <th className="label-tech px-4 py-2.5 text-left">Organisation</th>
              <th className="label-tech px-4 py-2.5 text-left">Role</th>
              <th className="label-tech px-4 py-2.5 text-left">Statut</th>
              <th className="label-tech px-4 py-2.5 text-left">Date</th>
              <th className="label-tech px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-ink/[0.02]">
                <td className="px-4 py-2">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="font-mono text-[11px] text-ink/40">{user.email}</p>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <span className="text-sm text-ink">{user.organization.name}</span>
                </td>
                <td className="px-4 py-2">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
                    {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {user.password ? (
                    <span className="inline-flex w-fit items-center gap-1.5 border border-green-600/20 bg-green-50 px-2 py-0.5 text-xs text-green-700">
                      <Check size={12} /> Actif
                    </span>
                  ) : (
                    <span className="inline-flex w-fit items-center gap-1.5 border border-amber-600/20 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                      <Clock size={12} /> En attente
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span className="font-mono text-[11px] tabular-nums text-ink/40">
                    {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
                      title="Modifier"
                    >
                      <Pencil size={16} />
                    </button>
                    {!user.password && (
                      <button
                        onClick={() => handleResendInvite(user.id)}
                        className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
                        title="Renvoyer l'invitation"
                      >
                        <Send size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteUser(user.id, user.email)}
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
        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-sm text-text-secondary">
            {search || filterOrg || filterRole ? "Aucun utilisateur trouve" : "Aucun utilisateur"}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4 border border-ink/15 bg-white shadow-large">
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
              <h2 className="label-tech">Nouvel utilisateur</h2>
              <button onClick={() => setShowModal(false)} title="Fermer" className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-4 space-y-4">
              {error && <div className="border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech mb-2 block">Prenom</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-2 block">Nom</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="label-tech mb-2 block">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="label-tech mb-2 block">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-tech mb-2 block">Organisation *</label>
                <select
                  required
                  value={formData.organizationId}
                  onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">Selectionner...</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-ink/20 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:opacity-50">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Creer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4 border border-ink/15 bg-white shadow-large">
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
              <h2 className="label-tech">Modifier l&apos;utilisateur</h2>
              <button
                onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                title="Fermer"
                className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-4 space-y-4">
              {error && <div className="border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

              <div className="border border-ink/10 p-3">
                <p className="label-tech">Email</p>
                <p className="mt-1 font-mono text-sm text-ink">{editingUser.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech mb-2 block">Prenom</label>
                  <input
                    type="text"
                    value={editFormData.firstName}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-2 block">Nom</label>
                  <input
                    type="text"
                    value={editFormData.lastName}
                    onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="label-tech mb-2 block">Role</label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-tech mb-2 block">Organisation</label>
                <select
                  value={editFormData.organizationId}
                  onChange={(e) => setEditFormData({ ...editFormData, organizationId: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                  className="flex-1 border border-ink/20 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
