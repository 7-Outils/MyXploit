/**
 * Audit Engine - Data-Driven Form & Rule System
 *
 * This module implements a configurable audit system where:
 * - Admin defines "Audit Blueprints" (questions, logic, report text) in database
 * - The App renders these blueprints dynamically
 * - Logic rules are stored as JsonLogic expressions
 */

import jsonLogic from "json-logic-js";

// ============================================================================
// TYPESCRIPT INTERFACES - THE BLUEPRINT
// ============================================================================

/**
 * Input configuration - What the user sees
 */
export interface InputConfig {
  type: "SELECT" | "NUMBER" | "TEXT" | "DATE" | "PHOTO" | "BOOLEAN" | "MULTI_SELECT";
  label: string;
  placeholder?: string;
  required?: boolean;
  // For SELECT/MULTI_SELECT
  options?: Array<{
    value: string;
    label: string;
  }>;
  // For NUMBER
  min?: number;
  max?: number;
  unit?: string;
  // For DATE
  dateFormat?: string;
}

/**
 * Context variables - Data from the system (equipment, site, etc.)
 */
export interface ContextVariable {
  key: string;           // e.g., "boiler_power"
  label: string;         // e.g., "Puissance chaudière"
  source: "EQUIPMENT" | "SITE" | "CONTRACT" | "MANUAL";
  dataType: "NUMBER" | "STRING" | "BOOLEAN" | "DATE";
  unit?: string;
}

/**
 * Logic rule using JsonLogic format
 * See: https://jsonlogic.com/
 */
export interface LogicRule {
  id: string;
  name: string;
  // JsonLogic condition - evaluated against { input, context }
  condition: object;
  // Result when condition is TRUE
  result: {
    status: "CONFORME" | "NON_CONFORME" | "AVERTISSEMENT" | "NA";
    reportText: string;        // Text for the report
    shortText?: string;        // Short summary
    recommendationId?: string; // Link to a recommendation from library
    severity?: number;         // 1=Critical, 2=Major, 3=Minor
  };
}

/**
 * Complete Audit Item Blueprint
 */
export interface AuditItemBlueprint {
  id: string;
  code: string;                    // e.g., "DISCO_TYPE"
  category: string;                // e.g., "REGLEMENTAIRE"
  subcategory?: string;

  // What the user sees
  input: InputConfig;

  // Context variables needed for evaluation
  contextVariables?: ContextVariable[];

  // Logic rules (evaluated in order, first match wins)
  rules: LogicRule[];

  // Default result if no rule matches
  defaultResult: {
    status: "CONFORME" | "NON_CONFORME" | "AVERTISSEMENT" | "NA" | "NON_EVALUE";
    reportText: string;
  };

  // Regulatory reference
  regulatoryRef?: string;

  // Order in the checklist
  sortOrder: number;
  isActive: boolean;
}

/**
 * User input from the technician
 */
export interface UserInput {
  itemId: string;
  value: string | number | boolean | string[] | null;
  notes?: string;
  photos?: string[];
  timestamp?: Date;
}

/**
 * Evaluation context (data from the system)
 */
export interface EvaluationContext {
  // Equipment data
  equipment?: {
    type?: string;
    power?: number;
    brand?: string;
    model?: string;
    installationDate?: string;
    [key: string]: unknown;
  };
  // Site data
  site?: {
    name?: string;
    address?: string;
    buildingType?: string;
    [key: string]: unknown;
  };
  // Contract data
  contract?: {
    type?: string;
    [key: string]: unknown;
  };
  // Any additional context
  [key: string]: unknown;
}

/**
 * Evaluation result
 */
export interface EvaluationResult {
  itemId: string;
  status: "CONFORME" | "NON_CONFORME" | "AVERTISSEMENT" | "NA" | "NON_EVALUE";
  reportText: string;
  shortText?: string;
  matchedRuleId?: string;
  recommendationId?: string;
  severity?: number;
  input: {
    value: unknown;
    notes?: string;
  };
}

// ============================================================================
// THE EVALUATION ENGINE - THE "BRAIN"
// ============================================================================

/**
 * Evaluate a single audit item against user input and context
 */
