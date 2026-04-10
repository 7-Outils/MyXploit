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
            className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors ${
              level > 0 ? "ml-6 border-l-2 border-gray-200" : ""
            }`}
          >
            {/* Expand/Collapse */}
            {hasChildren ? (
              <button
                onClick={() => onToggleMeter(meter.id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <div className="w-6" />
            )}

            {/* Icon */}
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                meter.type === "PRINCIPAL"
                  ? "bg-accent/10"
                  : meter.isDeductedFromParent
                  ? "bg-orange-50"
                  : "bg-gray-100"
              }`}
            >
              <FluidIcon
                size={20}
                className={
                  meter.type === "PRINCIPAL"
                    ? "text-accent"
                    : meter.isDeductedFromParent
                    ? "text-orange-500"
                    : "text-gray-500"
                }
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-primary-dark truncate">{meter.name}</p>
                {meter.type === "PRINCIPAL" && (
                  <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                    Principal
                  </span>
                )}
                {meter.isDeductedFromParent && (
                  <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    Déduit
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <span>{meterFluidLabels[meter.fluid]}</span>
                {meter.reference && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="font-mono text-xs">{meter.reference}</span>
                  </>
                )}
                <span className="text-gray-300">•</span>
                <span>{dataSourceLabels[meter.dataSource]}</span>
                {meter.conversionCoefficient && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span>
                      Q={meter.conversionCoefficient} {meter.conversionUnit}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Reading count */}
            <div className="text-right">
              <p className="text-sm font-medium text-primary-dark">
                {meter._count?.readings || 0}
              </p>
              <p className="text-xs text-text-secondary">relevés</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onAddReading(meter)}
                className="p-2 text-accent hover:bg-accent/10 rounded-lg transition-colors"
                title="Ajouter un relevé"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={() => onViewReadings(meter)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Historique des relevés"
              >
                <Activity size={16} />
              </button>
              <button
                onClick={() => onEditMeter(meter)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Modifier"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => onDeleteMeter(meter)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Supprimer"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Children */}
          {hasChildren && isExpanded && (
            <div className="mt-1">{renderMeterTree(meter.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return <div className="space-y-2">{renderMeterTree(meters)}</div>;
}
