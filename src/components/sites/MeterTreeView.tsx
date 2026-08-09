"use client";

import {
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Activity,
} from "lucide-react";
import type { Meter } from "./types";
import { meterFluidIcons, meterFluidLabels, dataSourceLabels } from "./constants";

interface MeterTreeViewProps {
  meters: Meter[];
  expandedMeters: Set<string>;
  onToggleMeter: (meterId: string) => void;
  onCreateMeter: () => void;
  onEditMeter: (meter: Meter) => void;
  onDeleteMeter: (meter: Meter) => void;
  onAddReading: (meter: Meter) => void;
  onViewReadings: (meter: Meter) => void;
}

export function MeterTreeView({
  meters,
  expandedMeters,
  onToggleMeter,
  onEditMeter,
  onDeleteMeter,
  onAddReading,
  onViewReadings,
}: MeterTreeViewProps) {
  const renderMeterTree = (meterList: Meter[], level = 0) => {
    return meterList.map((meter) => {
      const hasChildren = meter.children && meter.children.length > 0;
      const isExpanded = expandedMeters.has(meter.id);
      const FluidIcon = meterFluidIcons[meter.fluid] || Activity;

      return (
        <div key={meter.id}>
          <div
            className={`flex items-center gap-3 border border-ink/10 bg-white px-3 py-2 transition-colors hover:bg-ink/[0.02] ${
              level > 0 ? "ml-6 border-l border-l-ink/20" : ""
            }`}
          >
            {/* Expand/Collapse */}
            {hasChildren ? (
              <button
                onClick={() => onToggleMeter(meter.id)}
                className="flex h-6 w-6 items-center justify-center text-ink/50 transition-colors hover:text-accent"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <div className="w-6" />
            )}

            {/* Icon */}
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-ink/15 bg-white">
              <FluidIcon
                size={16}
                className={
                  meter.type === "PRINCIPAL"
                    ? "text-accent"
                    : meter.isDeductedFromParent
                    ? "text-orange-600"
                    : "text-ink/50"
                }
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-ink">{meter.name}</p>
                {meter.type === "PRINCIPAL" && (
                  <span className="border border-accent/30 bg-accent/[0.06] px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest text-accent">
                    Principal
                  </span>
                )}
                {meter.isDeductedFromParent && (
                  <span className="border border-orange-600/20 bg-orange-50 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest text-orange-700">
                    Déduit
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-ink/50">
                <span>{meterFluidLabels[meter.fluid]}</span>
                {meter.reference && (
                  <>
                    <span className="text-ink/20">·</span>
                    <span className="tabular-nums normal-case tracking-normal">
                      {meter.reference}
                    </span>
                  </>
                )}
                <span className="text-ink/20">·</span>
                <span>{dataSourceLabels[meter.dataSource]}</span>
                {meter.conversionCoefficient && (
                  <>
                    <span className="text-ink/20">·</span>
                    <span className="tabular-nums">
                      Q={meter.conversionCoefficient} {meter.conversionUnit}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Reading count */}
            <div className="text-right">
              <p className="font-mono text-sm tabular-nums text-ink">
                {meter._count?.readings || 0}
              </p>
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
                relevés
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center">
              <button
                onClick={() => onAddReading(meter)}
                className="flex h-9 w-9 items-center justify-center text-ink/50 transition-colors hover:bg-ink/[0.03] hover:text-accent"
                title="Ajouter un relevé"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={() => onViewReadings(meter)}
                className="flex h-9 w-9 items-center justify-center text-ink/50 transition-colors hover:bg-ink/[0.03] hover:text-accent"
                title="Historique des relevés"
              >
                <Activity size={16} />
              </button>
              <button
                onClick={() => onEditMeter(meter)}
                className="flex h-9 w-9 items-center justify-center text-ink/50 transition-colors hover:bg-ink/[0.03] hover:text-accent"
                title="Modifier"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => onDeleteMeter(meter)}
                className="flex h-9 w-9 items-center justify-center text-ink/50 transition-colors hover:bg-ink/[0.03] hover:text-red-600"
                title="Supprimer"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Children */}
          {hasChildren && isExpanded && (
            <div className="mt-1 space-y-1">{renderMeterTree(meter.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return <div className="space-y-1">{renderMeterTree(meters)}</div>;
}
