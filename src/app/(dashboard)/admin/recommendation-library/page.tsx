"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Euro,
  Pencil,
  Trash2,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Recommendation {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  priceUnit: string;
  category: string | null;
  priority: number;
  isActive: boolean;
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Urgent", color: "border border-red-600/20 bg-red-50 text-red-700" },
  2: { label: "Court terme", color: "border border-amber-600/20 bg-amber-50 text-amber-700" },
  3: { label: "Moyen terme", color: "border border-ink/15 bg-white text-ink/60" },
  4: { label: "Long terme", color: "border border-ink/10 bg-white text-ink/40" },
};

const CATEGORY_LABELS: Record<string, string> = {
  DOCUMENTATION: "Documentation",
  COMBUSTION: "Combustion",
  SECURITE: "Sécurité",
  CONFORMITE: "Conformité",
  MAINTENANCE: "Maintenance",
  AUTRE: "Autre",
};

export default function RecommendationLibraryPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    priceUnit: "HT",
    category: "",
    priority: 3,
  });

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const response = await fetch("/api/admin/recommendation-library");
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Supprimer la préconisation "${title}" ?`)) {
      return;
    }

    setDeleting(id);
    try {
      const response = await fetch(`/api/admin/recommendation-library/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setRecommendations((prev) => prev.filter((r) => r.id !== id));
      } else {
        const data = await response.json();
        alert(data.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Error deleting recommendation:", error);
      alert("Erreur lors de la suppression");
    } finally {
      setDeleting(null);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      title: "",
      description: "",
      price: "",
      priceUnit: "HT",
      category: "",
      priority: 3,
    });
    setShowModal(true);
  };

  const openEditModal = (rec: Recommendation) => {
    setEditingId(rec.id);
    setForm({
      title: rec.title,
      description: rec.description || "",
      price: rec.price?.toString() || "",
      priceUnit: rec.priceUnit,
      category: rec.category || "",
      priority: rec.priority,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        price: form.price ? parseFloat(form.price) : null,
        priceUnit: form.priceUnit,
        category: form.category || null,
        priority: form.priority,
      };

      const url = editingId
        ? `/api/admin/recommendation-library/${editingId}`
        : "/api/admin/recommendation-library";

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const saved = await response.json();
        if (editingId) {
          setRecommendations((prev) =>
            prev.map((r) => (r.id === editingId ? saved : r))
          );
        } else {
          setRecommendations((prev) => [...prev, saved]);
        }
        setShowModal(false);
      } else {
        const data = await response.json();
        alert(data.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Error saving recommendation:", error);
      alert("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // Filter recommendations
  const filtered = recommendations.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  // Group by category
  const groupedByCategory = filtered.reduce((acc, rec) => {
    const category = rec.category || "AUTRE";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(rec);
    return acc;
  }, {} as Record<string, Recommendation[]>);

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
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent mb-2"
          >
            <ArrowLeft size={16} />
            Administration
          </Link>
          <h1 className="text-xl font-semibold text-ink">
            Bibliothèque de préconisations
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {recommendations.length} préconisations configurées
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus size={18} className="mr-2" />
          Nouvelle préconisation
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
        />
        <input
          type="text"
          placeholder="Rechercher une préconisation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-ink/20 bg-white py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink/30 focus:border-accent focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="border border-ink/10 bg-white p-8 text-center">
          <Euro size={48} className="mx-auto text-ink/20 mb-4" />
          <h3 className="text-sm font-medium text-ink">
            {search ? "Aucun résultat" : "Aucune préconisation configurée"}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {search
              ? "Essayez une autre recherche"
              : "Créez vos premières préconisations avec leurs tarifs."}
          </p>
          {!search && (
            <Button onClick={openCreateModal} className="mt-4">
              <Plus size={18} className="mr-2" />
              Créer une préconisation
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByCategory).map(([category, recs]) => (
            <div key={category}>
              <h2 className="label-tech mb-3">
                {CATEGORY_LABELS[category] || category}
              </h2>
              <div className="grid gap-3">
                {recs.map((rec) => (
                  <div
                    key={rec.id}
                    className="border border-ink/10 bg-white p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-sm font-medium text-ink">
                            {rec.title}
                          </h3>
                          <span
                            className={`px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${
                              PRIORITY_LABELS[rec.priority]?.color || "border border-ink/15 text-ink/50"
                            }`}
                          >
                            {PRIORITY_LABELS[rec.priority]?.label || `P${rec.priority}`}
                          </span>
                        </div>
                        {rec.description && (
                          <p className="text-sm text-text-secondary mt-1">
                            {rec.description}
                          </p>
                        )}
                        {rec.price && (
                          <p className="mt-2 font-mono text-sm font-medium tabular-nums text-accent">
                            {rec.price.toLocaleString("fr-FR")} € {rec.priceUnit}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(rec)}
                          className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-ink/[0.03] hover:text-accent"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(rec.id, rec.title)}
                          disabled={deleting === rec.id}
                          className="flex h-9 w-9 items-center justify-center text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          {deleting === rec.id ? (
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
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
              <h2 className="label-tech">
                {editingId ? "Modifier la préconisation" : "Nouvelle préconisation"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-ink/[0.02]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="label-tech mb-2 block">
                  Titre *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  placeholder="ex: Mise en place schéma de principe"
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="label-tech mb-2 block">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Description détaillée de la préconisation"
                  className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech mb-2 block">
                    Prix
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="750"
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-tech mb-2 block">
                    Unité
                  </label>
                  <select
                    value={form.priceUnit}
                    onChange={(e) => setForm({ ...form, priceUnit: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="HT">HT</option>
                    <option value="TTC">TTC</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-tech mb-2 block">
                    Catégorie
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="">Sélectionner...</option>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-tech mb-2 block">
                    Priorité
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: parseInt(e.target.value) })
                    }
                    className="w-full border border-ink/20 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([key, { label }]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-ink/10">
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
