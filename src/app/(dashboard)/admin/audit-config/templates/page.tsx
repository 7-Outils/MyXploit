"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  ClipboardList,
  Pencil,
  Trash2,
  Loader2,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChecklistTemplate {
  id: string;
  name: string;
  domain: string;
  equipmentTypes: string[];
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { items: number };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/admin/checklist-templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer le template "${name}" et tous ses items ?`)) {
      return;
    }

    setDeleting(id);
    try {
      const response = await fetch(`/api/admin/checklist-templates/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        const data = await response.json();
        alert(data.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Erreur lors de la suppression");
    } finally {
      setDeleting(null);
    }
  };

  // Grouper par domaine
  const groupedByDomain = templates.reduce((acc, template) => {
    const domain = template.domain;
    if (!acc[domain]) {
      acc[domain] = [];
    }
    acc[domain].push(template);
    return acc;
  }, {} as Record<string, ChecklistTemplate[]>);

  const domainLabels: Record<string, string> = {
    DOCUMENTATION: "Documentation et Conformité",
    CHAUFFAGE: "Chauffage",
    ECS: "Eau Chaude Sanitaire",
    VENTILATION: "Ventilation",
    CLIMATISATION: "Climatisation",
    PLOMBERIE: "Plomberie",
    TRAITEMENT_EAU: "Traitement d'eau",
    CFO_CFA: "Électricité (CFO/CFA)",
    COMPTAGE: "Comptage",
    PISCINE: "Piscine",
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
            Templates de checklist
          </h1>
          <p className="text-gray-600 mt-1">
            {templates.length} templates configurés
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/audit-config/templates/new">
            <Plus size={18} className="mr-2" />
            Nouveau template
          </Link>
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700">
            Aucun template configuré
          </h3>
          <p className="text-gray-500 mt-2">
            Commencez par effectuer la migration pour importer les templates
            prédéfinis.
          </p>
          <Link
            href="/admin/migration"
            className="inline-flex items-center gap-2 mt-4 text-accent hover:underline"
          >
            Aller à la migration
            <ChevronRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByDomain).map(([domain, domainTemplates]) => (
            <div key={domain}>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                {domainLabels[domain] || domain}
              </h2>
              <div className="grid gap-4">
                {domainTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                            <FileText size={20} className="text-accent" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {template.name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {template._count.items} items de contrôle
                            </p>
                          </div>
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-600 mt-3 ml-13">
                            {template.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3 ml-13">
                          {template.equipmentTypes.slice(0, 5).map((type) => (
                            <span
                              key={type}
                              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                            >
                              {type}
                            </span>
                          ))}
                          {template.equipmentTypes.length > 5 && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                              +{template.equipmentTypes.length - 5}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/audit-config/templates/${template.id}`}
                          className="p-2 text-gray-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                        >
                          <Pencil size={18} />
                        </Link>
                        <button
                          onClick={() => handleDelete(template.id, template.name)}
                          disabled={deleting === template.id}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {deleting === template.id ? (
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
    </div>
  );
}
