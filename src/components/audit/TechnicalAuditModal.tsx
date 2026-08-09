"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Loader2,
  AlertCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Trash2,
  Banknote,
  ClipboardCheck,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  convertCheckpointsToBlueprints,
  evaluateAuditItem,
  type AuditItemBlueprint,
  type UserInput,
  type EvaluationResult,
  type EvaluationContext,
} from "@/lib/audit/audit-engine";

// Types pour les checkpoints
interface Finding {
  id: string;
  label: string;
  isConform: boolean;
  recommendationId: string | null;
  reportText?: string;
}

interface ValueField {
  key: string;
  label: string;
  unit?: string;
  type: "number" | "date" | "text";
  thresholdMin?: number;
  thresholdMax?: number;
}

interface AuditCheckPoint {
  id: string;
  label: string;
  category: string;
  description: string | null;
  responseType: string;
  findings: Finding[];
  valueFields: ValueField[] | null;
  regulatoryRef: string | null;
  sortOrder: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  priceUnit: string;
  priority: number;
  category: string | null;
}

// Types pour les réponses de l'audit
interface CheckpointResponse {
  checkpointId: string;
  checkpointLabel: string;
  category: string;
  responseType: string;
  // Pour YES_NO et MULTI_CHOICE
  selectedFindingId?: string | null;
  isConform?: boolean;
  // Pour YES_NO_DATE
  hasDate?: boolean;
  dateValue?: string;
  // Pour YES_NO_VALUES
  values?: Record<string, string | number>;
  // Notes
  notes?: string;
}

interface GeneratedRecommendation {
  id: string;
  checkpointId: string;
  recommendationId: string;
  title: string;
  description: string | null;
  estimatedCostMin: number | null;
  estimatedCostMax: number | null;
  priority: number;
  auditorNotes: string;
}

interface TechnicalAuditModalProps {
  siteId: string;
  siteName: string;
  onClose: () => void;
  onSave: (data: AuditFormData) => Promise<void>;
}

interface AuditFormData {
  auditDate: string;
  auditor: string;
  checkpointResponses: CheckpointResponse[];
  recommendations: GeneratedRecommendation[];
  generalNotes: string;
}

interface Category {
  id: string;
  label: string;
  description: string | null;
  sortOrder: number;
}

// Status display configuration
const STATUS_CONFIG = {
  CONFORME: {
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-600/20",
    label: "Conforme",
  },
  NON_CONFORME: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-600/20",
    label: "Non conforme",
  },
  AVERTISSEMENT: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-600/20",
    label: "Avertissement",
  },
  NA: {
    icon: MinusCircle,
    color: "text-ink/50",
    bg: "bg-ink/[0.02]",
    border: "border-ink/10",
    label: "N/A",
  },
  NON_EVALUE: {
    icon: MinusCircle,
    color: "text-ink/40",
    bg: "bg-ink/[0.02]",
    border: "border-ink/10",
    label: "Non évalué",
  },
};

