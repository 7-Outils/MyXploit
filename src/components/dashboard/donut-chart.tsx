"use client";

import { useMemo } from "react";

interface DonutChartData {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutChartData[];
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  centerLabel?: string;
  centerValue?: string | number;
}

export function DonutChart({
  data,
  size = 160,
  strokeWidth = 24,
  showLegend = true,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data]
  );

  const segments = useMemo(() => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;

    return data.map((item) => {
      const percentage = total > 0 ? item.value / total : 0;
      const dashLength = circumference * percentage;
      const dashOffset = -currentOffset;
      currentOffset += dashLength;

      return {
        ...item,
        percentage,
        dashArray: `${dashLength} ${circumference - dashLength}`,
        dashOffset,
        radius,
      };
    });
  }, [data, size, strokeWidth, total]);

  const center = size / 2;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: size }}>
        <div
          className="rounded-full border-4 border-ink/10 flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          <span className="label-tech">Aucune donnée</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4">
      {/* Chart */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={(size - strokeWidth) / 2}
            fill="none"
            stroke="#0F1E33"
            strokeOpacity={0.08}
            strokeWidth={strokeWidth}
          />
          {/* Segments */}
          {segments.map((segment, index) => (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={segment.radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
              strokeLinecap="butt"
              className="transition-all duration-300"
            />
          ))}
        </svg>
        {/* Center text */}
        {(centerLabel || centerValue !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && (
              <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
                {centerValue}
              </span>
            )}
            {centerLabel && <span className="label-tech">{centerLabel}</span>}
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-col gap-2 min-w-[120px]">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink truncate">{segment.label}</div>
                <div className="font-mono text-xs tabular-nums text-ink/50">
                  {segment.value} ({Math.round(segment.percentage * 100)}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Palettes — thème « bureau d'études » : dégradé encre → accent, aucune
 * couleur décorative. Seul `equipmentStatus` garde des teintes sémantiques
 * (vert = OK, ambre = attention, rouge = panne).
 */
export const CHART_COLORS = {
  siteTypes: {
    LYCEE: "#2563EB",       // accent
    COLLEGE: "#0F1E33",     // encre
    ECOLE: "#60A5FA",       // accent clair
    MAIRIE: "#4A5568",      // encre atténuée
    HOPITAL: "#1E40AF",     // accent foncé
    GYMNASE: "#93C5FD",     // accent très clair
    PISCINE: "#334E68",     // encre moyenne
    MEDIATHEQUE: "#BFDBFE", // accent pâle
    AUTRE: "#94A3B8",       // gris neutre
  },
  energyTypes: {
    GAZ: "#2563EB",            // accent
    ELECTRICITE: "#0F1E33",    // encre
    FIOUL: "#4A5568",          // encre atténuée
    BOIS: "#60A5FA",           // accent clair
    RESEAU_CHALEUR: "#1E40AF", // accent foncé
    AUTRE: "#94A3B8",          // gris neutre
  },
  equipmentStatus: {
    OPERATIONNEL: "#16a34a",  // green-600
    MAINTENANCE: "#d97706",   // amber-600
    PANNE: "#dc2626",         // red-600
    HORS_SERVICE: "#94A3B8",  // gris neutre
  },
  prestations: {
    P1: "#0F1E33",  // encre
    P2: "#2563EB",  // accent
    P3: "#60A5FA",  // accent clair
    P4: "#94A3B8",  // gris neutre
  },
};
