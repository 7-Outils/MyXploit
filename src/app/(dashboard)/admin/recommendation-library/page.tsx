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
  1: { label: "Urgent", color: "bg-red-100 text-red-700" },
  2: { label: "Court terme", color: "bg-orange-100 text-orange-700" },
  3: { label: "Moyen terme", color: "bg-yellow-100 text-yellow-700" },
  4: { label: "Long terme", color: "bg-green-100 text-green-700" },
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
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-accent mb-2"
          >
            <ArrowLeft size={16} />
            Administration
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Bibliothèque de préconisations
          </h1>
          <p className="text-gray-600 mt-1">
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
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Rechercher une préconisation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <Euro size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700">
            {search ? "Aucun résultat" : "Aucune préconisation configurée"}
          </h3>
          <p className="text-gray-500 mt-2">
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
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                {CATEGORY_LABELS[category] || category}
              </h2>
              <div className="grid gap-3">
                {recs.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-gray-900">
                            {rec.title}
                          </h3>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              PRIORITY_LABELS[rec.priority]?.color || "bg-gray-100"
                            }`}
                          >
                            {PRIORITY_LABELS[rec.priority]?.label || `P${rec.priority}`}
                          </span>
                        </div>
                        {rec.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {rec.description}
                          </p>
                        )}
                        {rec.price && (
                          <p className="text-lg font-bold text-accent mt-2">
                            {rec.price.toLocaleString("fr-FR")} € {rec.priceUnit}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(rec)}
                          className="p-2 text-gray-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(rec.id, rec.title)}
                          disabled={deleting === rec.id}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingId ? "Modifier la préconisation" : "Nouvelle préconisation"}
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
                  Titre *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  placeholder="ex: Mise en place schéma de principe"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Description détaillée de la préconisation"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="750"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unité
                  </label>
                  <select
                    value={form.priceUnit}
                    onChange={(e) => setForm({ ...form, priceUnit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  >
                    <option value="HT">HT</option>
                    <option value="TTC">TTC</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priorité
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([key, { label }]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
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
