"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  Building2,
  Trash2,
  X,
  Users,
  MapPin,
  Edit2,
  Check,
  ChevronDown,
  ChevronUp,
  Package,
  Ghost,
  FileText,
} from "lucide-react";
import { Module } from "@/generated/prisma/client";
import { MODULE_LABELS } from "@/lib/permissions";
import { useGhostMode } from "@/contexts/PermissionContext";

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count?: {
    users: number;
    sites: number;
    contracts: number;
  };
  modules?: Array<{
    module: Module;
    isEnabled: boolean;
  }>;
}

export default function PlatformOrganizationsPage() {
  const router = useRouter();
  const { enterGhostMode } = useGhostMode();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const [formData, setFormData] = useState({ name: "" });

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/organizations");
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);
      }
    } catch (err) {
      console.error("Error fetching organizations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de la creation");

      await fetchData();
      setShowModal(false);
      setFormData({ name: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Supprimer l'organisation "${orgName}" ? Tous les utilisateurs et sites associes seront supprimes.`)) return;

    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`, { method: "DELETE" });
      if (response.ok) {
        setOrganizations(organizations.filter((o) => o.id !== orgId));
      } else {
        const data = await response.json();
        alert(data.error || "Erreur lors de la suppression");
      }
    } catch {
      alert("Erreur lors de la suppression");
    }
  };

  const handleUpdateOrg = async (orgId: string) => {
    if (!editName.trim()) return;

    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });

      if (response.ok) {
        setOrganizations(organizations.map((o) => o.id === orgId ? { ...o, name: editName } : o));
        setEditingId(null);
        setEditName("");
      } else {
        const data = await response.json();
        alert(data.error || "Erreur lors de la modification");
      }
    } catch {
      alert("Erreur lors de la modification");
    }
  };

  const toggleModule = async (orgId: string, module: Module, currentState: boolean) => {
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}/modules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, isEnabled: !currentState }),
      });
      if (response.ok) await fetchData();
    } catch (error) {
      console.error("Error toggling module:", error);
      alert("Erreur lors de la modification du module");
    }
  };

  const toggleOrgExpansion = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orgId)) newSet.delete(orgId);
      else newSet.add(orgId);
      return newSet;
    });
  };

  const seedAllModules = async () => {
    if (!confirm("Activer tous les modules (7) pour toutes les organisations ?")) return;
    setSeeding(true);
    try {
      const response = await fetch("/api/admin/seed-modules", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        alert(`Succes! ${data.message}`);
        await fetchData();
      } else {
        const data = await response.json();
        alert(`Erreur: ${data.error || "Une erreur est survenue"}`);
      }
    } catch {
      alert("Erreur lors de l'activation des modules");
    } finally {
      setSeeding(false);
    }
  };

  const handleGhost = async (orgId: string) => {
    await enterGhostMode(orgId);
    router.push("/overview");
  };

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(search.toLowerCase())
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Organisations</h1>
          <p className="text-sm text-text-secondary mt-1">
            Gerer les organisations de la plateforme
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={seedAllModules}
            disabled={seeding}
            title={seeding ? "Activation…" : "Activer tous les modules"}
            className="flex h-9 w-9 items-center justify-center border border-ink/20 text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {seeding ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
          </button>
          <button
            onClick={() => setShowModal(true)}
            title="Nouvelle organisation"
            className="flex h-9 w-9 items-center justify-center bg-ink text-paper transition-colors hover:bg-accent"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Search + Stats */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Rechercher une organisation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-md border border-ink/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-accent focus:outline-none"
        />
        <div className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-widest tabular-nums text-ink/50">
          <span className="flex items-center gap-1.5">
            <Building2 size={12} /> {organizations.length} organisations
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={12} /> {organizations.reduce((a, o) => a + (o._count?.users || 0), 0)} utilisateurs
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={12} /> {organizations.reduce((a, o) => a + (o._count?.sites || 0), 0)} sites
          </span>
        </div>
      </div>

      {/* Organizations List */}
      <div className="space-y-3">
        {filteredOrgs.length === 0 ? (
          <div className="border border-ink/10 bg-white p-8 text-center text-sm text-text-secondary">
            {search ? "Aucune organisation trouvee" : "Aucune organisation"}
          </div>
        ) : (
          filteredOrgs.map((org) => {
            const isExpanded = expandedOrgs.has(org.id);
            const enabledModulesCount = org.modules?.filter((m) => m.isEnabled).length || 0;

            return (
              <div key={org.id} className="border border-ink/10 bg-white">
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {editingId === org.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 max-w-md border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                            autoFocus
                          />
                          <button onClick={() => handleUpdateOrg(org.id)} title="Valider" className="flex h-9 w-9 items-center justify-center text-green-600 transition-colors hover:bg-green-50">
                            <Check size={16} />
                          </button>
                          <button onClick={() => { setEditingId(null); setEditName(""); }} title="Annuler" className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-ink">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Building2 size={16} className="flex-shrink-0 text-ink/30" />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-ink truncate">{org.name}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-4 font-mono text-[11px] tabular-nums text-ink/40">
                              <span className="flex items-center gap-1.5"><Users size={12} /> {org._count?.users || 0} users</span>
                              <span className="flex items-center gap-1.5"><MapPin size={12} /> {org._count?.sites || 0} sites</span>
                              <span className="flex items-center gap-1.5"><FileText size={12} /> {org._count?.contracts || 0} contrats</span>
                              <span className="flex items-center gap-1.5"><Package size={12} /> {enabledModulesCount}/{Object.keys(MODULE_LABELS).length} modules</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {editingId !== org.id && (
                        <>
                          <button
                            onClick={() => handleGhost(org.id)}
                            className="flex h-9 w-9 items-center justify-center text-amber-600 transition-colors hover:bg-amber-50"
                            title="Consulter en mode fantome"
                          >
                            <Ghost size={16} />
                          </button>
                          <button onClick={() => toggleOrgExpansion(org.id)} className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent" title={isExpanded ? "Reduire" : "Gerer les modules"}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <button onClick={() => { setEditingId(org.id); setEditName(org.name); }} className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent" title="Renommer">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteOrg(org.id, org.name)} className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600" title="Supprimer">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modules Section */}
                {isExpanded && (
                  <div className="border-t border-ink/10 bg-ink/[0.015] p-4">
                    <p className="label-tech mb-3">Gestion des modules</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {Object.entries(MODULE_LABELS).map(([moduleKey, label]) => {
                        const module = moduleKey as Module;
                        const moduleData = org.modules?.find((m) => m.module === module);
                        const isEnabled = moduleData?.isEnabled ?? false;

                        return (
                          <label
                            key={module}
                            className={`flex cursor-pointer items-center justify-between gap-3 border bg-white px-3 py-2 transition-colors ${
                              isEnabled ? "border-accent" : "border-ink/15 hover:border-accent/40"
                            }`}
                          >
                            <span className={`text-sm ${isEnabled ? "font-medium text-ink" : "text-ink/60"}`}>{label}</span>
                            <button
                              type="button"
                              onClick={() => toggleModule(org.id, module, isEnabled)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center transition-colors ${
                                isEnabled ? "bg-accent" : "bg-ink/20"
                              }`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform bg-white transition-transform ${
                                isEnabled ? "translate-x-[1.125rem]" : "translate-x-[0.1875rem]"
                              }`} />
                            </button>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal creation */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4 border border-ink/15 bg-white shadow-large">
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
              <h2 className="label-tech">Nouvelle organisation</h2>
              <button onClick={() => setShowModal(false)} title="Fermer" className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateOrg} className="p-4 space-y-4">
              {error && <div className="border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <div>
                <label className="label-tech mb-2 block">Nom de l&apos;organisation *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-accent focus:outline-none"
                  placeholder="Ex: Ville de Lyon"
                />
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
    </div>
  );
}
