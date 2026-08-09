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
        className={`relative w-64 border ${colors.border} ${colors.bg} transition-colors hover:border-accent`}
      >
        {/* Cartouche : fluide + type */}
        <div className={`flex items-center gap-2 border-b ${colors.border} px-3 py-2`}>
          <FluidIcon size={16} className={colors.icon} />
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
            {meterFluidLabels[meter.fluid]}
          </span>
          {meter.type === "PRINCIPAL" && (
            <span className="ml-auto border border-accent/30 bg-accent/[0.06] px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest text-accent">
              Principal
            </span>
          )}
          {meter.isDeductedFromParent && (
            <span className="ml-auto border border-orange-600/20 bg-orange-50 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest text-orange-700">
              Déduit
            </span>
          )}
        </div>

        <div className="p-3">
          <p className={`truncate text-sm font-semibold ${colors.text}`}>{meter.name}</p>
          {meter.reference && (
            <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-ink/50">
              {meter.reference}
            </p>
          )}

          {/* Stats */}
          <div className="mt-2 flex items-center justify-between border-t border-ink/10 pt-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
              <span className="tabular-nums text-ink">{meter._count?.readings || 0}</span> relevés
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
              {meter.unit}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end border-t border-ink/10">
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
            title="Historique"
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

      {/* Children with connector lines */}
      {hasChildren && (
        <div className="flex flex-col items-center">
          {/* Vertical line down */}
          <div className="h-6 w-px bg-ink/15" />

          {/* Horizontal connector and children */}
          <div className="relative">
            {meter.children!.length > 1 && (
              <div
                className="absolute top-0 left-1/2 h-px -translate-x-1/2 bg-ink/15"
                style={{
                  width: `calc(${(meter.children!.length - 1) * 280}px)`,
                }}
              />
            )}
            <div className="flex gap-4 pt-0">
              {meter.children!.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  {/* Vertical line to child */}
                  <div className="h-6 w-px bg-ink/15" />
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
        <div className="border-t border-ink/10 pt-4">
          <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-widest text-ink/50">
            Compteurs indépendants
          </p>
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
