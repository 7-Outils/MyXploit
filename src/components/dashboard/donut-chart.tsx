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
          className="rounded-full border-4 border-gray-100 flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          <span className="text-gray-400 text-sm">Aucune donnée</span>
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
            stroke="#f3f4f6"
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
              <span className="text-2xl font-bold text-primary-dark">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-xs text-text-secondary">{centerLabel}</span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-col gap-2 min-w-[120px]">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-primary-dark truncate">
                  {segment.label}
                </div>
                <div className="text-xs text-text-secondary">
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

// Predefined color palettes
export const CHART_COLORS = {
  siteTypes: {
    LYCEE: "#3b82f6",     // blue
    COLLEGE: "#8b5cf6",   // violet
    ECOLE: "#06b6d4",     // cyan
    MAIRIE: "#f59e0b",    // amber
    HOPITAL: "#ef4444",   // red
    GYMNASE: "#22c55e",   // green
    PISCINE: "#0ea5e9",   // sky
    MEDIATHEQUE: "#a855f7", // purple
    AUTRE: "#6b7280",     // gray
  },
  energyTypes: {
    GAZ: "#f59e0b",       // amber
    ELECTRICITE: "#3b82f6", // blue
    FIOUL: "#78716c",     // stone
    BOIS: "#84cc16",      // lime
    RESEAU_CHALEUR: "#ef4444", // red
    AUTRE: "#6b7280",     // gray
  },
  equipmentStatus: {
    OPERATIONNEL: "#22c55e",  // green
    MAINTENANCE: "#f59e0b",   // amber
    PANNE: "#ef4444",         // red
    HORS_SERVICE: "#6b7280",  // gray
  },
  prestations: {
    P1: "#3b82f6",  // blue
    P2: "#8b5cf6",  // violet
    P3: "#06b6d4",  // cyan
    P4: "#22c55e",  // green
  },
};
