"use client";

import { useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  Camera,
  Calendar,
} from "lucide-react";
import type {
  AuditItemBlueprint,
  UserInput,
  EvaluationContext,
  EvaluationResult,
} from "@/lib/audit/audit-engine";
import { evaluateAuditItem } from "@/lib/audit/audit-engine";

interface DynamicAuditFormProps {
  blueprints: AuditItemBlueprint[];
  context: EvaluationContext;
  initialInputs?: UserInput[];
  onInputChange?: (inputs: UserInput[], results: EvaluationResult[]) => void;
}

const STATUS_CONFIG = {
  CONFORME: {
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    label: "Conforme",
  },
  NON_CONFORME: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    label: "Non conforme",
  },
  AVERTISSEMENT: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "Avertissement",
  },
  NA: {
    icon: MinusCircle,
    color: "text-gray-500",
    bg: "bg-gray-50",
    border: "border-gray-200",
    label: "N/A",
  },
  NON_EVALUE: {
    icon: MinusCircle,
    color: "text-gray-400",
    bg: "bg-gray-50",
    border: "border-gray-100",
    label: "Non évalué",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  REGLEMENTAIRE: "Réglementaire",
  CONFORMITE: "Conformité",
  SECURITE: "Sécurité",
  PERIODIQUE: "Périodique",
};

export default function DynamicAuditForm({
  blueprints,
  context,
  initialInputs = [],
  onInputChange,
}: DynamicAuditFormProps) {
  // State for user inputs
  const [inputs, setInputs] = useState<Map<string, UserInput>>(() => {
    const map = new Map<string, UserInput>();
    initialInputs.forEach((i) => map.set(i.itemId, i));
    return map;
  });

  // State for evaluation results
  const [results, setResults] = useState<Map<string, EvaluationResult>>(new Map());

  // Handle input change
  const handleInputChange = useCallback(
    (itemId: string, value: unknown, notes?: string) => {
      const blueprint = blueprints.find((b) => b.id === itemId);
      if (!blueprint) return;

      const userInput: UserInput = {
        itemId,
        value: value as string | number | boolean | string[] | null,
        notes,
        timestamp: new Date(),
      };

      // Update inputs
      const newInputs = new Map(inputs);
      newInputs.set(itemId, userInput);
      setInputs(newInputs);

      // Evaluate immediately
      const result = evaluateAuditItem(blueprint, userInput, context);
      const newResults = new Map(results);
      newResults.set(itemId, result);
      setResults(newResults);

      // Notify parent
      if (onInputChange) {
        onInputChange(Array.from(newInputs.values()), Array.from(newResults.values()));
      }
    },
    [blueprints, context, inputs, results, onInputChange]
  );

  // Group blueprints by category
  const groupedByCategory = blueprints
    .filter((b) => b.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .reduce((acc, blueprint) => {
      const category = blueprint.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(blueprint);
      return acc;
    }, {} as Record<string, AuditItemBlueprint[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedByCategory).map(([category, items]) => (
        <div
          key={category}
          className="border border-gray-200 rounded-xl overflow-hidden"
        >
          {/* Category Header */}
          <div className="bg-accent px-4 py-3 text-white font-medium">
            {CATEGORY_LABELS[category] || category}
            <span className="ml-2 text-white/70 text-sm">
              ({items.length} points)
            </span>
          </div>

          {/* Items */}
          <div className="divide-y divide-gray-100">
            {items.map((blueprint) => {
              const input = inputs.get(blueprint.id);
              const result = results.get(blueprint.id);
              const statusConfig = result
                ? STATUS_CONFIG[result.status]
                : STATUS_CONFIG.NON_EVALUE;
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={blueprint.id}
                  className={`p-4 transition-colors ${
                    result ? statusConfig.bg : ""
                  }`}
                >
                  {/* Question row */}
                  <div className="flex items-start gap-4">
                    {/* Status indicator */}
                    <div className="mt-1">
                      <StatusIcon size={20} className={statusConfig.color} />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      {/* Label */}
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        {blueprint.input.label}
                        {blueprint.input.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                        {blueprint.regulatoryRef && (
                          <span className="ml-2 text-xs text-blue-600 font-normal">
                            ({blueprint.regulatoryRef})
                          </span>
                        )}
                      </label>

                      {/* Input based on type */}
                      <div className="flex flex-wrap gap-2">
                        {renderInput(blueprint, input?.value, (value) =>
                          handleInputChange(blueprint.id, value)
                        )}
                      </div>

                      {/* Result text */}
                      {result && result.status !== "NON_EVALUE" && (
                        <div
                          className={`mt-3 p-3 rounded-lg text-sm ${statusConfig.bg} ${statusConfig.border} border`}
                        >
                          <div className="font-medium mb-1 flex items-center gap-2">
                            <StatusIcon size={16} className={statusConfig.color} />
                            <span className={statusConfig.color}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <p className="text-gray-700">{result.reportText}</p>
                        </div>
                      )}

                      {/* Notes input for non-conform */}
                      {result?.status === "NON_CONFORME" && (
                        <input
                          type="text"
                          value={input?.notes || ""}
                          onChange={(e) =>
                            handleInputChange(
                              blueprint.id,
                              input?.value,
                              e.target.value
                            )
                          }
                          placeholder="Remarque supplémentaire..."
                          className="mt-2 w-full px-3 py-1.5 text-sm border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Render the appropriate input based on blueprint type
 */
function renderInput(
  blueprint: AuditItemBlueprint,
  value: unknown,
  onChange: (value: unknown) => void
) {
  const { input } = blueprint;

  switch (input.type) {
    case "SELECT":
      return (
        <>
          {input.options?.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                value === option.value
                  ? "bg-accent text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </>
      );

    case "BOOLEAN":
      return (
        <>
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              value === true
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700"
            }`}
          >
            Oui
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              value === false
                ? "bg-red-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700"
            }`}
          >
            Non
          </button>
        </>
      );

    case "NUMBER":
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value as number || ""}
            onChange={(e) =>
              onChange(e.target.value ? parseFloat(e.target.value) : null)
            }
            min={input.min}
            max={input.max}
            placeholder={input.placeholder}
            className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
          {input.unit && (
            <span className="text-sm text-gray-500">{input.unit}</span>
          )}
        </div>
      );

    case "DATE":
      return (
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-400" />
          <input
            type="date"
            value={value as string || ""}
            onChange={(e) => onChange(e.target.value || null)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>
      );

    case "TEXT":
      return (
        <input
          type="text"
          value={value as string || ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={input.placeholder}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      );

    case "PHOTO":
      return (
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <Camera size={18} />
          Ajouter une photo
        </button>
      );

    case "MULTI_SELECT":
      const selectedValues = (value as string[]) || [];
      return (
        <>
          {input.options?.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                const newValues = selectedValues.includes(option.value)
                  ? selectedValues.filter((v) => v !== option.value)
                  : [...selectedValues, option.value];
                onChange(newValues);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedValues.includes(option.value)
                  ? "bg-accent text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </>
      );

    default:
      return null;
  }
}
