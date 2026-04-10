"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer]);

interface ComparisonRow {
  month: string;
  label: string;
  exploitant: number;
  telereleve: number;
  ecart: number;
  ecartPct: number | null;
}

interface CompareResponse {
  siteId: string;
  comparison: ComparisonRow[];
  summary: {
    totalExploitant: number;
    totalTelereleve: number;
    totalEcart: number;
    totalEcartPct: number | null;
    monthsWithBothSources: number;
    monthsTotal: number;
  };
}

function formatKwh(v: number): string {
  if (Math.abs(v) >= 5000) return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} MWh`;
  return `${Math.round(v).toLocaleString("fr-FR")} kWh`;
}

export function DivergenceChart({
  siteId,
  dateFrom,
  dateTo,
}: {
  siteId: string | null;
  dateFrom: string;
  dateTo: string;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch comparison data
  useEffect(() => {
    if (!siteId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    fetch(`/api/consumptions/compare?siteId=${siteId}&dateFrom=${dateFrom}&dateTo=${dateTo}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [siteId, dateFrom, dateTo]);

  // Rows that have both sources
  const rows = useMemo(
    () => (data?.comparison || []).filter((r) => r.exploitant > 0 && r.telereleve > 0),
    [data]
  );

  // Render chart
  useEffect(() => {
    if (!chartRef.current || rows.length === 0) {
      chartInstance.current?.dispose();
      chartInstance.current = null;
      return;
    }

    const chart = echarts.init(chartRef.current);
    chartInstance.current = chart;

    const barColor = (pct: number) => {
      const abs = Math.abs(pct);
      if (abs <= 2) return "#9ca3af"; // gray — acceptable
      if (abs <= 5) return "#f59e0b"; // amber — suspect
      return "#ef4444"; // red — critique
    };

    const ecartValues = rows.map((r) => r.ecartPct ?? 0);

    chart.setOption({
      grid: { left: 56, right: 24, top: 32, bottom: 48 },
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = (params as { dataIndex: number }[])[0];
          const r = rows[p.dataIndex];
          return `<strong>${r.label}</strong><br/>
            Exploitant : ${formatKwh(r.exploitant)}<br/>
            Télérelève : ${formatKwh(r.telereleve)}<br/>
            Écart : <strong style="color:${barColor(r.ecartPct ?? 0)}">${r.ecartPct !== null ? `${r.ecartPct > 0 ? "+" : ""}${r.ecartPct}%` : "—"}</strong> (${formatKwh(r.ecart)})`;
        },
      },
      xAxis: {
        type: "category",
        data: rows.map((r) => r.label),
        axisLabel: { fontSize: 11, color: "#6b7280" },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          fontSize: 11,
          color: "#6b7280",
          formatter: (v: number) => `${v > 0 ? "+" : ""}${v}%`,
        },
        splitLine: { lineStyle: { color: "#f3f4f6" } },
      },
      series: [
        {
          type: "bar",
          data: ecartValues.map((v) => ({
            value: v,
            itemStyle: { color: barColor(v), borderRadius: v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] },
          })),
          barMaxWidth: 40,
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#d1d5db", type: "dashed" },
            data: [
              { yAxis: 2, label: { show: false } },
              { yAxis: -2, label: { show: false } },
            ],
          },
        },
      ],
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      chartInstance.current = null;
    };
  }, [rows]);

  // No site selected
  if (!siteId) return null;

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-accent" />
      </div>
    );
  }

  // No data or no overlapping months
  if (!data || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
        <AlertCircle size={24} className="text-gray-300 mb-2" />
        <p className="text-sm">Aucune période avec des données exploitant et télérelève à comparer</p>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-4">
      {/* Summary badge */}
      {summary.totalEcartPct !== null && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">Écart global :</span>
          <span
            className={`text-sm font-bold px-2 py-0.5 rounded ${
              Math.abs(summary.totalEcartPct) <= 2
                ? "bg-gray-100 text-gray-700"
                : Math.abs(summary.totalEcartPct) <= 5
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {summary.totalEcartPct > 0 ? "+" : ""}{summary.totalEcartPct}%
          </span>
          <span className="text-xs text-text-secondary">
            sur {summary.monthsWithBothSources} mois comparables
          </span>
        </div>
      )}

      {/* Divergence bar chart */}
      <div ref={chartRef} style={{ width: "100%", height: 220 }} />

      {/* Detail table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-text-secondary py-2 px-3">Période</th>
              <th className="text-right text-xs font-medium text-text-secondary py-2 px-3">Exploitant</th>
              <th className="text-right text-xs font-medium text-text-secondary py-2 px-3">Télérelève</th>
              <th className="text-right text-xs font-medium text-text-secondary py-2 px-3">Écart</th>
              <th className="text-right text-xs font-medium text-text-secondary py-2 px-3">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 px-3 text-primary-dark">{r.label}</td>
                <td className="py-2 px-3 text-right">{formatKwh(r.exploitant)}</td>
                <td className="py-2 px-3 text-right">{formatKwh(r.telereleve)}</td>
                <td className="py-2 px-3 text-right">{formatKwh(r.ecart)}</td>
                <td className="py-2 px-3 text-right">
                  {r.ecartPct !== null ? (
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                        Math.abs(r.ecartPct) <= 2
                          ? "bg-gray-100 text-gray-600"
                          : Math.abs(r.ecartPct) <= 5
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {r.ecartPct > 0 ? "+" : ""}{r.ecartPct}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200">
            <tr className="font-semibold">
              <td className="py-2 px-3">Total</td>
              <td className="py-2 px-3 text-right">{formatKwh(summary.totalExploitant)}</td>
              <td className="py-2 px-3 text-right">{formatKwh(summary.totalTelereleve)}</td>
              <td className="py-2 px-3 text-right">{formatKwh(summary.totalEcart)}</td>
              <td className="py-2 px-3 text-right">
                {summary.totalEcartPct !== null ? (
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${
                      Math.abs(summary.totalEcartPct) <= 2
                        ? "bg-gray-100 text-gray-600"
                        : Math.abs(summary.totalEcartPct) <= 5
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {summary.totalEcartPct > 0 ? "+" : ""}{summary.totalEcartPct}%
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
