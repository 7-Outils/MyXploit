"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { User, Building, Bell, Shield, Loader2, Check, AlertCircle, FolderKanban, Plus, Pencil, Trash2, X, Stamp, Upload } from "lucide-react";
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
import AiKeySection from "@/components/settings/AiKeySection";

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

  // Tampon entreprise (apposé sur les devis acceptés envoyés par email)
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const [stampBusy, setStampBusy] = useState(false);
  const [stampError, setStampError] = useState("");
  const stampInputRef = useRef<HTMLInputElement>(null);
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
    fetch("/api/organization")
      .then((res) => (res.ok ? res.json() : null))
      .then((org) => { if (org) setStampUrl(org.stampUrl || null); })
      .catch(() => {});
  }, [fetchMissionTypes]);

  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStampBusy(true);
    setStampError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "stamps");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setStampError(uploadData.error || "Erreur lors de l'upload");
        return;
      }
      const patchRes = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stampUrl: uploadData.url }),
      });
      if (patchRes.ok) {
        const org = await patchRes.json();
        setStampUrl(org.stampUrl);
      } else {
        const data = await patchRes.json();
        setStampError(data.error || "Erreur lors de l'enregistrement");
      }
    } catch {
      setStampError("Erreur de connexion au serveur");
    } finally {
      setStampBusy(false);
    }
  };

  const handleStampDelete = async () => {
    if (!confirm("Supprimer le tampon entreprise ?")) return;
    setStampBusy(true);
    setStampError("");
    try {
      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stampUrl: null }),
      });
      if (res.ok) setStampUrl(null);
    } catch {
      setStampError("Erreur de connexion au serveur");
    } finally {
      setStampBusy(false);
    }
  };

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
      <div className="border-b border-ink/10 pb-4">
        <h1 className="text-xl font-semibold text-ink">Paramètres</h1>
        <p className="mt-1 text-sm text-ink/50">
          Gérez votre compte et vos préférences
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-4">
          <User size={18} className="mb-3 text-accent" />
          <h3 className="label-tech">Mon profil</h3>
          <p className="mt-1 text-sm text-ink/50">Modifiez vos informations ci-dessous</p>
        </div>

        {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && (
          <Link
            href="/admin/users"
            className="panel block p-4 transition-colors hover:border-accent/40"
          >
            <Building size={18} className="mb-3 text-accent" />
            <h3 className="label-tech">Utilisateurs</h3>
            <p className="mt-1 text-sm text-ink/50">Gérez les membres de votre équipe</p>
          </Link>
        )}

        <div className="panel p-4 opacity-50">
          <Bell size={18} className="mb-3 text-ink/40" />
          <h3 className="label-tech">Notifications</h3>
          <p className="mt-1 text-sm text-ink/50">Bientôt disponible</p>
        </div>

        <div className="panel p-4 opacity-50">
          <Shield size={18} className="mb-3 text-ink/40" />
          <h3 className="label-tech">Sécurité</h3>
          <p className="mt-1 text-sm text-ink/50">Bientôt disponible</p>
        </div>
      </div>

      {/* Profile Section */}
      <ChartCard title="Informations du compte">
        {error && (
          <div className="mb-4 flex items-center gap-2 border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 border border-green-600/20 bg-green-50 p-3 text-sm text-green-700">
            <Check size={16} />
            Modifications enregistrées
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label-tech mb-1 block">
              Prénom
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Votre prénom"
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="label-tech mb-1 block">
              Nom
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Votre nom"
              className="w-full border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="label-tech mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full cursor-not-allowed border border-ink/10 bg-white px-3 py-2 text-sm text-ink/40"
            />
          </div>
          <div>
            <label className="label-tech mb-1 block">
              Rôle
            </label>
            <input
              type="text"
              value={ROLE_LABELS[user?.role as keyof typeof ROLE_LABELS] || user?.role || ""}
              disabled
              className="w-full cursor-not-allowed border border-ink/10 bg-white px-3 py-2 text-sm text-ink/40"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label-tech mb-1 block">
              Organisation
            </label>
            <input
              type="text"
              value={user?.organization?.name || "Aucune organisation"}
              disabled
              className="w-full cursor-not-allowed border border-ink/10 bg-white px-3 py-2 text-sm text-ink/40"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
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
              <FolderKanban size={14} className="text-ink/40" />
              Types de missions
            </span>
          }
        >
          <p className="mb-4 text-sm text-ink/50">
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
              className="flex-1 border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
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
              className="flex items-center gap-1 bg-ink px-4 py-2 text-sm text-paper transition-colors hover:bg-accent disabled:opacity-50"
            >
              {addingType ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Ajouter
            </button>
          </div>

          {/* List */}
          {missionTypes.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink/40">Aucun type de mission configure</p>
          ) : (
            <div className="divide-y divide-ink/10 border border-ink/10">
              {missionTypes.map((mt) => (
                <div key={mt.id} className="flex items-center gap-3 px-4 py-2.5">
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
                        className="flex-1 border border-ink/20 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
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
                        className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-green-50 hover:text-green-700"
                        title="Valider"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingTypeId(null)}
                        className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-ink"
                        title="Annuler"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-ink">{mt.name}</span>
                      <span className="font-mono text-xs tabular-nums text-ink/40">
                        {mt._count.missions} mission{mt._count.missions !== 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={() => {
                          setEditingTypeId(mt.id);
                          setEditingTypeName(mt.name);
                        }}
                        className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
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
                        className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600"
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

      {/* Fournisseur IA - tous sauf lecture seule */}
      {user?.role !== "READER" && <AiKeySection />}

      {/* Tampon entreprise - tous sauf lecture seule */}
      {user?.role !== "READER" && (
        <ChartCard
          title={
            <span className="flex items-center gap-2">
              <Stamp size={14} className="text-ink/40" />
              Tampon entreprise
            </span>
          }
        >
          <p className="mb-4 text-sm text-ink/50">
            Image (PNG ou JPEG) apposée sur les devis acceptés envoyés par email à l&apos;exploitant.
          </p>

          {stampError && (
            <div className="mb-4 flex items-center gap-2 border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} />
              {stampError}
            </div>
          )}

          <div className="flex items-center gap-4">
            {stampUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stampUrl} alt="Tampon entreprise" className="h-24 max-w-48 border border-ink/10 bg-white object-contain p-2" />
            ) : (
              <div className="flex h-24 w-48 items-center justify-center border border-dashed border-ink/20 text-xs text-ink/40">
                Aucun tampon
              </div>
            )}
            <div className="flex items-center gap-1">
              <input ref={stampInputRef} type="file" accept="image/png,image/jpeg" onChange={handleStampUpload} className="hidden" />
              <button
                onClick={() => stampInputRef.current?.click()}
                disabled={stampBusy}
                title={stampUrl ? "Remplacer le tampon" : "Ajouter un tampon"}
                className="flex h-9 w-9 items-center justify-center border border-ink/10 text-ink/60 transition-colors hover:bg-ink/[0.02] disabled:opacity-50"
              >
                {stampBusy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              </button>
              {stampUrl && (
                <button
                  onClick={handleStampDelete}
                  disabled={stampBusy}
                  title="Supprimer le tampon"
                  className="flex h-9 w-9 items-center justify-center border border-ink/10 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        </ChartCard>
      )}
    </div>
  );
}
