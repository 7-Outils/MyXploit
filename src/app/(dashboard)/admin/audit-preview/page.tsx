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
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent mb-2"
        >
          <ArrowLeft size={16} />
          Administration
        </Link>
        <h1 className="text-xl font-semibold text-ink">Aperçu du rapport</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Cliquez sur un constat pour voir le texte du rapport correspondant
        </p>
      </div>

      {checkpoints.length === 0 ? (
        <div className="border border-ink/10 bg-white p-8 text-center">
          <FileText size={48} className="mx-auto text-ink/20 mb-4" />
          <h3 className="text-sm font-medium text-ink">
            Aucun point de contrôle configuré
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Configurez d&apos;abord vos points de contrôle pour voir l&apos;aperçu.
          </p>
          <Link
            href="/admin/audit-checkpoints"
            className="inline-block mt-4 bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent"
          >
            Configurer les points de contrôle
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Selection Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="border border-ink/10 bg-white p-4">
              <h2 className="label-tech mb-3">
                Sélectionnez les constats
              </h2>
              <div className="space-y-3">
                {CATEGORY_ORDER.map((category) => {
                  const categoryCheckpoints = groupedByCategory[category] || [];
                  if (categoryCheckpoints.length === 0) return null;

                  const isExpanded = expandedCategories.has(category);

                  return (
                    <div key={category} className="border">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between p-3 text-left text-sm font-medium hover:bg-ink/[0.02]"
                      >
                        <span>{CATEGORY_LABELS[category]}</span>
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-ink/40" />
                        ) : (
                          <ChevronRight size={16} className="text-ink/40" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-ink/10 divide-y divide-ink/10">
                          {categoryCheckpoints.map((cp) => (
                            <div key={cp.id} className="p-3">
                              <p className="text-sm font-medium text-ink mb-2">
                                {cp.label}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {cp.findings.map((finding) => (
                                  <button
                                    key={finding.id}
                                    onClick={() =>
                                      selectFinding(cp.id, finding.id)
                                    }
                                    className={`px-2 py-1 text-xs transition-colors ${
                                      selectedFindings.get(cp.id) === finding.id
                                        ? finding.isConform
                                          ? "bg-green-500 text-white"
                                          : "bg-red-500 text-white"
                                        : "bg-ink/[0.03] text-text-secondary hover:bg-ink/[0.05]"
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
            <div className="border border-ink/10 bg-white">
              {/* Report Header */}
              <div className="border-b border-ink/10 bg-ink/[0.015] p-4">
                <div className="flex items-center gap-3 mb-4">
                  <FileText size={24} className="text-accent" />
                  <h2 className="text-xl font-semibold text-ink">
                    Rapport d&apos;audit technique
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-ink/50">Site :</span>
                    <span className="ml-2 font-medium">
                      [Nom du site]
                    </span>
                  </div>
                  <div>
                    <span className="text-ink/50">Date :</span>
                    <span className="ml-2 font-medium">
                      {new Date().toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink/50">Auditeur :</span>
                    <span className="ml-2 font-medium">[Nom auditeur]</span>
                  </div>
                  <div>
                    <span className="text-ink/50">Référence :</span>
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
                      <h3 className="text-sm font-medium text-ink mb-3 pb-2 border-b border-ink/10">
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
                              className={`flex items-start gap-3 p-3 ${
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
                  <div className="border-t border-ink/10 pt-4">
                    <h3 className="text-sm font-medium text-ink mb-3">
                      Préconisations
                    </h3>
                    <div className="space-y-2">
                      {linkedRecommendations.map((reco, index) => (
                        <div
                          key={reco.id}
                          className="flex items-start gap-3 p-3 bg-orange-50"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-amber-600/30 bg-amber-50 font-mono text-[11px] text-amber-700">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-ink">
                              {reco.title}
                            </p>
                            {reco.description && (
                              <p className="text-xs text-text-secondary mt-1">
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
                    <div className="mt-4 p-4 bg-ink/[0.03] flex items-center justify-between">
                      <span className="font-semibold text-ink">
                        Estimation totale des travaux
                      </span>
                      <span className="font-mono text-lg font-medium tabular-nums text-accent">
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
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200">
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
