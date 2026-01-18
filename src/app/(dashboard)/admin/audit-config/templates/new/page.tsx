"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const DOMAIN_OPTIONS = [
  { value: "DOCUMENTATION", label: "Documentation et Conformité" },
  { value: "CHAUFFAGE", label: "Chauffage" },
  { value: "ECS", label: "Eau Chaude Sanitaire" },
  { value: "VENTILATION", label: "Ventilation" },
  { value: "CLIMATISATION", label: "Climatisation" },
  { value: "PLOMBERIE", label: "Plomberie" },
  { value: "TRAITEMENT_EAU", label: "Traitement d'eau" },
  { value: "CFO_CFA", label: "Électricité (CFO/CFA)" },
  { value: "COMPTAGE", label: "Comptage" },
  { value: "PISCINE", label: "Piscine" },
  { value: "AUTRE", label: "Autre" },
];

interface ItemForm {
  itemKey: string;
  label: string;
  category: string;
  conformeText: string;
  nonConformeText: string;
  regulatoryReference: string;
}

export default function NewTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [addingItem, setAddingItem] = useState(false);

  // Template form
  const [formData, setFormData] = useState({
    name: "",
    domain: "CHAUFFAGE",
    description: "",
    equipmentTypes: "",
  });

  // Items to create
  const [items, setItems] = useState<ItemForm[]>([]);

  // New item form
  const [newItem, setNewItem] = useState<ItemForm>({
    itemKey: "",
    label: "",
    category: "",
    conformeText: "",
    nonConformeText: "",
    regulatoryReference: "",
  });

  const handleAddItem = () => {
    if (!newItem.label || !newItem.category || !newItem.conformeText || !newItem.nonConformeText) {
      alert("Veuillez remplir tous les champs obligatoires de l'item");
      return;
    }

    // Generate itemKey from label if not provided
    const itemKey = newItem.itemKey || newItem.label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    setItems((prev) => [...prev, { ...newItem, itemKey }]);
    setNewItem({
      itemKey: "",
      label: "",
      category: "",
      conformeText: "",
      nonConformeText: "",
      regulatoryReference: "",
    });
    setAddingItem(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.domain || !formData.equipmentTypes) {
      alert("Veuillez remplir le nom, le domaine et les types d'équipements");
      return;
    }

    if (items.length === 0) {
      alert("Veuillez ajouter au moins un item de contrôle");
      return;
    }

    setSaving(true);
    try {
      // 1. Create the template
      const templateResponse = await fetch("/api/admin/checklist-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          domain: formData.domain,
          description: formData.description || null,
          equipmentTypes: formData.equipmentTypes.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });

      if (!templateResponse.ok) {
        const data = await templateResponse.json();
        throw new Error(data.error || "Erreur lors de la création du template");
      }

      const template = await templateResponse.json();

      // 2. Create items for the template
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemResponse = await fetch(
          `/api/admin/checklist-templates/${template.id}/items`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemKey: item.itemKey,
              label: item.label,
              category: item.category,
              conformeText: item.conformeText,
              nonConformeText: item.nonConformeText,
              regulatoryReference: item.regulatoryReference || null,
              sortOrder: i,
            }),
          }
        );

        if (!itemResponse.ok) {
          console.error(`Error creating item ${i + 1}:`, await itemResponse.json());
          // Continue with other items even if one fails
        }
      }

      // 3. Redirect to the template edit page
      router.push(`/admin/audit-config/templates/${template.id}`);
    } catch (error) {
      console.error("Error creating template:", error);
      alert(error instanceof Error ? error.message : "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  // Group items by category for display
  const itemsByCategory = items.reduce((acc, item, index) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push({ ...item, index });
    return acc;
  }, {} as Record<string, (ItemForm & { index: number })[]>);

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
          <h1 className="text-2xl font-bold text-gray-900">
            Nouveau template de checklist
          </h1>
          <p className="text-gray-600 mt-1">
            Créez un template personnalisé pour vos audits techniques
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 size={18} className="mr-2 animate-spin" />
          ) : (
            <Save size={18} className="mr-2" />
          )}
          Créer le template
        </Button>
      </div>

      {/* Template Info */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Informations du template
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du template <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Ex: Chaudière gaz"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domaine <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.domain}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, domain: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              {DOMAIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Types d&apos;équipements <span className="text-red-500">*</span>
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
              placeholder="Chaudière gaz, Chaudière fioul (séparés par des virgules)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Les types d&apos;équipements pour lesquels ce template s&apos;applique. Utilisez &quot;_SITE_COMMON_&quot; pour un template commun à tous les sites.
            </p>
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
              placeholder="Description optionnelle du template"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Items de contrôle
            </h2>
            <p className="text-sm text-gray-600">
              {items.length} item{items.length > 1 ? "s" : ""} configuré{items.length > 1 ? "s" : ""}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setAddingItem(true)}
            disabled={addingItem}
          >
            <Plus size={18} className="mr-2" />
            Ajouter un item
          </Button>
        </div>

        {/* Add item form */}
        {addingItem && (
          <div className="border border-accent/30 rounded-lg p-4 mb-4 bg-accent/5">
            <h3 className="font-medium text-gray-900 mb-4">Nouvel item</h3>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newItem.label}
                    onChange={(e) =>
                      setNewItem((prev) => ({ ...prev, label: e.target.value }))
                    }
                    placeholder="Ex: Schéma de principe présent"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newItem.category}
                    onChange={(e) =>
                      setNewItem((prev) => ({ ...prev, category: e.target.value }))
                    }
                    placeholder="Ex: DOSSIER_TECHNIQUE"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Texte si CONFORME <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newItem.conformeText}
                  onChange={(e) =>
                    setNewItem((prev) => ({ ...prev, conformeText: e.target.value }))
                  }
                  rows={2}
                  placeholder="Ex: Le schéma de principe est présent et accessible."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Texte si NON CONFORME <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newItem.nonConformeText}
                  onChange={(e) =>
                    setNewItem((prev) => ({ ...prev, nonConformeText: e.target.value }))
                  }
                  rows={2}
                  placeholder="Ex: Le schéma de principe est absent ou non accessible."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Référence réglementaire (optionnel)
                </label>
                <input
                  type="text"
                  value={newItem.regulatoryReference}
                  onChange={(e) =>
                    setNewItem((prev) => ({ ...prev, regulatoryReference: e.target.value }))
                  }
                  placeholder="Ex: Article R.224-41-4 du Code de l'environnement"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddingItem(false);
                    setNewItem({
                      itemKey: "",
                      label: "",
                      category: "",
                      conformeText: "",
                      nonConformeText: "",
                      regulatoryReference: "",
                    });
                  }}
                >
                  Annuler
                </Button>
                <Button size="sm" onClick={handleAddItem}>
                  Ajouter
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Items list */}
        {items.length === 0 && !addingItem ? (
          <div className="text-center py-8">
            <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-gray-600 font-medium">Aucun item configuré</h3>
            <p className="text-gray-500 text-sm mt-1">
              Ajoutez des items de contrôle pour votre checklist
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
              <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700">
                  {category} ({categoryItems.length})
                </div>
                <div className="divide-y divide-gray-100">
                  {categoryItems.map((item) => (
                    <div key={item.index} className="p-4 flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.label}</p>
                        <div className="mt-2 grid gap-1 text-sm">
                          <div className="flex items-start gap-2">
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                              OK
                            </span>
                            <span className="text-gray-600">{item.conformeText}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                              NOK
                            </span>
                            <span className="text-gray-600">{item.nonConformeText}</span>
                          </div>
                          {item.regulatoryReference && (
                            <div className="flex items-start gap-2">
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                Réf
                              </span>
                              <span className="text-gray-500 italic">{item.regulatoryReference}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.index)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
