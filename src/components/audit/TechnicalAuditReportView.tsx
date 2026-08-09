"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  MinusCircle,
  FileText,
  Banknote,
  Calendar,
  User,
  Building2,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Types
interface ChecklistItem {
  equipmentType: string;
  itemId: string;
  label: string;
  category: string;
  result: "CONFORME" | "NON_CONFORME" | "NA" | "NON_VERIFIE";
  notes?: string;
  conformeText?: string;
  nonConformeText?: string;
  regulatoryReference?: string;
}

interface Recommendation {
  id: string;
  templateId?: string;
  checklistItemKey?: string;
  title: string;
  description: string;
  estimatedCostMin: number | null;
  estimatedCostMax: number | null;
  priority: number;
  status: string;
  auditorNotes?: string;
}

interface TechnicalAudit {
  id: string;
  siteId: string;
  auditDate: string;
  auditor: string | null;
  checklistItems: ChecklistItem[];
  globalResult: "CONFORME" | "NON_CONFORME" | "PARTIEL" | "NON_VERIFIE";
  generalNotes: string | null;
  recommendations?: Recommendation[];
  createdAt: string;
}

interface Site {
  id: string;
  name: string;
  address?: string;
  city?: string;
  postalCode?: string;
}

interface Props {
  audit: TechnicalAudit;
  site: Site;
  categoryLabels: Record<string, string>;
  onGeneratePDF?: () => void;
  generatingPDF?: boolean;
}

const RESULT_CONFIG = {
  CONFORME: {
    label: "Conforme",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-600/20",
  },
  NON_CONFORME: {
    label: "Non conforme",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-600/20",
  },
  NA: {
    label: "Non applicable",
    icon: MinusCircle,
    color: "text-ink/50",
    bgColor: "bg-ink/[0.02]",
    borderColor: "border-ink/10",
  },
  NON_VERIFIE: {
    label: "Non vérifié",
    icon: AlertCircle,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-600/20",
  },
  PARTIEL: {
    label: "Partiellement conforme",
    icon: AlertCircle,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-600/20",
  },
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "Urgent",
  2: "Court terme",
  3: "Moyen terme",
  4: "Long terme",
};