export function evaluateAuditItem(
  blueprint: AuditItemBlueprint,
  userInput: UserInput,
  context: EvaluationContext
): EvaluationResult {
  // Build the data object for JsonLogic evaluation
  const data = {
    input: userInput.value,
    context: {
      // Flatten context for easier access in rules
      ...context.equipment,
      ...context.site,
      ...context.contract,
      ...context,
    },
  };

  // Evaluate rules in order (first match wins)
  for (const rule of blueprint.rules) {
    try {
      const matches = jsonLogic.apply(rule.condition, data);

      if (matches) {
        return {
          itemId: blueprint.id,
          status: rule.result.status,
          reportText: interpolateText(rule.result.reportText, data),
          shortText: rule.result.shortText
            ? interpolateText(rule.result.shortText, data)
            : undefined,
          matchedRuleId: rule.id,
          recommendationId: rule.result.recommendationId,
          severity: rule.result.severity,
          input: {
            value: userInput.value,
            notes: userInput.notes,
          },
        };
      }
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
    }
  }

  // No rule matched, return default
  return {
    itemId: blueprint.id,
    status: blueprint.defaultResult.status,
    reportText: interpolateText(blueprint.defaultResult.reportText, data),
    input: {
      value: userInput.value,
      notes: userInput.notes,
    },
  };
}

/**
 * Evaluate multiple audit items
 */
export function evaluateAudit(
  blueprints: AuditItemBlueprint[],
  userInputs: UserInput[],
  context: EvaluationContext
): EvaluationResult[] {
  const inputMap = new Map(userInputs.map((i) => [i.itemId, i]));

  return blueprints
    .filter((bp) => bp.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((blueprint) => {
      const input = inputMap.get(blueprint.id);

      if (!input || input.value === null || input.value === undefined) {
        return {
          itemId: blueprint.id,
          status: "NON_EVALUE" as const,
          reportText: "Point non évalué",
          input: { value: null },
        };
      }

      return evaluateAuditItem(blueprint, input, context);
    });
}

/**
 * Generate the complete audit report
 */
export function generateAuditReport(
  results: EvaluationResult[],
  blueprints: AuditItemBlueprint[]
): {
  summary: {
    total: number;
    conforme: number;
    nonConforme: number;
    avertissement: number;
    na: number;
    nonEvalue: number;
  };
  byCategory: Record<string, EvaluationResult[]>;
  recommendations: string[];
  globalStatus: "CONFORME" | "NON_CONFORME" | "PARTIEL";
} {
  const blueprintMap = new Map(blueprints.map((b) => [b.id, b]));

  // Count statuses
  const summary = {
    total: results.length,
    conforme: results.filter((r) => r.status === "CONFORME").length,
    nonConforme: results.filter((r) => r.status === "NON_CONFORME").length,
    avertissement: results.filter((r) => r.status === "AVERTISSEMENT").length,
    na: results.filter((r) => r.status === "NA").length,
    nonEvalue: results.filter((r) => r.status === "NON_EVALUE").length,
  };

  // Group by category
  const byCategory: Record<string, EvaluationResult[]> = {};
  for (const result of results) {
    const blueprint = blueprintMap.get(result.itemId);
    const category = blueprint?.category || "AUTRE";
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(result);
  }

  // Collect recommendations
  const recommendations = results
    .filter((r) => r.recommendationId)
    .map((r) => r.recommendationId as string);

  // Determine global status
  let globalStatus: "CONFORME" | "NON_CONFORME" | "PARTIEL" = "CONFORME";
  if (summary.nonConforme > 0) {
    globalStatus = summary.conforme > 0 ? "PARTIEL" : "NON_CONFORME";
  }

  return {
    summary,
    byCategory,
    recommendations,
    globalStatus,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Interpolate variables in text templates
 * Supports: {{input}}, {{context.power}}, etc.
 */
function interpolateText(
  template: string,
  data: { input: unknown; context: Record<string, unknown> }
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const keys = path.split(".");
    let value: unknown = data;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return match; // Keep original if path not found
      }
    }

    return String(value ?? match);
  });
}

// ============================================================================
// EXAMPLE: DISCONNECTEUR CVC (BACKFLOW PREVENTER)
// ============================================================================

