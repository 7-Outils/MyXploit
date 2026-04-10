"use client";

import {
  Plus,
  Activity,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Meter } from "./types";
import { meterFluidIcons, meterFluidColors, meterFluidLabels } from "./constants";

interface MeterFlowchartProps {
  meters: Meter[];
  onCreateMeter: () => void;
  onEditMeter: (meter: Meter) => void;
  onDeleteMeter: (meter: Meter) => void;
  onAddReading: (meter: Meter) => void;
  onViewReadings: (meter: Meter) => void;
}

function MeterCard({
  meter,
  onEditMeter,
  onDeleteMeter,
  onAddReading,
  onViewReadings,
}: {
  meter: Meter;
  onEditMeter: (meter: Meter) => void;
  onDeleteMeter: (meter: Meter) => void;
  onAddReading: (meter: Meter) => void;
  onViewReadings: (meter: Meter) => void;
}) {
  const FluidIcon = meterFluidIcons[meter.fluid] || Activity;
  const colors = meterFluidColors[meter.fluid] || meterFluidColors.GAZ;
  const hasChildren = meter.children && meter.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Meter Card */}
      <div
        className={`relative w-64 rounded-xl border-2 ${colors.border} ${colors.bg} p-4 shadow-sm hover:shadow-md transition-shadow`}
      >
        {/* Type badge */}
        {meter.type === "PRINCIPAL" && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-medium px-3 py-1 rounded-full">
            Principal
          </div>
        )}
        {meter.isDeductedFromParent && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-medium px-3 py-1 rounded-full">
            Déduit
          </div>
        )}

        {/* Header with icon */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center`}>
            <FluidIcon size={20} className={colors.icon} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold ${colors.text} truncate`}>{meter.name}</p>
            <p className="text-xs text-gray-500">{meterFluidLabels[meter.fluid]}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm mb-3 px-2 py-1.5 bg-white/60 rounded-lg">
          <span className="text-gray-600">{meter._count?.readings || 0} relevés</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">{meter.unit}</span>
        </div>

        {/* Reference if exists */}
        {meter.reference && (
          <p className="text-xs font-mono text-gray-500 text-center mb-2">{meter.reference}</p>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-1 pt-2 border-t border-gray-200/50">
          <button
            onClick={() => onAddReading(meter)}
            className="p-1.5 text-accent hover:bg-white rounded-lg transition-colors"
            title="Ajouter un relevé"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => onViewReadings(meter)}
            className="p-1.5 text-gray-500 hover:bg-white rounded-lg transition-colors"
            title="Historique"
          >
            <Activity size={16} />
          </button>
          <button
            onClick={() => onEditMeter(meter)}
            className="p-1.5 text-gray-500 hover:bg-white rounded-lg transition-colors"
            title="Modifier"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => onDeleteMeter(meter)}
            className="p-1.5 text-red-500 hover:bg-white rounded-lg transition-colors"
            title="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Children with connector lines */}
      {hasChildren && (
        <div className="flex flex-col items-center">
          {/* Vertical line down */}
          <div className="w-0.5 h-6 bg-gray-300" />

          {/* Horizontal connector and children */}
          <div className="relative">
            {meter.children!.length > 1 && (
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 bg-gray-300"
                style={{
                  width: `calc(${(meter.children!.length - 1) * 280}px)`,
                }}
              />
            )}
            <div className="flex gap-4 pt-0">
              {meter.children!.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  {/* Vertical line to child */}
                  <div className="w-0.5 h-6 bg-gray-300" />
                  <MeterCard
                    meter={child}
                    onEditMeter={onEditMeter}
                    onDeleteMeter={onDeleteMeter}
                    onAddReading={onAddReading}
                    onViewReadings={onViewReadings}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MeterFlowchart({
  meters,
  onEditMeter,
  onDeleteMeter,
  onAddReading,
  onViewReadings,
}: MeterFlowchartProps) {
  const principalWithChildren = meters.filter(m => m.type === "PRINCIPAL");
  const orphanDivisionnaires = meters.filter(m => m.type === "DIVISIONNAIRE" && !m.parentId);

  return (
    <div className="space-y-8 overflow-x-auto pb-4">
      {/* Principal meters with their children */}
      {principalWithChildren.length > 0 && (
        <div className="flex flex-wrap gap-8 justify-center">
          {principalWithChildren.map(meter => (
            <MeterCard
              key={meter.id}
              meter={meter}
              onEditMeter={onEditMeter}
              onDeleteMeter={onDeleteMeter}
              onAddReading={onAddReading}
              onViewReadings={onViewReadings}
            />
          ))}
        </div>
      )}

      {/* Orphan divisionnaires */}
      {orphanDivisionnaires.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center mb-4">Compteurs indépendants</p>
          <div className="flex flex-wrap gap-4 justify-center">
            {orphanDivisionnaires.map(meter => (
              <MeterCard
                key={meter.id}
                meter={meter}
                onEditMeter={onEditMeter}
                onDeleteMeter={onDeleteMeter}
                onAddReading={onAddReading}
                onViewReadings={onViewReadings}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