export function TechnicalAuditReportView({
  audit,
  site,
  categoryLabels,
  onGeneratePDF,
  generatingPDF,
}: Props) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(
      audit.checklistItems
        .map((item) => item.category)
        .filter((v, i, a) => a.indexOf(v) === i)
    )
  );

  // Group items by category
  const itemsByCategory = audit.checklistItems.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, ChecklistItem[]>
  );

  // Calculate stats
  const stats = {
    conforme: audit.checklistItems.filter((i) => i.result === "CONFORME").length,
    nonConforme: audit.checklistItems.filter((i) => i.result === "NON_CONFORME").length,
    na: audit.checklistItems.filter((i) => i.result === "NA").length,
    nonVerifie: audit.checklistItems.filter((i) => i.result === "NON_VERIFIE").length,
    total: audit.checklistItems.length,
  };

  // Calculate total cost
  const totalCost = {
    min: (audit.recommendations || []).reduce(
      (sum, r) => sum + (r.estimatedCostMin || 0),
      0
    ),
    max: (audit.recommendations || []).reduce(
      (sum, r) => sum + (r.estimatedCostMax || 0),
      0
    ),
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

  const globalConfig = RESULT_CONFIG[audit.globalResult];
  const GlobalIcon = globalConfig.icon;

  return (
    <div className="bg-white border border-ink/10 overflow-hidden">
      {/* Header */}
      <div className="border-b border-ink/10 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label-tech">Rapport d&apos;audit technique</p>
            <h2 className="mt-1 text-base font-semibold text-ink">{site.name}</h2>
            {site.address && (
              <p className="text-sm text-ink/50">
                {site.address}
                {site.postalCode && `, ${site.postalCode}`}
                {site.city && ` ${site.city}`}
              </p>
            )}
          </div>
          {onGeneratePDF && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onGeneratePDF}
              disabled={generatingPDF}
            >
              <Download size={16} className="mr-2" />
              {generatingPDF ? "Génération..." : "Exporter PDF"}
            </Button>
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="px-4 py-3 border-b border-ink/10 bg-ink/[0.02]">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-ink/60">
            <Calendar size={16} />
            <span>
              {new Date(audit.auditDate).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          {audit.auditor && (
            <div className="flex items-center gap-2 text-ink/60">
              <User size={16} />
              <span>{audit.auditor}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-ink/60">
            <FileText size={16} />
            <span>{stats.total} points de contrôle</span>
          </div>
        </div>
      </div>

      {/* Global result */}
      <div className={`px-4 py-3 ${globalConfig.bgColor} border-b ${globalConfig.borderColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GlobalIcon size={24} className={globalConfig.color} />
            <div>
              <p className="text-sm text-ink/50">Résultat global</p>
              <p className={`text-lg font-semibold ${globalConfig.color}`}>
                {globalConfig.label}
              </p>
            </div>
          </div>
          <div className="flex divide-x divide-ink/15 text-sm">
            <div className="px-4 text-center first:pl-0 last:pr-0">
              <p className="font-mono text-base font-semibold tabular-nums text-green-700">{stats.conforme}</p>
              <p className="label-tech">Conforme</p>
            </div>
            <div className="px-4 text-center first:pl-0 last:pr-0">
              <p className="font-mono text-base font-semibold tabular-nums text-red-700">{stats.nonConforme}</p>
              <p className="label-tech">Non conforme</p>
            </div>
            <div className="px-4 text-center first:pl-0 last:pr-0">
              <p className="font-mono text-base font-semibold tabular-nums text-ink">{stats.na}</p>
              <p className="label-tech">N/A</p>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist items by category */}
      <div className="divide-y divide-ink/10">
        {Object.entries(itemsByCategory).map(([category, items]) => {
          const isExpanded = expandedCategories.has(category);
          const categoryStats = {
            conforme: items.filter((i) => i.result === "CONFORME").length,
            nonConforme: items.filter((i) => i.result === "NON_CONFORME").length,
          };

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-ink/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-ink">
                    {categoryLabels[category] || category}
                  </span>
                  <span className="text-sm text-ink/50">({items.length})</span>
                </div>
                <div className="flex items-center gap-4">
                  {categoryStats.conforme > 0 && (
                    <span className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-600/20">
                      {categoryStats.conforme} OK
                    </span>
                  )}
                  {categoryStats.nonConforme > 0 && (
                    <span className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-600/20">
                      {categoryStats.nonConforme} NOK
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp size={18} className="text-ink/40" />
                  ) : (
                    <ChevronDown size={18} className="text-ink/40" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {items.map((item) => {
                    const config = RESULT_CONFIG[item.result];
                    const Icon = config.icon;

                    return (
                      <div
                        key={`${item.equipmentType}-${item.itemId}`}
                        className={`p-3 border ${config.borderColor} ${config.bgColor}`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon size={18} className={`${config.color} mt-0.5 flex-shrink-0`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-ink">{item.label}</p>

                            {/* Afficher le texte de rapport */}
                            {item.result === "CONFORME" && item.conformeText && (
                              <p className="text-sm text-green-700 mt-1">{item.conformeText}</p>
                            )}
                            {item.result === "NON_CONFORME" && item.nonConformeText && (
                              <p className="text-sm text-red-700 mt-1">{item.nonConformeText}</p>
                            )}

                            {/* Référence réglementaire */}
                            {item.result === "NON_CONFORME" && item.regulatoryReference && (
                              <p className="text-xs text-ink/50 mt-1 italic">
                                Réf. : {item.regulatoryReference}
                              </p>
                            )}

                            {/* Notes de l'auditeur */}
                            {item.notes && (
                              <p className="text-sm text-ink/60 mt-1 bg-white/50 px-2 py-1">
                                Remarque : {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {audit.recommendations && audit.recommendations.length > 0 && (
        <div className="border-t border-ink/10">
          <div className="bg-orange-50 px-4 py-3 border-b border-orange-600/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Banknote size={20} className="text-orange-600" />
                <div>
                  <p className="font-semibold text-ink">
                    Préconisations ({audit.recommendations.length})
                  </p>
                  <p className="text-sm text-ink/60">
                    Actions correctives recommandées
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink/50">Estimation totale</p>
                <p className="text-lg font-semibold text-orange-600">
                  {totalCost.min === 0 && totalCost.max === 0 ? (
                    "À chiffrer"
                  ) : totalCost.min === totalCost.max ? (
                    `${totalCost.min.toLocaleString("fr-FR")} €`
                  ) : (
                    `${totalCost.min.toLocaleString("fr-FR")} - ${totalCost.max.toLocaleString("fr-FR")} €`
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-ink/10">
            {audit.recommendations.map((rec, index) => (
              <div key={rec.id} className="px-4 py-3">
                <div className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-50 text-orange-700 font-semibold flex items-center justify-center text-sm">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-medium text-ink">{rec.title}</h4>
                        <p className="text-sm text-ink/60 mt-1">{rec.description}</p>
                        {rec.auditorNotes && (
                          <p className="text-sm text-ink/50 mt-2 italic">
                            Note : {rec.auditorNotes}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span
                          className={`text-xs px-2 py-1 ${
                            rec.priority === 1
                              ? "bg-red-50 text-red-700"
                              : rec.priority === 2
                              ? "bg-orange-50 text-orange-700"
                              : rec.priority === 3
                              ? "bg-amber-50 text-amber-700"
                              : "bg-ink/5 text-ink/80"
                          }`}
                        >
                          {PRIORITY_LABELS[rec.priority] || "Moyen terme"}
                        </span>
                        <p className="text-sm font-medium text-ink mt-2">
                          {rec.estimatedCostMin === null && rec.estimatedCostMax === null ? (
                            "À chiffrer"
                          ) : rec.estimatedCostMin === rec.estimatedCostMax ? (
                            `${(rec.estimatedCostMin || 0).toLocaleString("fr-FR")} €`
                          ) : (
                            `${(rec.estimatedCostMin || 0).toLocaleString("fr-FR")} - ${(rec.estimatedCostMax || 0).toLocaleString("fr-FR")} €`
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General notes */}
      {audit.generalNotes && (
        <div className="px-4 py-3 border-t border-ink/10 bg-ink/[0.02]">
          <h3 className="label-tech mb-2">
            Observations générales
          </h3>
          <p className="text-sm text-ink/60 whitespace-pre-wrap">
            {audit.generalNotes}
          </p>
        </div>
      )}
    </div>
  );
}
