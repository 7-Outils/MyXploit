"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Info,
  AlertCircle,
} from "lucide-react";
import { ChartCard } from "@/components/dashboard/chart-card";
import type { ActionItem } from "@/components/energy/site-detail/types";

interface CorrectiveActionsProps {
  actions: ActionItem[];
}

export default function CorrectiveActions({ actions }: CorrectiveActionsProps) {
  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-ink/40" />
          Actions et recommandations
        </span>
      }
    >
      {actions.length > 0 ? (
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {actions.map((action) => (
            <div key={action.id} className="flex items-start gap-3 py-2.5">
              <div className="mt-0.5">
                {action.type === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                ) : action.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : action.type === "action" ? (
                  <Wrench className="h-4 w-4 text-amber-600" />
                ) : (
                  <Info className="h-4 w-4 text-ink/40" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-ink">{action.title}</h4>
                  {action.priority === "high" && (
                    <span className="border border-red-600/20 bg-red-50 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest text-red-700">
                      Prioritaire
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {action.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="mb-2 h-6 w-6 text-green-600" />
          <p className="text-sm font-medium text-ink">Tout est en ordre</p>
          <p className="text-sm text-text-secondary">
            Aucune action corrective nécessaire pour ce site.
          </p>
        </div>
      )}
    </ChartCard>
  );
}