export const EXAMPLE_DISCONNECTEUR_BLUEPRINT: AuditItemBlueprint = {
  id: "disco_type_check",
  code: "DISCO_TYPE",
  category: "REGLEMENTAIRE",
  subcategory: "Protection sanitaire",

  input: {
    type: "SELECT",
    label: "Type de disconnecteur installé",
    required: true,
    options: [
      { value: "BA", label: "BA - Disconnecteur à zone de pression réduite" },
      { value: "CA", label: "CA - Disconnecteur à zone de pression contrôlable" },
      { value: "EA", label: "EA - Disconnecteur à échappement d'air" },
      { value: "NONE", label: "Aucun disconnecteur" },
    ],
  },

  contextVariables: [
    {
      key: "boiler_power",
      label: "Puissance chaudière",
      source: "EQUIPMENT",
      dataType: "NUMBER",
      unit: "kW",
    },
  ],

  rules: [
    // Rule 1: Power > 70kW requires BA type
    {
      id: "rule_high_power_no_ba",
      name: "Puissance > 70kW sans BA",
      condition: {
        "and": [
          { ">": [{ "var": "context.power" }, 70] },
          { "!=": [{ "var": "input" }, "BA"] }
        ]
      },
      result: {
        status: "NON_CONFORME",
        reportText: "Le disconnecteur de type BA est obligatoire pour les installations de puissance supérieure à 70kW. Puissance actuelle: {{context.power}}kW. Type installé: {{input}}.",
        shortText: "BA obligatoire (>70kW)",
        recommendationId: "reco_install_ba",
        severity: 1,
      },
    },
    // Rule 2: No disconnector at all
    {
      id: "rule_no_disconnector",
      name: "Aucun disconnecteur",
      condition: {
        "==": [{ "var": "input" }, "NONE"]
      },
      result: {
        status: "NON_CONFORME",
        reportText: "Aucun disconnecteur n'est installé. Un dispositif de protection contre les retours d'eau est obligatoire conformément à la réglementation sanitaire.",
        shortText: "Disconnecteur absent",
        recommendationId: "reco_install_disconnector",
        severity: 1,
      },
    },
    // Rule 3: BA installed - always OK
    {
      id: "rule_ba_ok",
      name: "BA installé",
      condition: {
        "==": [{ "var": "input" }, "BA"]
      },
      result: {
        status: "CONFORME",
        reportText: "Disconnecteur de type BA correctement installé, conforme aux exigences réglementaires.",
        shortText: "BA conforme",
      },
    },
    // Rule 4: CA/EA for low power is OK
    {
      id: "rule_ca_ea_low_power",
      name: "CA/EA pour faible puissance",
      condition: {
        "and": [
          { "<=": [{ "var": "context.power" }, 70] },
          { "in": [{ "var": "input" }, ["CA", "EA"]] }
        ]
      },
      result: {
        status: "CONFORME",
        reportText: "Disconnecteur de type {{input}} installé. Adapté pour une installation de {{context.power}}kW.",
        shortText: "{{input}} conforme",
      },
    },
  ],

  defaultResult: {
    status: "AVERTISSEMENT",
    reportText: "Type de disconnecteur non reconnu ou situation non couverte par les règles. Vérification manuelle requise.",
  },

  regulatoryRef: "Arrêté du 10 septembre 2021 - Art. 16.3",
  sortOrder: 10,
  isActive: true,
};

// ============================================================================
// EXAMPLE: ANALYSE COMBUSTION
// ============================================================================

export const EXAMPLE_COMBUSTION_BLUEPRINT: AuditItemBlueprint = {
  id: "combustion_analysis",
  code: "COMB_ANALYSIS",
  category: "PERIODIQUE",
  subcategory: "Rendement",

  input: {
    type: "BOOLEAN",
    label: "Analyse de combustion réalisée",
    required: true,
  },

  contextVariables: [],

  rules: [
    {
      id: "rule_no_analysis",
      name: "Analyse non réalisée",
      condition: {
        "==": [{ "var": "input" }, false]
      },
      result: {
        status: "NON_CONFORME",
        reportText: "L'analyse de combustion n'a pas été réalisée. Cette vérification est obligatoire annuellement.",
        shortText: "Analyse combustion manquante",
        recommendationId: "reco_combustion_analysis",
        severity: 2,
      },
    },
    {
      id: "rule_analysis_done",
      name: "Analyse réalisée",
      condition: {
        "==": [{ "var": "input" }, true]
      },
      result: {
        status: "CONFORME",
        reportText: "Analyse de combustion réalisée.",
        shortText: "Analyse OK",
      },
    },
  ],

  defaultResult: {
    status: "NON_EVALUE",
    reportText: "Information non renseignée.",
  },

  regulatoryRef: "Arrêté du 24 juillet 2020",
  sortOrder: 20,
  isActive: true,
};
