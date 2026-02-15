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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organisations</h1>
          <p className="text-gray-600 mt-1">
            Gerer les organisations de la plateforme
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={seedAllModules}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {seeding ? <Loader2 size={18} className="animate-spin" /> : <Package size={18} />}
            {seeding ? "Activation..." : "Activer tous modules"}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Plus size={18} />
            Nouvelle organisation
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
          className="flex-1 max-w-md px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Building2 size={16} /> {organizations.length} organisations
          </span>
          <span className="flex items-center gap-1">
            <Users size={16} /> {organizations.reduce((a, o) => a + (o._count?.users || 0), 0)} utilisateurs
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={16} /> {organizations.reduce((a, o) => a + (o._count?.sites || 0), 0)} sites
          </span>
        </div>
      </div>

      {/* Organizations List */}
      <div className="space-y-4">
        {filteredOrgs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
            {search ? "Aucune organisation trouvee" : "Aucune organisation"}
          </div>
        ) : (
          filteredOrgs.map((org) => {
            const isExpanded = expandedOrgs.has(org.id);
            const enabledModulesCount = org.modules?.filter((m) => m.isEnabled).length || 0;

            return (
              <div key={org.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {editingId === org.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent flex-1 max-w-md"
                            autoFocus
                          />
                          <button onClick={() => handleUpdateOrg(org.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                            <Check size={18} />
                          </button>
                          <button onClick={() => { setEditingId(null); setEditName(""); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <Building2 size={20} className="text-accent" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">{org.name}</h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                              <span className="flex items-center gap-1"><Users size={14} /> {org._count?.users || 0} users</span>
                              <span className="flex items-center gap-1"><MapPin size={14} /> {org._count?.sites || 0} sites</span>
                              <span className="flex items-center gap-1"><FileText size={14} /> {org._count?.contracts || 0} contrats</span>
                              <span className="flex items-center gap-1"><Package size={14} /> {enabledModulesCount}/{Object.keys(MODULE_LABELS).length} modules</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingId !== org.id && (
                        <>
                          <button
                            onClick={() => handleGhost(org.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                            title="Consulter en mode fantome"
                          >
                            <Ghost size={16} />
                            Ghost
                          </button>
                          <button onClick={() => toggleOrgExpansion(org.id)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title={isExpanded ? "Reduire" : "Gerer les modules"}>
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                          <button onClick={() => { setEditingId(org.id); setEditName(org.name); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Renommer">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => handleDeleteOrg(org.id, org.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Supprimer">
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modules Section */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Gestion des modules</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(MODULE_LABELS).map(([moduleKey, label]) => {
                        const module = moduleKey as Module;
                        const moduleData = org.modules?.find((m) => m.module === module);
                        const isEnabled = moduleData?.isEnabled ?? false;

                        return (
                          <label
                            key={module}
                            className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              isEnabled ? "border-accent bg-white" : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <span className="text-sm font-medium text-gray-900">{label}</span>
                            <button
                              type="button"
                              onClick={() => toggleModule(org.id, module, isEnabled)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                isEnabled ? "bg-accent" : "bg-gray-300"
                              }`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                isEnabled ? "translate-x-6" : "translate-x-1"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Nouvelle organisation</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateOrg} className="p-4 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l&apos;organisation *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="Ex: Ville de Lyon"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2">
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
