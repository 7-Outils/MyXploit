"use client";

import { useState, useEffect, useCallback } from "react";
import { User, Building, Bell, Shield, Loader2, Check, AlertCircle, FolderKanban, Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard/chart-card";
import Link from "next/link";

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  profile: string | null;
  organization: {
    id: string;
    name: string;
  } | null;
}

interface MissionType {
  id: string;
  name: string;
  isActive: boolean;
  _count: { missions: number };
}

import { ROLE_LABELS } from "@/lib/permissions";

export default function SettingsPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Mission types state
  const [missionTypes, setMissionTypes] = useState<MissionType[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [addingType, setAddingType] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");

  const fetchMissionTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/mission-types");
      if (res.ok) setMissionTypes(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
        }
      } catch (err) {
        console.error("Error fetching user:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
    fetchMissionTypes();
  }, [fetchMissionTypes]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Erreur lors de la sauvegarde");
      }
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">Paramètres</h1>
        <p className="text-text-secondary">
          Gérez votre compte et vos préférences
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-soft hover:border-accent/20 transition-all">
          <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center mb-3">
            <User size={20} className="text-accent" />
          </div>
          <h3 className="font-medium text-primary-dark">Mon profil</h3>
          <p className="text-sm text-text-secondary mt-1">Modifiez vos informations ci-dessous</p>
        </div>

        {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && (
          <Link
            href="/admin/users"
            className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-soft hover:border-accent/20 transition-all block"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
              <Building size={20} className="text-purple-600" />
            </div>
            <h3 className="font-medium text-primary-dark">Utilisateurs</h3>
            <p className="text-sm text-text-secondary mt-1">Gérez les membres de votre équipe</p>
          </Link>
        )}

        <div className="bg-white rounded-xl p-5 border border-gray-100 opacity-50">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
            <Bell size={20} className="text-blue-600" />
          </div>
          <h3 className="font-medium text-primary-dark">Notifications</h3>
          <p className="text-sm text-text-secondary mt-1">Bientôt disponible</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 opacity-50">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-3">
            <Shield size={20} className="text-amber-600" />
          </div>
          <h3 className="font-medium text-primary-dark">Sécurité</h3>
          <p className="text-sm text-text-secondary mt-1">Bientôt disponible</p>
        </div>
      </div>

      {/* Profile Section */}
      <ChartCard title="Informations du compte">
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
            <Check size={16} />
            Modifications enregistrées
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Prénom
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Votre prénom"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Nom
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Votre nom"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Rôle
            </label>
            <input
              type="text"
              value={ROLE_LABELS[user?.role as keyof typeof ROLE_LABELS] || user?.role || ""}
              disabled
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Organisation
            </label>
            <input
              type="text"
              value={user?.organization?.name || "Aucune organisation"}
              disabled
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin mr-2" />}
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>
        </div>
      </ChartCard>

      {/* Mission Types - ADMIN only */}
      {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <FolderKanban size={18} className="text-accent" />
              Types de missions
            </span>
          }
        >
          <p className="text-sm text-gray-500 mb-4">
            Configurez les types de missions que votre bureau d&apos;etudes realise.
          </p>

          {/* Add new type */}
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newTypeName.trim()) {
                  setAddingType(true);
                  try {
                    const res = await fetch("/api/mission-types", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newTypeName.trim() }),
                    });
                    if (res.ok) {
                      setNewTypeName("");
                      fetchMissionTypes();
                    }
                  } catch {
                    // ignore
                  } finally {
                    setAddingType(false);
                  }
                }
              }}
              placeholder="Nouveau type de mission..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <button
              onClick={async () => {
                if (!newTypeName.trim()) return;
                setAddingType(true);
                try {
                  const res = await fetch("/api/mission-types", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newTypeName.trim() }),
                  });
                  if (res.ok) {
                    setNewTypeName("");
                    fetchMissionTypes();
                  }
                } catch {
                  // ignore
                } finally {
                  setAddingType(false);
                }
              }}
              disabled={addingType || !newTypeName.trim()}
              className="flex items-center gap-1 px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 disabled:opacity-50"
            >
              {addingType ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Ajouter
            </button>
          </div>

          {/* List */}
          {missionTypes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aucun type de mission configure</p>
          ) : (
            <div className="divide-y border border-gray-200 rounded-lg">
              {missionTypes.map((mt) => (
                <div key={mt.id} className="flex items-center gap-3 p-3">
                  {editingTypeId === mt.id ? (
                    <>
                      <input
                        type="text"
                        value={editingTypeName}
                        onChange={(e) => setEditingTypeName(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && editingTypeName.trim()) {
                            await fetch(`/api/mission-types/${mt.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ name: editingTypeName.trim() }),
                            });
                            setEditingTypeId(null);
                            fetchMissionTypes();
                          }
                          if (e.key === "Escape") setEditingTypeId(null);
                        }}
                        className="flex-1 px-3 py-1 border border-gray-200 rounded text-sm"
                        autoFocus
                      />
                      <button
                        onClick={async () => {
                          if (editingTypeName.trim()) {
                            await fetch(`/api/mission-types/${mt.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ name: editingTypeName.trim() }),
                            });
                            setEditingTypeId(null);
                            fetchMissionTypes();
                          }
                        }}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingTypeId(null)}
                        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-900">{mt.name}</span>
                      <span className="text-xs text-gray-400">
                        {mt._count.missions} mission{mt._count.missions !== 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={() => {
                          setEditingTypeId(mt.id);
                          setEditingTypeName(mt.name);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        title="Renommer"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={async () => {
                          if (mt._count.missions > 0) {
                            // Desactiver au lieu de supprimer
                            await fetch(`/api/mission-types/${mt.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ isActive: false }),
                            });
                          } else {
                            await fetch(`/api/mission-types/${mt.id}`, { method: "DELETE" });
                          }
                          fetchMissionTypes();
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        title={mt._count.missions > 0 ? "Desactiver" : "Supprimer"}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      )}
    </div>
  );
}
