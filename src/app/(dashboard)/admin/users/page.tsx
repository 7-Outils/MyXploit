"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Users,
  Building2,
  Trash2,
  X,
  Check,
  Mail,
  Clock,
  Send,
  Pencil,
} from "lucide-react";
import { ROLE_LABELS, ASSIGNABLE_ROLES } from "@/lib/permissions";

interface Organization {
  id: string;
  name: string;
  _count?: {
    users: number;
    sites: number;
  };
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "EDITOR" | "MANAGER" | "READER";
  password: string | null;
  organization: Organization;
  createdAt: string;
}


export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state for new user
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "READER" as User["role"],
    organizationId: "",
    newOrgName: "",
  });

  // Form state for edit user
  const [editFormData, setEditFormData] = useState({
    firstName: "",
    lastName: "",
    role: "READER" as User["role"],
    organizationId: "",
  });

  const fetchData = async () => {
    try {
      const [usersRes, orgsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/organizations"),
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        setOrganizations(orgsData);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Erreur lors du chargement des données");
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
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName || null,
          lastName: formData.lastName || null,
          role: formData.role,
          organizationId: formData.organizationId || null,
          organizationName: formData.newOrgName || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la création");
      }

      // Refresh data
      await fetchData();
      setShowModal(false);
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        role: "READER",
        organizationId: "",
        newOrgName: "",
      });
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
        body: JSON.stringify({
          firstName: editFormData.firstName || null,
          lastName: editFormData.lastName || null,
          role: editFormData.role,
          organizationId: editFormData.organizationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la modification");
      }

      // Refresh data
      await fetchData();
      setShowEditModal(false);
      setEditingUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Supprimer l'utilisateur ${userEmail} ?`)) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUsers(users.filter((u) => u.id !== userId));
      } else {
        const data = await response.json();
        alert(data.error || "Erreur lors de la suppression");
      }
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  const handleResendInvitation = async (userId: string) => {
    setResending(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/resend-invitation`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        alert("Invitation envoyée avec succès !");
      } else {
        alert(data.error || "Erreur lors de l'envoi");
      }
    } catch {
      alert("Erreur lors de l'envoi de l'invitation");
    } finally {
      setResending(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-ink"
          >
            <ArrowLeft size={20} className="text-text-secondary" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-ink">
              Gestion des utilisateurs
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Créer et gérer les comptes utilisateurs
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent"
        >
          <Plus size={20} />
          Nouvel utilisateur
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-ink/10 bg-white p-4">
          <div className="flex items-center gap-3">
            <Users size={16} className="flex-shrink-0 text-ink/30" />
            <div>
              <p className="font-mono text-xl font-medium tabular-nums text-ink">{users.length}</p>
              <p className="text-sm text-text-secondary">Utilisateurs</p>
            </div>
          </div>
        </div>
        <div className="border border-ink/10 bg-white p-4">
          <div className="flex items-center gap-3">
            <Building2 size={16} className="flex-shrink-0 text-ink/30" />
            <div>
              <p className="font-mono text-xl font-medium tabular-nums text-ink">{organizations.length}</p>
              <p className="text-sm text-text-secondary">Organisations</p>
            </div>
          </div>
        </div>
        <div className="border border-ink/10 bg-white p-4">
          <div className="flex items-center gap-3">
            <Check size={16} className="flex-shrink-0 text-ink/30" />
            <div>
              <p className="font-mono text-xl font-medium tabular-nums text-ink">
                {users.filter((u) => u.password).length}
              </p>
              <p className="text-sm text-text-secondary">Comptes activés</p>
            </div>
          </div>
        </div>
        <div className="border border-ink/10 bg-white p-4">
          <div className="flex items-center gap-3">
            <Clock size={16} className="flex-shrink-0 text-ink/30" />
            <div>
              <p className="font-mono text-xl font-medium tabular-nums text-ink">
                {users.filter((u) => !u.password).length}
              </p>
              <p className="text-sm text-text-secondary">En attente</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="border border-ink/10 bg-white">
        <table className="w-full">
          <thead className="bg-ink/[0.015]">
            <tr>
              <th className="label-tech px-4 py-2.5 text-left">
                Utilisateur
              </th>
              <th className="label-tech px-4 py-2.5 text-left">
                Organisation
              </th>
              <th className="label-tech px-4 py-2.5 text-left">
                Rôle
              </th>
              <th className="label-tech px-4 py-2.5 text-left">
                Statut
              </th>
              <th className="label-tech px-4 py-2.5 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-ink/[0.02]">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-ink">
                      {user.firstName || user.lastName
                        ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                        : "—"}
                    </p>
                    <p className="text-sm text-ink/50">{user.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-ink">
                    {user.organization.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="font-mono text-[11px] uppercase tracking-widest text-ink/50"
                  >
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.password ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <Check size={14} />
                      Activé
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-amber-600">
                      <Clock size={14} />
                      En attente
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
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
                        onClick={() => handleResendInvitation(user.id)}
                        disabled={resending === user.id}
                        className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent disabled:opacity-50"
                        title="Renvoyer l'invitation"
                      >
                        {resending === user.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Send size={16} />
                        )}
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
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink/50">
                  Aucun utilisateur
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal création */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4 border border-ink/15 bg-white shadow-large">
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
              <h2 className="label-tech">Nouvel utilisateur</h2>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-4 space-y-4">
              {error && (
                <div className="border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="label-tech mb-2 block">
                  Email *
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
                  />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full border border-ink/20 bg-white py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink/30 focus:border-accent focus:outline-none"
                    placeholder="email@exemple.com"
                  />
                </div>
                <p className="text-xs text-ink/50 mt-1">
                  L&apos;utilisateur recevra un email pour se connecter
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech mb-2 block">
                    Prénom
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-2 block">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="label-tech mb-2 block">
                  Rôle
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as User["role"],
                    })
                  }
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-tech mb-2 block">
                  Organisation
                </label>
                <select
                  value={formData.organizationId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      organizationId: e.target.value,
                      newOrgName: e.target.value === "new" ? formData.newOrgName : "",
                    })
                  }
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">Sélectionner...</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                  <option value="new">+ Nouvelle organisation</option>
                </select>
              </div>

              {formData.organizationId === "new" && (
                <div>
                  <label className="label-tech mb-2 block">
                    Nom de la nouvelle organisation
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.newOrgName}
                    onChange={(e) =>
                      setFormData({ ...formData, newOrgName: e.target.value })
                    }
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                    placeholder="Nom de l'organisation"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal édition */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4 border border-ink/15 bg-white shadow-large">
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
              <h2 className="label-tech">Modifier l&apos;utilisateur</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
                className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-4 space-y-4">
              {error && (
                <div className="border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="p-3 bg-ink/[0.015]">
                <p className="text-sm text-text-secondary">Email</p>
                <p className="font-medium text-ink">{editingUser.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech mb-2 block">
                    Prénom
                  </label>
                  <input
                    type="text"
                    value={editFormData.firstName}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, firstName: e.target.value })
                    }
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-2 block">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={editFormData.lastName}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, lastName: e.target.value })
                    }
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="label-tech mb-2 block">
                  Rôle
                </label>
                <select
                  value={editFormData.role}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      role: e.target.value as User["role"],
                    })
                  }
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-tech mb-2 block">
                  Organisation
                </label>
                <select
                  value={editFormData.organizationId}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      organizationId: e.target.value,
                    })
                  }
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
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