export default function TechnicalAuditModal({
  siteName,
  onClose,
  onSave,
}: TechnicalAuditModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkpoints, setCheckpoints] = useState<AuditCheckPoint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [blueprints, setBlueprints] = useState<AuditItemBlueprint[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [evaluationResults, setEvaluationResults] = useState<Map<string, EvaluationResult>>(new Map());
  const [noCheckpointsConfigured, setNoCheckpointsConfigured] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showRecommendations, setShowRecommendations] = useState(true);

  // Context for evaluation (can be extended with equipment/site data)
  const [evaluationContext] = useState<EvaluationContext>({});

  // Form data
  const [formData, setFormData] = useState<AuditFormData>({
    auditDate: new Date().toISOString().split("T")[0],
    auditor: "",
    checkpointResponses: [],
    recommendations: [],
    generalNotes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/audit-checkpoints");
      if (response.ok) {
        const data = await response.json();
        if (data.checkpoints.length === 0) {
          setNoCheckpointsConfigured(true);
        } else {
          setCheckpoints(data.checkpoints);
          setCategories(data.categories || []);
          setRecommendations(data.recommendations || []);

          // Expand all categories by default
          const categoryIds = (data.categories || []).map((c: Category) => c.id);
          setExpandedCategories(new Set(categoryIds));

          // Convert checkpoints to blueprints for the evaluation engine
          const convertedBlueprints = convertCheckpointsToBlueprints(
            data.checkpoints.map((cp: AuditCheckPoint) => ({
              ...cp,
              findings: cp.findings || [],
            }))
          );
          setBlueprints(convertedBlueprints);

          // Initialize responses
          const initialResponses: CheckpointResponse[] = data.checkpoints.map(
            (cp: AuditCheckPoint) => ({
              checkpointId: cp.id,
              checkpointLabel: cp.label,
              category: cp.category,
              responseType: cp.responseType,
              selectedFindingId: null,
              isConform: undefined,
              notes: "",
            })
          );
          setFormData((prev) => ({
            ...prev,
            checkpointResponses: initialResponses,
          }));
        }
      } else {
        setNoCheckpointsConfigured(true);
      }
    } catch (error) {
      console.error("Error fetching checkpoints:", error);
      setNoCheckpointsConfigured(true);
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

  const updateResponse = useCallback((checkpointId: string, updates: Partial<CheckpointResponse>) => {
    // Find the blueprint for evaluation
    const blueprint = blueprints.find((b) => b.id === checkpointId);

    setFormData((prev) => {
      const newResponses = prev.checkpointResponses.map((r) =>
        r.checkpointId === checkpointId ? { ...r, ...updates } : r
      );

      // Handle recommendation generation
      let newRecommendations = [...prev.recommendations];
      const checkpoint = checkpoints.find((cp) => cp.id === checkpointId);

      if (checkpoint && updates.selectedFindingId !== undefined) {
        // Remove old recommendation for this checkpoint
        newRecommendations = newRecommendations.filter(
          (rec) => rec.checkpointId !== checkpointId
        );

        // If finding is non-conform and has a linked recommendation, add it
        if (updates.selectedFindingId) {
          const finding = checkpoint.findings.find(
            (f) => f.id === updates.selectedFindingId
          );
          if (finding && !finding.isConform && finding.recommendationId) {
            const recTemplate = recommendations.find(
              (r) => r.id === finding.recommendationId
            );
            if (recTemplate) {
              newRecommendations.push({
                id: crypto.randomUUID(),
                checkpointId,
                recommendationId: recTemplate.id,
                title: recTemplate.title,
                description: recTemplate.description,
                estimatedCostMin: recTemplate.price,
                estimatedCostMax: recTemplate.price,
                priority: recTemplate.priority,
                auditorNotes: "",
              });
            }
          }
        }
      }

      return {
        ...prev,
        checkpointResponses: newResponses,
        recommendations: newRecommendations,
      };
    });

    // Evaluate using the engine if we have a blueprint
    if (blueprint) {
      // Determine the input value based on response type
      let inputValue: string | boolean | null = null;
      if (updates.selectedFindingId !== undefined) {
        inputValue = updates.selectedFindingId;
      } else if (updates.isConform !== undefined) {
        inputValue = updates.isConform;
      }

      if (inputValue !== null) {
        const userInput: UserInput = {
          itemId: checkpointId,
          value: inputValue,
          notes: updates.notes,
          timestamp: new Date(),
        };

        const result = evaluateAuditItem(blueprint, userInput, evaluationContext);

        setEvaluationResults((prev) => {
          const newResults = new Map(prev);
          newResults.set(checkpointId, result);
          return newResults;
        });
      }
    }
  }, [blueprints, checkpoints, recommendations, evaluationContext]);

  const updateRecommendation = (id: string, updates: Partial<GeneratedRecommendation>) => {
    setFormData((prev) => ({
      ...prev,
      recommendations: prev.recommendations.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    }));
  };

  const removeRecommendation = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      recommendations: prev.recommendations.filter((r) => r.id !== id),
    }));
  };

  const calculateTotalCost = () => {
    let minTotal = 0;
    let maxTotal = 0;
    for (const rec of formData.recommendations) {
      if (rec.estimatedCostMin) minTotal += rec.estimatedCostMin;
      if (rec.estimatedCostMax) maxTotal += rec.estimatedCostMax;
    }
    return { minTotal, maxTotal };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Error saving audit:", error);
      alert("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // Group checkpoints by category
  const groupedByCategory = useMemo(() => checkpoints.reduce((acc, cp) => {
    if (!acc[cp.category]) {
      acc[cp.category] = [];
    }
    acc[cp.category].push(cp);
    return acc;
  }, {} as Record<string, AuditCheckPoint[]>), [checkpoints]);

  const { minTotal, maxTotal } = calculateTotalCost();

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-ink/15 shadow-large w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ink/10 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-semibold text-ink">Audit technique</h2>
            <p className="text-sm text-ink/60">{siteName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-ink/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <Loader2 size={32} className="animate-spin text-accent mb-4" />
            <p className="text-ink/50">Chargement des points de contrôle...</p>
          </div>
        ) : noCheckpointsConfigured ? (
          <div className="p-4">
            <div className="border border-amber-600/20 bg-amber-50 p-4 text-center">
              <AlertCircle size={48} className="mx-auto text-amber-600 mb-4" />
              <h3 className="text-base font-semibold text-ink mb-2">
                Aucun point de contrôle configuré
              </h3>
              <p className="text-ink/60 mb-4">
                Configurez d&apos;abord vos points de contrôle et préconisations
                dans le panneau d&apos;administration.
              </p>
              <a
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-paper hover:bg-accent transition-colors"
              >
                <Settings size={18} />
                Configurer les audits
              </a>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Date and auditor */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-tech mb-1.5 block">
                  Date de l&apos;audit
                </label>
                <input
                  type="date"
                  value={formData.auditDate}
                  onChange={(e) =>
                    setFormData({ ...formData, auditDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="label-tech mb-1.5 block">
                  Auditeur
                </label>
                <input
                  type="text"
                  value={formData.auditor}
                  onChange={(e) =>
                    setFormData({ ...formData, auditor: e.target.value })
                  }
                  placeholder="Nom de l'auditeur"
                  className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Checkpoints by category */}
            {categories.map((category) => {
              const categoryCheckpoints = groupedByCategory[category.id] || [];
              if (categoryCheckpoints.length === 0) return null;

              const isExpanded = expandedCategories.has(category.id);

              return (
                <div
                  key={category.id}
                  className="border border-ink/10 overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full border-b border-ink/10 bg-white px-4 py-2.5 flex items-center justify-between transition-colors hover:bg-ink/[0.02]"
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardCheck size={16} className="text-ink/40" />
                      <span className="label-tech text-ink">
                        {category.label} ({categoryCheckpoints.length})
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown size={20} />
                    ) : (
                      <ChevronRight size={20} />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-ink/10">
                      {categoryCheckpoints.map((checkpoint) => {
                        const response = formData.checkpointResponses.find(
                          (r) => r.checkpointId === checkpoint.id
                        );

                        return (
                          <div key={checkpoint.id} className="p-4">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex-1">
                                <span className="text-sm font-medium text-ink">
                                  {checkpoint.label}
                                </span>
                                {checkpoint.regulatoryRef && (
                                  <span className="ml-2 text-xs text-accent">
                                    ({checkpoint.regulatoryRef})
                                  </span>
                                )}
                                {checkpoint.description && (
                                  <p className="text-xs text-ink/50 mt-0.5">
                                    {checkpoint.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Response based on type */}
                            {checkpoint.responseType === "MULTI_CHOICE" &&
                              checkpoint.findings.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {checkpoint.findings.map((finding) => (
                                    <button
                                      key={finding.id}
                                      onClick={() =>
                                        updateResponse(checkpoint.id, {
                                          selectedFindingId:
                                            response?.selectedFindingId === finding.id
                                              ? null
                                              : finding.id,
                                          isConform: finding.isConform,
                                        })
                                      }
                                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                                        response?.selectedFindingId === finding.id
                                          ? finding.isConform
                                            ? "bg-green-600 text-white"
                                            : "bg-red-600 text-white"
                                          : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                                      }`}
                                    >
                                      {finding.label}
                                    </button>
                                  ))}
                                </div>
                              )}

                            {checkpoint.responseType === "YES_NO" && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    updateResponse(checkpoint.id, {
                                      isConform:
                                        response?.isConform === true ? undefined : true,
                                      selectedFindingId: null,
                                    })
                                  }
                                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                                    response?.isConform === true
                                      ? "bg-green-600 text-white"
                                      : "bg-ink/5 text-ink/60 hover:bg-green-50 hover:text-green-700"
                                  }`}
                                >
                                  Oui
                                </button>
                                <button
                                  onClick={() =>
                                    updateResponse(checkpoint.id, {
                                      isConform:
                                        response?.isConform === false ? undefined : false,
                                      selectedFindingId: null,
                                    })
                                  }
                                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                                    response?.isConform === false
                                      ? "bg-red-600 text-white"
                                      : "bg-ink/5 text-ink/60 hover:bg-red-50 hover:text-red-700"
                                  }`}
                                >
                                  Non
                                </button>
                              </div>
                            )}

                            {checkpoint.responseType === "YES_NO_DATE" && (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      updateResponse(checkpoint.id, {
                                        isConform:
                                          response?.isConform === true ? undefined : true,
                                        hasDate: true,
                                      })
                                    }
                                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                                      response?.isConform === true
                                        ? "bg-green-600 text-white"
                                        : "bg-ink/5 text-ink/60 hover:bg-green-50 hover:text-green-700"
                                    }`}
                                  >
                                    Oui
                                  </button>
                                  <button
                                    onClick={() =>
                                      updateResponse(checkpoint.id, {
                                        isConform:
                                          response?.isConform === false ? undefined : false,
                                        hasDate: false,
                                      })
                                    }
                                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                                      response?.isConform === false
                                        ? "bg-red-600 text-white"
                                        : "bg-ink/5 text-ink/60 hover:bg-red-50 hover:text-red-700"
                                    }`}
                                  >
                                    Non
                                  </button>
                                </div>
                                {response?.isConform === true && (
                                  <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-ink/40" />
                                    <input
                                      type="date"
                                      value={response?.dateValue || ""}
                                      onChange={(e) =>
                                        updateResponse(checkpoint.id, {
                                          dateValue: e.target.value,
                                        })
                                      }
                                      className="px-3 py-1.5 text-sm border border-ink/20 focus:border-accent focus:outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {checkpoint.responseType === "YES_NO_VALUES" && (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      updateResponse(checkpoint.id, {
                                        isConform:
                                          response?.isConform === true ? undefined : true,
                                      })
                                    }
                                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                                      response?.isConform === true
                                        ? "bg-green-600 text-white"
                                        : "bg-ink/5 text-ink/60 hover:bg-green-50 hover:text-green-700"
                                    }`}
                                  >
                                    Oui
                                  </button>
                                  <button
                                    onClick={() =>
                                      updateResponse(checkpoint.id, {
                                        isConform:
                                          response?.isConform === false ? undefined : false,
                                      })
                                    }
                                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                                      response?.isConform === false
                                        ? "bg-red-600 text-white"
                                        : "bg-ink/5 text-ink/60 hover:bg-red-50 hover:text-red-700"
                                    }`}
                                  >
                                    Non
                                  </button>
                                </div>
                                {response?.isConform === true &&
                                  checkpoint.valueFields &&
                                  checkpoint.valueFields.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                      {checkpoint.valueFields.map((field) => (
                                        <div key={field.key}>
                                          <label className="label-tech mb-1.5 block">
                                            {field.label}{" "}
                                            {field.unit && `(${field.unit})`}
                                          </label>
                                          <input
                                            type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                                            value={response?.values?.[field.key] || ""}
                                            onChange={(e) =>
                                              updateResponse(checkpoint.id, {
                                                values: {
                                                  ...(response?.values || {}),
                                                  [field.key]: e.target.value,
                                                },
                                              })
                                            }
                                            className="w-full px-2 py-1.5 text-sm border border-ink/20 focus:border-accent focus:outline-none"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                              </div>
                            )}

                            {/* STATUS_DATE: Show findings + date + attestation */}
                            {(checkpoint.responseType === "STATUS_DATE" || checkpoint.responseType === "STATUS") &&
                              checkpoint.findings.length > 0 && (
                                <div className="space-y-3">
                                  {/* Statut buttons */}
                                  <div className="flex flex-wrap gap-2">
                                    {checkpoint.findings.map((finding) => (
                                      <button
                                        key={finding.id}
                                        onClick={() =>
                                          updateResponse(checkpoint.id, {
                                            selectedFindingId:
                                              response?.selectedFindingId === finding.id
                                                ? null
                                                : finding.id,
                                            isConform: finding.isConform,
                                          })
                                        }
                                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                                          response?.selectedFindingId === finding.id
                                            ? finding.isConform
                                              ? "bg-green-600 text-white"
                                              : "bg-red-600 text-white"
                                            : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                                        }`}
                                      >
                                        {finding.label}
                                      </button>
                                    ))}
                                  </div>
                                  {/* Date + Attestation when selected (not N/A) */}
                                  {response?.selectedFindingId && response.selectedFindingId !== "na" && (
                                    <div className="flex flex-wrap items-center gap-4 p-3 bg-ink/[0.02]">
                                      {/* Date du dernier contrôle */}
                                      <div className="flex items-center gap-2">
                                        <Calendar size={16} className="text-ink/40" />
                                        <span className="text-xs text-ink/60">Date :</span>
                                        <input
                                          type="date"
                                          value={response?.dateValue || ""}
                                          onChange={(e) =>
                                            updateResponse(checkpoint.id, {
                                              dateValue: e.target.value,
                                            })
                                          }
                                          className="px-2 py-1 text-sm border border-ink/20 focus:border-accent focus:outline-none"
                                        />
                                      </div>
                                      {/* Attestation disponible */}
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-ink/60">Attestation :</span>
                                        <button
                                          onClick={() =>
                                            updateResponse(checkpoint.id, {
                                              values: {
                                                ...(response?.values || {}),
                                                attestation: "oui",
                                              },
                                            })
                                          }
                                          className={`px-2 py-1 text-xs font-medium transition-colors ${
                                            response?.values?.attestation === "oui"
                                              ? "bg-green-600 text-white"
                                              : "bg-ink/10 text-ink/60 hover:bg-ink/20"
                                          }`}
                                        >
                                          Présente
                                        </button>
                                        <button
                                          onClick={() =>
                                            updateResponse(checkpoint.id, {
                                              values: {
                                                ...(response?.values || {}),
                                                attestation: "non",
                                              },
                                            })
                                          }
                                          className={`px-2 py-1 text-xs font-medium transition-colors ${
                                            response?.values?.attestation === "non"
                                              ? "bg-amber-600 text-white"
                                              : "bg-ink/10 text-ink/60 hover:bg-ink/20"
                                          }`}
                                        >
                                          Absente
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                            {/* Notes */}
                            {(response?.isConform === false ||
                              (response?.selectedFindingId &&
                                checkpoint.findings.find(
                                  (f) => f.id === response.selectedFindingId
                                )?.isConform === false)) && (
                              <input
                                type="text"
                                value={response?.notes || ""}
                                onChange={(e) =>
                                  updateResponse(checkpoint.id, { notes: e.target.value })
                                }
                                placeholder="Remarque..."
                                className="mt-2 w-full px-3 py-1.5 text-sm border border-red-600/20 focus:border-red-600 focus:outline-none"
                              />
                            )}

                            {/* Evaluation Result Display */}
                            {(() => {
                              const evalResult = evaluationResults.get(checkpoint.id);
                              if (!evalResult || evalResult.status === "NON_EVALUE") return null;

                              const statusConfig = STATUS_CONFIG[evalResult.status];
                              const StatusIcon = statusConfig.icon;

                              return (
                                <div
                                  className={`mt-3 p-3 text-sm ${statusConfig.bg} ${statusConfig.border} border`}
                                >
                                  <div className="font-medium mb-1 flex items-center gap-2">
                                    <StatusIcon size={16} className={statusConfig.color} />
                                    <span className={statusConfig.color}>
                                      {statusConfig.label}
                                    </span>
                                  </div>
                                  <p className="text-ink/80">{evalResult.reportText}</p>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Recommendations Section */}
            {formData.recommendations.length > 0 && (
              <div className="border border-orange-600/20 overflow-hidden">
                <button
                  onClick={() => setShowRecommendations(!showRecommendations)}
                  className="w-full bg-orange-600 px-4 py-3 text-white font-medium flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Banknote size={18} />
                    Préconisations générées ({formData.recommendations.length})
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">
                      Total:{" "}
                      {minTotal === 0 && maxTotal === 0
                        ? "À chiffrer"
                        : minTotal === maxTotal
                        ? `${minTotal.toLocaleString("fr-FR")} €`
                        : `${minTotal.toLocaleString("fr-FR")} - ${maxTotal.toLocaleString("fr-FR")} €`}
                    </span>
                    {showRecommendations ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </div>
                </button>
                {showRecommendations && (
                  <div className="p-4 space-y-3">
                    {formData.recommendations.map((rec, index) => (
                      <div
                        key={rec.id}
                        className="border border-ink/10 p-4 bg-orange-50"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-600/20">
                                #{index + 1}
                              </span>
                              <span className="text-xs text-ink/50">
                                Priorité:{" "}
                                {rec.priority === 1
                                  ? "Urgent"
                                  : rec.priority === 2
                                  ? "Court terme"
                                  : rec.priority === 3
                                  ? "Moyen terme"
                                  : "Long terme"}
                              </span>
                            </div>
                            <h4 className="font-medium text-ink">{rec.title}</h4>
                            {rec.description && (
                              <p className="text-sm text-ink/60 mt-1">
                                {rec.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => removeRecommendation(rec.id)}
                            className="p-1 text-ink/40 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="label-tech mb-1.5 block">
                              Coût min (€)
                            </label>
                            <input
                              type="number"
                              value={rec.estimatedCostMin || ""}
                              onChange={(e) =>
                                updateRecommendation(rec.id, {
                                  estimatedCostMin: e.target.value
                                    ? parseFloat(e.target.value)
                                    : null,
                                })
                              }
                              placeholder="0"
                              className="w-full px-2 py-1.5 text-sm border border-ink/10 focus:border-orange-600 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="label-tech mb-1.5 block">
                              Coût max (€)
                            </label>
                            <input
                              type="number"
                              value={rec.estimatedCostMax || ""}
                              onChange={(e) =>
                                updateRecommendation(rec.id, {
                                  estimatedCostMax: e.target.value
                                    ? parseFloat(e.target.value)
                                    : null,
                                })
                              }
                              placeholder="0"
                              className="w-full px-2 py-1.5 text-sm border border-ink/10 focus:border-orange-600 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="label-tech mb-1.5 block">
                              Priorité
                            </label>
                            <select
                              value={rec.priority}
                              onChange={(e) =>
                                updateRecommendation(rec.id, {
                                  priority: parseInt(e.target.value),
                                })
                              }
                              className="w-full px-2 py-1.5 text-sm border border-ink/10 focus:border-orange-600 focus:outline-none"
                            >
                              <option value={1}>Urgent</option>
                              <option value={2}>Court terme</option>
                              <option value={3}>Moyen terme</option>
                              <option value={4}>Long terme</option>
                            </select>
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="label-tech mb-1.5 block">
                            Notes de l&apos;auditeur
                          </label>
                          <input
                            type="text"
                            value={rec.auditorNotes}
                            onChange={(e) =>
                              updateRecommendation(rec.id, {
                                auditorNotes: e.target.value,
                              })
                            }
                            placeholder="Notes complémentaires..."
                            className="w-full px-2 py-1.5 text-sm border border-ink/10 focus:border-orange-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* General notes */}
            <div>
              <label className="label-tech mb-1.5 block">
                Observations générales
              </label>
              <textarea
                value={formData.generalNotes}
                onChange={(e) =>
                  setFormData({ ...formData, generalNotes: e.target.value })
                }
                placeholder="Notes et observations..."
                rows={3}
                className="w-full px-3 py-2 border border-ink/20 focus:border-accent focus:outline-none"
              />
            </div>

            {/* Summary */}
            <div className="p-4 border bg-ink/[0.02]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Points évalués:{" "}
                  {
                    formData.checkpointResponses.filter(
                      (r) => r.isConform !== undefined || r.selectedFindingId
                    ).length
                  }{" "}
                  / {checkpoints.length}
                </span>
                {formData.recommendations.length > 0 && (
                  <span className="text-sm">
                    {formData.recommendations.length} préconisation
                    {formData.recommendations.length > 1 ? "s" : ""}
                    {(minTotal > 0 || maxTotal > 0) && (
                      <>
                        {" - "}
                        {minTotal === maxTotal
                          ? `${minTotal.toLocaleString("fr-FR")} €`
                          : `${minTotal.toLocaleString("fr-FR")} - ${maxTotal.toLocaleString("fr-FR")} €`}
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-ink/10 sticky bottom-0 bg-white">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
