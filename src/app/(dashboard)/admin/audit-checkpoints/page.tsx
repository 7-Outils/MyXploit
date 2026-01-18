"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  ClipboardCheck,
  Pencil,
  Trash2,
  Loader2,
  Search,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Finding {
  id: string;
  label: string;
  isConform: boolean;
  recommendationId: string | null;
  reportText?: string;
}

interface CheckPoint {
  id: string;
  label: string;
  category: string;
  description: string | null;
  responseType: string;
  findings: Finding[];
  regulatoryRef: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface Recommendation {
  id: string;
  title: string;
  price: number | null;
  priceUnit: string;
}

export default function AuditCheckpointsPage() {
  const [checkpoints, setCheckpoints] = useState<CheckPoint[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newCategory, setNewCategory] = useState("");
  const [showCategoryInput, setShowCategoryInput] = useState(false);

  // Form state
  const [form, setForm] = useState({
    label: "",
    category: "",
    description: "",
    regulatoryRef: "",
    findings: [] as Finding[],
  });

  // Get unique categories from existing checkpoints
  const existingCategories = useMemo(() => {
    const cats = new Set(checkpoints.map((cp) => cp.category));
    return Array.from(cats).sort();
  }, [checkpoints]);

  useEffect(() => {
    fetchData();
  }, []);

  // Expand all categories when checkpoints are loaded
  useEffect(() => {
    if (checkpoints.length > 0) {
      setExpandedCategories(new Set(existingCategories));
    }
  }, [existingCategories, checkpoints.length]);

  const fetchData = async () => {
    try {
      const [checkpointsRes, recoRes] = await Promise.all([
        fetch("/api/admin/audit-checkpoints"),
        fetch("/api/admin/recommendation-library"),
      ]);

      if (checkpointsRes.ok) {
        const data = await checkpointsRes.json();
        setCheckpoints(data);
      }
      if (recoRes.ok) {
        const data = await recoRes.json();
        setRecommendations(data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Supprimer le point de contrôle "${label}" ?`)) {
      return;
    }

    setDeleting(id);
    try {
      const response = await fetch(`/api/admin/audit-checkpoints/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setCheckpoints((prev) => prev.filter((c) => c.id !== id));
      } else {
        const data = await response.json();
        alert(data.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Error deleting checkpoint:", error);
      alert("Erreur lors de la suppression");
    } finally {
      setDeleting(null);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      label: "",
      category: existingCategories[0] || "",
      description: "",
      regulatoryRef: "",
      findings: [],
    });
    setShowCategoryInput(false);
    setNewCategory("");
    setShowModal(true);
  };

  const openEditModal = (cp: CheckPoint) => {
    setEditingId(cp.id);
    setForm({
      label: cp.label,
      category: cp.category,
      description: cp.description || "",
      regulatoryRef: cp.regulatoryRef || "",
      findings: cp.findings || [],
    });
    setShowCategoryInput(false);
    setNewCategory("");
    setShowModal(true);
  };

  const addFinding = () => {
    setForm({
      ...form,
      findings: [
        ...form.findings,
        {
          id: crypto.randomUUID(),
          label: "",
          isConform: false,
          recommendationId: null,
          reportText: "",
        },
      ],
    });
  };

  const updateFinding = (index: number, updates: Partial<Finding>) => {
    const newFindings = [...form.findings];
    newFindings[index] = { ...newFindings[index], ...updates };
    setForm({ ...form, findings: newFindings });
  };

  const removeFinding = (index: number) => {
    const newFindings = form.findings.filter((_, i) => i !== index);
    setForm({ ...form, findings: newFindings });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Use new category if creating one
    const finalCategory = showCategoryInput && newCategory.trim()
      ? newCategory.trim()
      : form.category;

    if (!finalCategory) {
      alert("Veuillez sélectionner ou créer une catégorie");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        label: form.label,
        category: finalCategory,
        description: form.description || null,
        responseType: "MULTI_CHOICE", // Always MULTI_CHOICE now
        regulatoryRef: form.regulatoryRef || null,
        findings: form.findings,
        valueFields: null,
      };

      const url = editingId
        ? `/api/admin/audit-checkpoints/${editingId}`
        : "/api/admin/audit-checkpoints";

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const saved = await response.json();
        if (editingId) {
          setCheckpoints((prev) =>
            prev.map((c) => (c.id === editingId ? saved : c))
          );
        } else {
          setCheckpoints((prev) => [...prev, saved]);
        }
        setShowModal(false);
      } else {
        const data = await response.json();
        alert(data.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Error saving checkpoint:", error);
      alert("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (category: string) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setExpandedCategories(newSet);
  };

  // Filter checkpoints
  const filtered = checkpoints.filter(
    (c) =>
      c.label.toLowerCase().includes(search.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  // Group by category
  const groupedByCategory = filtered.reduce((acc, cp) => {
    if (!acc[cp.category]) {
      acc[cp.category] = [];
    }
    acc[cp.category].push(cp);
    return acc;
  }, {} as Record<string, CheckPoint[]>);

  // Sort categories
  const sortedCategories = Object.keys(groupedByCategory).sort();

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-accent mb-2"
          >
            <ArrowLeft size={16} />
            Administration
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Points de contrôle
          </h1>
          <p className="text-gray-600 mt-1">
            {checkpoints.length} points configurés
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus size={18} className="mr-2" />
          Nouveau point
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Rechercher un point de contrôle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <ClipboardCheck size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700">
            {search ? "Aucun résultat" : "Aucun point de contrôle configuré"}
          </h3>
          <p className="text-gray-500 mt-2">
            {search
              ? "Essayez une autre recherche"
              : "Créez vos premiers points de contrôle pour les audits."}
          </p>
          {!search && (
            <Button onClick={openCreateModal} className="mt-4">
              <Plus size={18} className="mr-2" />
              Créer un point
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedCategories.map((category) => {
            const categoryCheckpoints = groupedByCategory[category] || [];
            if (categoryCheckpoints.length === 0) return null;

            const isExpanded = expandedCategories.has(category);

            return (
              <div key={category} className="bg-white rounded-xl border border-gray-100">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <h2 className="text-lg font-semibold text-gray-800">
                    {category} ({categoryCheckpoints.length})
                  </h2>
                  {isExpanded ? (
                    <ChevronDown size={20} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={20} className="text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t divide-y">
                    {categoryCheckpoints.map((cp) => (
                      <div
                        key={cp.id}
                        className="p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">
                              {cp.label}
                            </h3>
                            {cp.description && (
                              <p className="text-sm text-gray-500 mt-1">
                                {cp.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {cp.findings.length > 0 && (
                                <span className="px-2 py-0.5 text-xs bg-accent/10 text-accent rounded">
                                  {cp.findings.length} constats
                                </span>
                              )}
                              {cp.regulatoryRef && (
                                <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded">
                                  {cp.regulatoryRef}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(cp)}
                              className="p-2 text-gray-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(cp.id, cp.label)}
                              disabled={deleting === cp.id}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {deleting === cp.id ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Trash2 size={18} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">
                {editingId ? "Modifier le point de contrôle" : "Nouveau point de contrôle"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Libellé *
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                  placeholder="ex: Schéma de principe"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              {/* Category selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie *
                </label>
                {!showCategoryInput ? (
                  <div className="space-y-2">
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    >
                      <option value="">Sélectionner une catégorie</option>
                      {existingCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCategoryInput(true)}
                      className="text-sm text-accent hover:underline"
                    >
                      + Créer une nouvelle catégorie
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Nom de la nouvelle catégorie"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryInput(false);
                        setNewCategory("");
                      }}
                      className="text-sm text-gray-500 hover:underline"
                    >
                      ← Utiliser une catégorie existante
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Description optionnelle"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Référence réglementaire
                </label>
                <input
                  type="text"
                  value={form.regulatoryRef}
                  onChange={(e) => setForm({ ...form, regulatoryRef: e.target.value })}
                  placeholder="ex: Article R.224-41-4"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              {/* Findings section */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    Constats possibles
                  </label>
                  <Button type="button" variant="outline" size="sm" onClick={addFinding}>
                    <Plus size={14} className="mr-1" />
                    Ajouter
                  </Button>
                </div>

                {form.findings.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Ajoutez les différents constats possibles pour ce point
                  </p>
                ) : (
                  <div className="space-y-3">
                    {form.findings.map((finding, index) => (
                      <div
                        key={finding.id}
                        className={`border rounded-lg p-3 ${finding.isConform ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            {/* Label du constat */}
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={finding.label}
                                onChange={(e) =>
                                  updateFinding(index, { label: e.target.value })
                                }
                                placeholder="ex: Absent"
                                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white"
                              />
                              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={finding.isConform}
                                  onChange={(e) =>
                                    updateFinding(index, { isConform: e.target.checked })
                                  }
                                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                Conforme
                              </label>
                            </div>

                            {/* Texte du rapport */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Texte du rapport
                              </label>
                              <textarea
                                value={finding.reportText || ""}
                                onChange={(e) =>
                                  updateFinding(index, { reportText: e.target.value })
                                }
                                placeholder={finding.isConform
                                  ? "ex: Le schéma de principe est présent et correctement affiché."
                                  : "ex: Absence de schéma de principe. (Art. R.224-41-4)"
                                }
                                rows={2}
                                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white"
                              />
                            </div>

                            {/* Préconisation liée (si non conforme) */}
                            {!finding.isConform && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Préconisation associée
                                </label>
                                <select
                                  value={finding.recommendationId || ""}
                                  onChange={(e) =>
                                    updateFinding(index, {
                                      recommendationId: e.target.value || null,
                                    })
                                  }
                                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white"
                                >
                                  <option value="">Aucune préconisation</option>
                                  {recommendations.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.title} {r.price ? `(${r.price}€ ${r.priceUnit})` : ""}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFinding(index)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
                  {editingId ? "Enregistrer" : "Créer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
