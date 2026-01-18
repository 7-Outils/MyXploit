"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChecklistTemplateItem {
  id: string;
  itemKey: string;
  label: string;
  category: string;
  description: string | null;
  conformeText: string;
  nonConformeText: string;
  regulatoryReference: string | null;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
}

interface ChecklistTemplate {
  id: string;
  name: string;
  domain: string;
  equipmentTypes: string[];
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  items: ChecklistTemplateItem[];
}

export default function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    domain: "",
    description: "",
    equipmentTypes: "",
  });

  // Item edit form
  const [itemForm, setItemForm] = useState({
    label: "",
    conformeText: "",
    nonConformeText: "",
    regulatoryReference: "",
  });

  useEffect(() => {
    fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/admin/checklist-templates/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTemplate(data);
        setFormData({
          name: data.name,
          domain: data.domain,
          description: data.description || "",
          equipmentTypes: data.equipmentTypes.join(", "),
        });
        // Expand all categories by default
        const categories = new Set<string>(data.items.map((item: ChecklistTemplateItem) => item.category));
        setExpandedCategories(categories);
      } else {
        router.push("/admin/audit-config/templates");
      }
    } catch (error) {
      console.error("Error fetching template:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/checklist-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          domain: formData.domain,
          description: formData.description || null,
          equipmentTypes: formData.equipmentTypes.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setTemplate((prev) => (prev ? { ...prev, ...updated } : null));
        alert("Template mis à jour");
      } else {
        const data = await response.json();
        alert(data.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleEditItem = (item: ChecklistTemplateItem) => {
    setEditingItem(item.id);
    setItemForm({
      label: item.label,
      conformeText: item.conformeText,
      nonConformeText: item.nonConformeText,
      regulatoryReference: item.regulatoryReference || "",
    });
  };

  const handleSaveItem = async (itemId: string) => {
    try {
      const response = await fetch(
        `/api/admin/checklist-templates/${id}/items/${itemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: itemForm.label,
            conformeText: itemForm.conformeText,
            nonConformeText: itemForm.nonConformeText,
            regulatoryReference: itemForm.regulatoryReference || null,
          }),
        }
      );

      if (response.ok) {
        const updatedItem = await response.json();
        setTemplate((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            items: prev.items.map((item) =>
              item.id === itemId ? { ...item, ...updatedItem } : item
            ),
          };
        });
        setEditingItem(null);
      } else {
        const data = await response.json();
        alert(data.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Error saving item:", error);
      alert("Erreur lors de la sauvegarde");
    }
  };

  const handleDeleteItem = async (itemId: string, label: string) => {
    if (!confirm(`Supprimer l'item "${label}" ?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/checklist-templates/${id}/items/${itemId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setTemplate((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            items: prev.items.filter((item) => item.id !== itemId),
          };
        });
      } else {
        const data = await response.json();
        alert(data.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Erreur lors de la suppression");
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!template) {
    return null;
  }

  // Grouper les items par catégorie
  const itemsByCategory = template.items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistTemplateItem[]>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/audit-config/templates"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-accent mb-2"
          >
            <ArrowLeft size={16} />
            Templates
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
          <p className="text-gray-600 mt-1">
            {template.items.length} items de contrôle
          </p>
        </div>
      </div>

      {/* Template Info */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Informations du template
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domaine
            </label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, domain: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Types d&apos;équipements (séparés par des virgules)
            </label>
            <input
              type="text"
              value={formData.equipmentTypes}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  equipmentTypes: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSaveTemplate} disabled={saving}>
            {saving ? (
              <Loader2 size={18} className="mr-2 animate-spin" />
            ) : (
              <Save size={18} className="mr-2" />
            )}
            Enregistrer
          </Button>
        </div>
      </div>

      {/* Items par catégorie */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Items de contrôle
          </h2>
        </div>

        {Object.entries(itemsByCategory).map(([category, items]) => (
          <div
            key={category}
            className="bg-white rounded-xl border border-gray-100 overflow-hidden"
          >
            <button
              onClick={() => toggleCategory(category)}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="font-medium text-gray-900">
                {category} ({items.length})
              </span>
              {expandedCategories.has(category) ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </button>

            {expandedCategories.has(category) && (
              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <div key={item.id} className="p-4">
                    {editingItem === item.id ? (
                      // Edit mode
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Label
                          </label>
                          <input
                            type="text"
                            value={itemForm.label}
                            onChange={(e) =>
                              setItemForm((prev) => ({
                                ...prev,
                                label: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Texte si CONFORME (pour le rapport)
                          </label>
                          <textarea
                            value={itemForm.conformeText}
                            onChange={(e) =>
                              setItemForm((prev) => ({
                                ...prev,
                                conformeText: e.target.value,
                              }))
                            }
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Texte si NON CONFORME (pour le rapport)
                          </label>
                          <textarea
                            value={itemForm.nonConformeText}
                            onChange={(e) =>
                              setItemForm((prev) => ({
                                ...prev,
                                nonConformeText: e.target.value,
                              }))
                            }
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Référence réglementaire (optionnel)
                          </label>
                          <input
                            type="text"
                            value={itemForm.regulatoryReference}
                            onChange={(e) =>
                              setItemForm((prev) => ({
                                ...prev,
                                regulatoryReference: e.target.value,
                              }))
                            }
                            placeholder="Ex: Article R.224-41-4 du Code de l'environnement"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingItem(null)}
                          >
                            Annuler
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveItem(item.id)}
                          >
                            Enregistrer
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <GripVertical
                            size={16}
                            className="text-gray-300 mt-1 cursor-move"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {item.label}
                            </p>
                            <div className="mt-2 grid gap-2 text-sm">
                              <div className="flex items-start gap-2">
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                  OK
                                </span>
                                <span className="text-gray-600">
                                  {item.conformeText}
                                </span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                                  NOK
                                </span>
                                <span className="text-gray-600">
                                  {item.nonConformeText}
                                </span>
                              </div>
                              {item.regulatoryReference && (
                                <div className="flex items-start gap-2">
                                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                    Réf
                                  </span>
                                  <span className="text-gray-500 italic">
                                    {item.regulatoryReference}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditItem(item)}
                            className="p-1.5 text-gray-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.label)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
