"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
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
} from "lucide-react";
import { Module } from "@/generated/prisma/client";

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count?: {
    users: number;
    sites: number;
  };
  modules?: Array<{
    module: Module;
    isEnabled: boolean;
  }>;
}

const MODULE_LABELS: Record<Module, string> = {
  ENERGY: "Suivi énergétique",
  FINANCIER: "Suivi financier",
  ADMINISTRATIF: "Suivi administratif",
  EXPLOITATION: "Suivi exploitation",
  OUTILS: "Boîte à outils",
  CONTRACTS: "Gestion contrats",
  PRICING: "Tarification",
};

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    name: "",
  });

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

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la creation");
      }

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
      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "DELETE",
      });

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
        setOrganizations(organizations.map((o) =>
          o.id === orgId ? { ...o, name: editName } : o
        ));
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
        body: JSON.stringify({
          module,
          isEnabled: !currentState,
        }),
      });

      if (response.ok) {
        // Refresh organizations
        await fetchData();
      }
    } catch (error) {
      console.error("Error toggling module:", error);
      alert("Erreur lors de la modification du module");
    }
  };

  const toggleOrgExpansion = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orgId)) {
        newSet.delete(orgId);
      } else {
        newSet.add(orgId);
      }
      return newSet;
    });
  };

  const seedAllModules = async () => {
    if (!confirm("Activer tous les modules (7) pour toutes les organisations ?")) {
      return;
    }

    setSeeding(true);
    try {
      const response = await fetch("/api/admin/seed-modules", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✓ Succès! ${data.message}`);
        await fetchData(); // Refresh
      } else {
        const data = await response.json();
        alert(`✗ Erreur: ${data.error || "Une erreur est survenue"}`);
      }
    } catch (error) {
      console.error("Error seeding modules:", error);
      alert("✗ Erreur lors de l'activation des modules");
    } finally {
      setSeeding(false);
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
              Gestion des organisations
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Creer et gerer les organisations (clients)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={seedAllModules}
            disabled={seeding}
            className="flex items-center gap-2 border border-ink/20 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {seeding ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Package size={20} />
            )}
            {seeding ? "Activation..." : "Activer tous les modules"}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent"
          >
            <Plus size={20} />
            Nouvelle organisation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
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
            <Users size={16} className="flex-shrink-0 text-ink/30" />
            <div>
              <p className="font-mono text-xl font-medium tabular-nums text-ink">
                {organizations.reduce((acc, o) => acc + (o._count?.users || 0), 0)}
              </p>
              <p className="text-sm text-text-secondary">Utilisateurs total</p>
            </div>
          </div>
        </div>
        <div className="border border-ink/10 bg-white p-4">
          <div className="flex items-center gap-3">
            <MapPin size={16} className="flex-shrink-0 text-ink/30" />
            <div>
              <p className="font-mono text-xl font-medium tabular-nums text-ink">
                {organizations.reduce((acc, o) => acc + (o._count?.sites || 0), 0)}
              </p>
              <p className="text-sm text-text-secondary">Sites total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Organizations Cards */}
      <div className="space-y-4">
        {organizations.length === 0 ? (
          <div className="border border-ink/10 bg-white p-8 text-center text-ink/50">
            Aucune organisation
          </div>
        ) : (
          organizations.map((org) => {
            const isExpanded = expandedOrgs.has(org.id);
            const enabledModulesCount = org.modules?.filter((m) => m.isEnabled).length || 0;

            return (
              <div key={org.id} className="border border-ink/10 bg-white">
                {/* Organization Header */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {editingId === org.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none flex-1 max-w-md"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateOrg(org.id)}
                            className="p-2 text-green-600 hover:bg-green-50 transition-colors"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditName(""); }}
                            className="p-2 text-ink/40 hover:bg-ink/[0.02] transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="w-10 h-10 bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <Building2 size={20} className="text-accent" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-ink">{org.name}</h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                              <span className="flex items-center gap-1">
                                <Users size={14} />
                                {org._count?.users || 0} users
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin size={14} />
                                {org._count?.sites || 0} sites
                              </span>
                              <span className="flex items-center gap-1">
                                <Package size={14} />
                                {enabledModulesCount}/{Object.keys(MODULE_LABELS).length} modules
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingId !== org.id && (
                        <>
                          <button
                            onClick={() => toggleOrgExpansion(org.id)}
                            className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
                            title={isExpanded ? "Réduire" : "Gérer les modules"}
                          >
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                          <button
                            onClick={() => { setEditingId(org.id); setEditName(org.name); }}
                            className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
                            title="Renommer"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteOrg(org.id, org.name)}
                            className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modules Section (Expandable) */}
                {isExpanded && (
                  <div className="border-t border-ink/10 bg-ink/[0.015] p-4">
                    <p className="text-sm font-semibold text-ink mb-3">Gestion des modules</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(MODULE_LABELS).map(([moduleKey, label]) => {
                        const module = moduleKey as Module;
                        const moduleData = org.modules?.find((m) => m.module === module);
                        const isEnabled = moduleData?.isEnabled ?? false;

                        return (
                          <label
                            key={module}
                            className={`flex items-center justify-between p-3 border-2 cursor-pointer transition-all ${
                              isEnabled
                                ? "border-accent bg-white"
                                : "border-ink/10 bg-white hover:border-ink/10"
                            }`}
                          >
                            <span className="text-sm font-medium text-ink">{label}</span>
                            <button
                              type="button"
                              onClick={() => toggleModule(org.id, module, isEnabled)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                isEnabled ? "bg-accent" : "bg-ink/20"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  isEnabled ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
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
              <button
                onClick={() => setShowModal(false)}
                className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="p-4 space-y-4">
              {error && (
                <div className="border border-red-600/20 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="label-tech mb-2 block">
                  Nom de l&apos;organisation *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  placeholder="Ex: Ville de Lyon"
                />
              </div>

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
