"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

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
  description: string | null;
  price: number | null;
  priceUnit: string;
  priority: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  REGLEMENTAIRE: "Conformité réglementaire",
  CONFORMITE: "Conformité technique",
  SECURITE: "Sécurité",
  PERIODIQUE: "Contrôles périodiques",
};

const CATEGORY_ORDER = ["REGLEMENTAIRE", "CONFORMITE", "SECURITE", "PERIODIQUE"];

export default function AuditPreviewPage() {
  const [checkpoints, setCheckpoints] = useState<CheckPoint[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORY_ORDER)
  );
  const [selectedFindings, setSelectedFindings] = useState<Map<string, string>>(
    new Map()
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [checkpointsRes, recoRes] = await Promise.all([
        fetch("/api/admin/audit-checkpoints"),
        fetch("/api/admin/recommendation-library"),
      ]);

      if (checkpointsRes.ok) {
        const data = await checkpointsRes.json();
        setCheckpoints(data);

        // Auto-select first finding for each checkpoint (for preview)
        const initialSelections = new Map<string, string>();
        data.forEach((cp: CheckPoint) => {
          if (cp.findings.length > 0) {
            initialSelections.set(cp.id, cp.findings[0].id);
          }
        });
        setSelectedFindings(initialSelections);
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

  const toggleCategory = (category: string) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setExpandedCategories(newSet);
  };

  const selectFinding = (checkpointId: string, findingId: string) => {
    setSelectedFindings((prev) => new Map(prev).set(checkpointId, findingId));
  };

  // Group checkpoints by category
  const groupedByCategory = checkpoints.reduce((acc, cp) => {
    if (!acc[cp.category]) {
      acc[cp.category] = [];
    }
    acc[cp.category].push(cp);
    return acc;
  }, {} as Record<string, CheckPoint[]>);

  // Get selected finding for a checkpoint
  const getSelectedFinding = (checkpoint: CheckPoint): Finding | undefined => {
    const selectedId = selectedFindings.get(checkpoint.id);
    return checkpoint.findings.find((f) => f.id === selectedId);
  };

  // Get recommendation by ID
  const getRecommendation = (id: string): Recommendation | undefined => {
    return recommendations.find((r) => r.id === id);
  };

  // Calculate totals
  const nonConformFindings = Array.from(selectedFindings.entries())
    .map(([cpId, findingId]) => {
      const cp = checkpoints.find((c) => c.id === cpId);
      const finding = cp?.findings.find((f) => f.id === findingId);
      return { checkpoint: cp, finding };
    })
    .filter((item) => item.finding && !item.finding.isConform);

  const linkedRecommendations = nonConformFindings
    .filter((item) => item.finding?.recommendationId)
    .map((item) => getRecommendation(item.finding!.recommendationId!))
    .filter((r): r is Recommendation => r !== undefined);

  const totalCost = linkedRecommendations.reduce(
    (sum, r) => sum + (r.price || 0),
    0
  );

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
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-accent mb-2"
        >
          <ArrowLeft size={16} />
          Administration
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Aperçu du rapport</h1>
        <p className="text-gray-600 mt-1">
          Cliquez sur un constat pour voir le texte du rapport correspondant
        </p>
      </div>

      {checkpoints.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700">
            Aucun point de contrôle configuré
          </h3>
          <p className="text-gray-500 mt-2">
            Configurez d&apos;abord vos points de contrôle pour voir l&apos;aperçu.
          </p>
          <Link
            href="/admin/audit-checkpoints"
            className="inline-block mt-4 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
          >
            Configurer les points de contrôle
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Selection Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h2 className="font-semibold text-gray-900 mb-4">
                Sélectionnez les constats
              </h2>
              <div className="space-y-3">
                {CATEGORY_ORDER.map((category) => {
                  const categoryCheckpoints = groupedByCategory[category] || [];
                  if (categoryCheckpoints.length === 0) return null;

                  const isExpanded = expandedCategories.has(category);

                  return (
                    <div key={category} className="border rounded-lg">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between p-3 text-left text-sm font-medium hover:bg-gray-50"
                      >
                        <span>{CATEGORY_LABELS[category]}</span>
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-gray-400" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-400" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t divide-y">
                          {categoryCheckpoints.map((cp) => (
                            <div key={cp.id} className="p-3">
                              <p className="text-sm font-medium text-gray-800 mb-2">
                                {cp.label}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {cp.findings.map((finding) => (
                                  <button
                                    key={finding.id}
                                    onClick={() =>
                                      selectFinding(cp.id, finding.id)
                                    }
                                    className={`px-2 py-1 text-xs rounded transition-colors ${
                                      selectedFindings.get(cp.id) === finding.id
                                        ? finding.isConform
                                          ? "bg-green-500 text-white"
                                          : "bg-red-500 text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                  >
                                    {finding.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Report Preview */}
          <div className="lg:col-span-2 space-y-4">
            {/* Report Document */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              {/* Report Header */}
              <div className="p-6 border-b bg-gray-50">
                <div className="flex items-center gap-3 mb-4">
                  <FileText size={24} className="text-accent" />
                  <h2 className="text-xl font-bold text-gray-900">
                    Rapport d&apos;audit technique
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Site :</span>
                    <span className="ml-2 font-medium">
                      [Nom du site]
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Date :</span>
                    <span className="ml-2 font-medium">
                      {new Date().toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Auditeur :</span>
                    <span className="ml-2 font-medium">[Nom auditeur]</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Référence :</span>
                    <span className="ml-2 font-medium">AUD-2026-001</span>
                  </div>
                </div>
              </div>

              {/* Report Content */}
              <div className="p-6 space-y-6">
                {CATEGORY_ORDER.map((category) => {
                  const categoryCheckpoints = groupedByCategory[category] || [];
                  if (categoryCheckpoints.length === 0) return null;

                  return (
                    <div key={category}>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b">
                        {CATEGORY_LABELS[category]}
                      </h3>
                      <div className="space-y-3">
                        {categoryCheckpoints.map((cp) => {
                          const selectedFinding = getSelectedFinding(cp);
                          if (!selectedFinding) return null;

                          const isConform = selectedFinding.isConform;
                          const reportText =
                            selectedFinding.reportText ||
                            `${cp.label} : ${selectedFinding.label}. ${
                              isConform ? "Conforme." : "Non conforme."
                            }`;

                          return (
                            <div
                              key={cp.id}
                              className={`flex items-start gap-3 p-3 rounded-lg ${
                                isConform ? "bg-green-50" : "bg-red-50"
                              }`}
                            >
                              {isConform ? (
                                <CheckCircle2
                                  size={18}
                                  className="text-green-600 mt-0.5 shrink-0"
                                />
                              ) : (
                                <XCircle
                                  size={18}
                                  className="text-red-600 mt-0.5 shrink-0"
                                />
                              )}
                              <div className="flex-1">
                                <p
                                  className={`text-sm ${
                                    isConform
                                      ? "text-green-800"
                                      : "text-red-800"
                                  }`}
                                >
                                  {reportText}
                                </p>
                                {cp.regulatoryRef && !isConform && (
                                  <p className="text-xs text-red-600 mt-1">
                                    Réf: {cp.regulatoryRef}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Recommendations Section */}
                {linkedRecommendations.length > 0 && (
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Préconisations
                    </h3>
                    <div className="space-y-2">
                      {linkedRecommendations.map((reco, index) => (
                        <div
                          key={reco.id}
                          className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg"
                        >
                          <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {reco.title}
                            </p>
                            {reco.description && (
                              <p className="text-xs text-gray-600 mt-1">
                                {reco.description}
                              </p>
                            )}
                          </div>
                          {reco.price && (
                            <span className="text-sm font-semibold text-orange-600">
                              {reco.price.toLocaleString("fr-FR")} €{" "}
                              {reco.priceUnit}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="mt-4 p-4 bg-gray-100 rounded-lg flex items-center justify-between">
                      <span className="font-semibold text-gray-900">
                        Estimation totale des travaux
                      </span>
                      <span className="text-xl font-bold text-accent">
                        {totalCost.toLocaleString("fr-FR")} €
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Warning if no report text configured */}
            {checkpoints.some((cp) =>
              cp.findings.some((f) => !f.reportText)
            ) && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle size={20} className="text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Certains constats n&apos;ont pas de texte de rapport configuré
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Un texte par défaut sera utilisé. Pour personnaliser,
                    modifiez les points de contrôle.
                  </p>
                  <Link
                    href="/admin/audit-checkpoints"
                    className="text-xs text-amber-800 underline mt-2 inline-block"
                  >
                    Configurer les textes de rapport
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
