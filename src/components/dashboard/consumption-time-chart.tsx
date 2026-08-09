"use client";

import { useMemo, useState } from "react";

/**
 * ConsumptionTimeChart — Pure SVG line/bar chart for consumption over time.
 *
 * Designed for daily Gazpar / Linky readings (up to ~1100 points).
 * Auto-aggregates to weekly or monthly buckets when the time range is large
 * to keep the chart readable.
 *
 * Zero external dependencies — matches the existing project style
 * (DonutChart, SimpleBarChart, StackedBarChart all custom SVG).
 */

export interface ConsumptionPoint {
  /** ISO date string (YYYY-MM-DD or full timestamp) */
  date: string;
  /** Consumption value in kWh for the period starting at `date` */
  kwh: number;
}

interface ConsumptionTimeChartProps {
  data: ConsumptionPoint[];
  /** Color of the bars (hex). Defaults to l'accent unique du thème. */
  color?: string;
  /** Chart height in pixels (excluding labels). */
  height?: number;
  /** Unit shown next to values (kWh or MWh — auto-converts when ≥ 5 MWh) */
  forceUnit?: "kWh" | "MWh";
}

type Granularity = "day" | "week" | "month";

interface Bucket {
  key: string;
  label: string;
  date: Date;
  total: number;
}

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function aggregate(data: ConsumptionPoint[], granularity: Granularity): Bucket[] {
  const map = new Map<string, Bucket>();

  for (const p of data) {
    const d = new Date(p.date);
    if (Number.isNaN(d.getTime())) continue;

    let key: string;
    let bucketDate: Date;
    let label: string;

    if (granularity === "day") {
      bucketDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      key = bucketDate.toISOString().split("T")[0];
      label = formatDay(bucketDate);
    } else if (granularity === "week") {
      bucketDate = startOfWeek(d);
      key = bucketDate.toISOString().split("T")[0];
      label = `Sem. ${formatDay(bucketDate)}`;
    } else {
      bucketDate = new Date(d.getFullYear(), d.getMonth(), 1);
      key = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, "0")}`;
      label = formatMonth(bucketDate);
    }

    const existing = map.get(key);
    if (existing) {
      existing.total += p.kwh;
    } else {
      map.set(key, { key, label, date: bucketDate, total: p.kwh });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

function pickGranularity(pointCount: number): Granularity {
  if (pointCount <= 60) return "day";
  if (pointCount <= 365) return "week";
  return "month";
}

export function ConsumptionTimeChart({
  data,
  color = "#2563EB",
  height = 320,
  forceUnit,
}: ConsumptionTimeChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const granularity = useMemo(() => pickGranularity(data.length), [data.length]);
  const buckets = useMemo(() => aggregate(data, granularity), [data, granularity]);

  const totals = useMemo(() => {
    const sum = buckets.reduce((acc, b) => acc + b.total, 0);
    const max = buckets.reduce((acc, b) => Math.max(acc, b.total), 0);
    return { sum, max };
  }, [buckets]);

  // Auto-convert kWh → MWh when total is large
  const useMwh = forceUnit === "MWh" || (forceUnit !== "kWh" && totals.sum >= 5000);
  const displayUnit = useMwh ? "MWh" : "kWh";
  const divisor = useMwh ? 1000 : 1;
  const formatValue = (kwh: number) =>
    useMwh
      ? `${(kwh / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} MWh`
      : `${Math.round(kwh).toLocaleString("fr-FR")} kWh`;

  if (buckets.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center w-full text-ink/40"
        style={{ height }}
      >
        <p className="text-sm">Aucune donnée pour la période sélectionnée</p>
      </div>
    );
  }

  // SVG layout
  const padTop = 16;
  const padBottom = 36;
  const padLeft = 56;
  const padRight = 16;
  const innerHeight = height - padTop - padBottom;
  const baseWidth = 800;
  const innerWidth = baseWidth - padLeft - padRight;

  // Bar width — leave 2px gap between bars
  const slot = innerWidth / buckets.length;
  const barWidth = Math.max(2, slot - 2);

  // Y axis — 5 grid lines
  const yMax = totals.max > 0 ? totals.max : 1;
  const yTicks = 5;
  const yStep = yMax / yTicks;

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${baseWidth} ${height}`}
          className="w-full"
          style={{ minWidth: buckets.length > 30 ? `${baseWidth}px` : "100%", height }}
          preserveAspectRatio="none"
        >
          {/* Grid lines + Y axis labels */}
          {Array.from({ length: yTicks + 1 }).map((_, i) => {
            const y = padTop + (innerHeight * i) / yTicks;
            const v = (yMax - i * yStep) / divisor;
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={baseWidth - padRight}
                  y2={y}
                  stroke="#0F1E33"
                  strokeOpacity={i === yTicks ? 0.15 : 0.08}
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#0F1E33"
                  fillOpacity={0.5}
                  style={{ fontSize: "10px", fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
                >
                  {useMwh
                    ? v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })
                    : Math.round(v).toLocaleString("fr-FR")}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {buckets.map((b, i) => {
            const barH = (b.total / yMax) * innerHeight;
            const x = padLeft + i * slot + (slot - barWidth) / 2;
            const y = padTop + innerHeight - barH;
            const isHover = hoverIndex === i;
            return (
              <g key={b.key}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barH, 1)}
                  fill={color}
                  opacity={isHover ? 1 : 0.85}
                />
                {/* Hit area for hover */}
                <rect
                  x={padLeft + i * slot}
                  y={padTop}
                  width={slot}
                  height={innerHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                  style={{ cursor: "pointer" }}
                />
              </g>
            );
          })}

          {/* X axis labels — show ~8 labels max regardless of bucket count */}
          {(() => {
            const maxLabels = 8;
            const step = Math.max(1, Math.ceil(buckets.length / maxLabels));
            return buckets.map((b, i) => {
              if (i % step !== 0 && i !== buckets.length - 1) return null;
              const x = padLeft + i * slot + slot / 2;
              return (
                <text
                  key={`lbl-${b.key}`}
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  fill="#0F1E33"
                  fillOpacity={0.5}
                  style={{ fontSize: "10px", fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
                >
                  {b.label}
                </text>
              );
            });
          })()}

          {/* Hover tooltip */}
          {hoverIndex !== null && buckets[hoverIndex] && (
            <g pointerEvents="none">
              {(() => {
                const b = buckets[hoverIndex];
                const x = padLeft + hoverIndex * slot + slot / 2;
                const tipW = 140;
                const tipH = 38;
                const tipX = Math.max(
                  padLeft,
                  Math.min(x - tipW / 2, baseWidth - padRight - tipW)
                );
                const tipY = padTop + 4;
                return (
                  <>
                    <rect
                      x={tipX}
                      y={tipY}
                      width={tipW}
                      height={tipH}
                      fill="#0F1E33"
                      opacity={0.96}
                    />
                    <text
                      x={tipX + tipW / 2}
                      y={tipY + 15}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      style={{ fontSize: "11px", fontWeight: 600 }}
                    >
                      {b.label}
                    </text>
                    <text
                      x={tipX + tipW / 2}
                      y={tipY + 30}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fillOpacity={0.75}
                      style={{ fontSize: "11px", fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
                    >
                      {formatValue(b.total)}
                    </text>
                  </>
                );
              })()}
            </g>
          )}
        </svg>
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between mt-2 border-t border-ink/10 px-1 pt-2 text-xs text-ink/50">
        <span className="label-tech">
          {buckets.length}{" "}
          {granularity === "day"
            ? "jour(s)"
            : granularity === "week"
            ? "semaine(s)"
            : "mois"}
        </span>
        <span className="font-mono tabular-nums font-semibold text-ink">
          Total : {formatValue(totals.sum)}
        </span>
      </div>
    </div>
  );
}
