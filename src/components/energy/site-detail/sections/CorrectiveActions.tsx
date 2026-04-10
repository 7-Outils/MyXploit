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
          <AlertCircle className="h-5 w-5 text-accent" />
          Actions et recommandations
        </span>
      }
    >
      {actions.length > 0 ? (
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className={`flex items-start gap-3 p-4 rounded-lg border ${
                action.type === "warning"
                  ? "bg-red-50 border-red-200"
                  : action.type === "success"
                    ? "bg-green-50 border-green-200"
                    : action.type === "action"
                      ? "bg-amber-50 border-amber-200"
                      : "bg-blue-50 border-blue-200"
              }`}
            >
              <div className="mt-0.5">
                {action.type === "warning" ? (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                ) : action.type === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : action.type === "action" ? (
                  <Wrench className="h-5 w-5 text-amber-500" />
                ) : (
                  <Info className="h-5 w-5 text-blue-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{action.title}</h4>
                  {action.priority === "high" && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">Prioritaire</span>
                  )}
                </div>
                <p className="text-sm text-text-secondary mt-1">
                  {action.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
          <p className="font-medium">Tout est en ordre</p>
          <p className="text-sm text-text-secondary">
            Aucune action corrective nécessaire pour ce site.
          </p>
        </div>
      )}
    </ChartCard>
  );
}
