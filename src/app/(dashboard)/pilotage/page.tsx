"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Zap,
  Euro,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronUp,
  ChevronDown,
  Wrench,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────
interface PilotageData {
  kpis: {
    buildingCount: number;
    totalSurface: number;
    totalMwh: number;
    totalCost: number;
    alertCount: number;
    criticalAlerts: number;
    trendPercent: number;
  };
  buildings: BuildingRow[];
  energyBreakdown: { type: string; totalKwh: number; percentage: number }[];
  monthlyTrend: MonthlyPoint[];
  alerts: AlertItem[];
  equipmentIssues: { id: string; name: string; status: string; siteName: string }[];
}

interface BuildingRow {
  id: string;
  name: string;
  type: string;
  city: string;
  surface: number;
  surfaceChauffee: number;
  kwhPerM2: number;
  score: string;
  trend: number;
  contractProvider: string | null;
}

interface MonthlyPoint {
  month: string;
  gaz: number;
  electricite: number;
  fioul: number;
  bois: number;
  reseauChaleur: number;
  total: number;
}

interface AlertItem {
  id: string;
  type: string;
  priority: string;
  title: string;
  siteName: string;
  createdAt: string;
}

type SortKey = "name" | "type" | "surfaceChauffee" | "kwhPerM2" | "score" | "trend";

// ─── Score DPE ───────────────────────────────────────────────
const SCORE_CONFIG: Record<string, { color: string; bg: string }> = {
  A: { color: "#22c55e", bg: "bg-green-50" },
  B: { color: "#84cc16", bg: "bg-lime-50" },
  C: { color: "#eab308", bg: "bg-yellow-50" },
  D: { color: "#f59e0b", bg: "bg-amber-50" },
  E: { color: "#f97316", bg: "bg-orange-50" },
  F: { color: "#ef4444", bg: "bg-red-50" },
  G: { color: "#991b1b", bg: "bg-red-100" },
};

const SCORE_ORDER = ["A", "B", "C", "D", "E", "F", "G"];

const ENERGY_COLORS: Record<string, string> = {
  GAZ: "#f59e0b",
  ELECTRICITE: "#3b82f6",
  FIOUL: "#78716c",
  BOIS: "#84cc16",
  RESEAU_CHALEUR: "#ef4444",
  AUTRE: "#6b7280",
};

const ENERGY_LABELS: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Electricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "Réseau chaleur",
  AUTRE: "Autre",
};

const PRIORITY_CONFIG: Record<string, { label: string; class: string }> = {
  CRITIQUE: { label: "Critique", class: "bg-red-100 text-red-700" },
  HAUTE: { label: "Haute", class: "bg-orange-100 text-orange-700" },
  MOYENNE: { label: "Moyenne", class: "bg-yellow-100 text-yellow-700" },
  BASSE: { label: "Basse", class: "bg-gray-100 text-gray-600" },
};

// ─── Helpers ─────────────────────────────────────────────────
function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR");
}

function formatMonth(m: string): string {
  const [year, month] = m.split("-");
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
}

// ─── Page ────────────────────────────────────────────────────
export default function PilotagePage() {
  const [data, setData] = useState<PilotageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("kwhPerM2");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetch("/api/pilotage")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const sortedBuildings = useMemo(() => {
    if (!data) return [];
    const arr = [...data.buildings];
    arr.sort((a, b) => {
      let va: string | number = a[sortKey];
      let vb: string | number = b[sortKey];
      if (sortKey === "score") {
        va = SCORE_ORDER.indexOf(a.score);
        vb = SCORE_ORDER.indexOf(b.score);
      }
      if (typeof va === "string") return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [data, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "name" || key === "type");
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-xl" />
            ))}
          </div>
          <div className="h-96 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-text-secondary">
        Impossible de charger les données de pilotage.
      </div>
    );
  }

  const { kpis, energyBreakdown, monthlyTrend, alerts, equipmentIssues } = data;
  const maxKwhPerM2 = Math.max(...sortedBuildings.map((b) => b.kwhPerM2), 1);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">Pilotage Énergétique</h1>
        <p className="text-text-secondary mt-1">
          Vue d&apos;ensemble de la performance de votre patrimoine
        </p>
      </div>

      {/* ─── Zone A: KPI Cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Building2}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          label="Patrimoine"
          value={`${formatNumber(kpis.buildingCount)} bâtiments`}
          sub={`${formatNumber(kpis.totalSurface)} m² chauffés`}
        />
        <KpiCard
          icon={Zap}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          label="Consommation"
          value={`${formatNumber(kpis.totalMwh)} MWh`}
          sub={
            kpis.trendPercent !== 0
              ? `${kpis.trendPercent > 0 ? "+" : ""}${kpis.trendPercent}% vs N-1`
              : "Stable vs N-1"
          }
          trend={kpis.trendPercent}
        />
        <KpiCard
          icon={Euro}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          label="Budget énergie"
          value={`${formatNumber(kpis.totalCost)} €`}
          sub={
            kpis.totalSurface > 0
              ? `${(kpis.totalCost / kpis.totalSurface).toFixed(1)} €/m²`
              : "—"
          }
        />
        <KpiCard
          icon={AlertTriangle}
          iconBg="bg-red-50"
          iconColor="text-red-600"
          label="Alertes"
          value={`${kpis.alertCount} actives`}
          sub={kpis.criticalAlerts > 0 ? `dont ${kpis.criticalAlerts} critiques` : "Aucune critique"}
          alert={kpis.criticalAlerts > 0}
        />
      </div>

      {/* ─── Zone B: 2 colonnes ────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left: Building ranking (3/5) */}
        <div className="xl:col-span-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-primary-dark">Classement des bâtiments</h2>
            <p className="text-sm text-text-secondary">{sortedBuildings.length} sites · trié par {sortKey === "kwhPerM2" ? "kWh/m²" : sortKey}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-text-secondary">
                  <SortHeader label="Bâtiment" sortKey="name" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortHeader label="Type" sortKey="type" current={sortKey} asc={sortAsc} onSort={handleSort} className="hidden md:table-cell" />
                  <SortHeader label="Surface" sortKey="surfaceChauffee" current={sortKey} asc={sortAsc} onSort={handleSort} className="hidden lg:table-cell" />
                  <SortHeader label="kWh/m²/an" sortKey="kwhPerM2" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortHeader label="DPE" sortKey="score" current={sortKey} asc={sortAsc} onSort={handleSort} />
                  <SortHeader label="Tendance" sortKey="trend" current={sortKey} asc={sortAsc} onSort={handleSort} className="hidden sm:table-cell" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedBuildings.map((b) => {
                  const sc = SCORE_CONFIG[b.score] || SCORE_CONFIG.G;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/buildings/${b.id}`} className="font-medium text-primary-dark hover:text-accent transition-colors">
                          {b.name}
                        </Link>
                        <div className="text-xs text-text-secondary">{b.city}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {b.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-text-secondary">
                        {formatNumber(b.surfaceChauffee)} m²
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary-dark w-12 text-right">{b.kwhPerM2}</span>
                          <div className="flex-1 max-w-[80px] h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min((b.kwhPerM2 / maxKwhPerM2) * 100, 100)}%`,
                                backgroundColor: sc.color,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm text-white"
                          style={{ backgroundColor: sc.color }}
                        >
                          {b.score}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <TrendBadge value={b.trend} />
                      </td>
                    </tr>
                  );
                })}
                {sortedBuildings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-text-secondary">
                      Aucun bâtiment trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column (2/5) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Donut: energy breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-primary-dark">Répartition par énergie</h3>
            </div>
            <div className="p-6">
              <EnergyDonut data={energyBreakdown} />
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-primary-dark">Alertes récentes</h3>
              <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-medium">
                {alerts.length}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {alerts.slice(0, 5).map((a) => {
                const prio = PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.MOYENNE;
                return (
                  <div key={a.id} className="px-6 py-3 flex items-start gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${prio.class}`}>
                      {prio.label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-primary-dark truncate">{a.title}</p>
                      <p className="text-xs text-text-secondary">{a.siteName}</p>
                    </div>
                  </div>
                );
              })}
              {alerts.length === 0 && (
                <div className="px-6 py-8 text-center text-text-secondary text-sm">
                  Aucune alerte active
                </div>
              )}
            </div>
          </div>

          {/* Equipment issues */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-primary-dark">Équipements en panne</h3>
              <span className="flex items-center gap-1 text-xs font-medium text-orange-600">
                <Wrench size={14} />
                {equipmentIssues.length}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {equipmentIssues.slice(0, 5).map((eq) => (
                <div key={eq.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-primary-dark truncate">{eq.name}</p>
                    <p className="text-xs text-text-secondary">{eq.siteName}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${eq.status === "PANNE" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                    {eq.status === "PANNE" ? "Panne" : "Hors service"}
                  </span>
                </div>
              ))}
              {equipmentIssues.length === 0 && (
                <div className="px-6 py-8 text-center text-text-secondary text-sm">
                  Tous les équipements opérationnels
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Zone C: Monthly bar chart ─────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-primary-dark">Consommation mensuelle</h2>
          <p className="text-sm text-text-secondary">12 derniers mois · kWh par type d&apos;énergie</p>
        </div>
        <div className="p-6">
          <StackedBarChart data={monthlyTrend} />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
  trend,
  alert,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
  trend?: number;
  alert?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-soft transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon size={22} className={iconColor} />
        </div>
        {trend !== undefined && trend !== 0 && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
              trend < 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
            }`}
          >
            {trend < 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
            {Math.abs(trend)}%
          </span>
        )}
        {alert && (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
        )}
      </div>
      <p className="text-sm text-text-secondary mb-0.5">{label}</p>
      <p className="text-2xl font-bold text-primary-dark">{value}</p>
      <p className="text-xs text-text-secondary mt-1">{sub}</p>
    </div>
  );
}

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-text-secondary">—</span>;
  const isDown = value < 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isDown ? "text-green-600" : "text-red-600"
      }`}
    >
      {isDown ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
      {Math.abs(value)}%
    </span>
  );
}

function SortHeader({
  label,
  sortKey: key,
  current,
  asc,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === key;
  return (
    <th
      className={`px-4 py-3 font-medium text-xs uppercase tracking-wide cursor-pointer select-none hover:text-primary-dark transition-colors ${className}`}
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (asc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </span>
    </th>
  );
}

// ─── Donut Chart (inline SVG) ────────────────────────────────
function EnergyDonut({ data }: { data: { type: string; totalKwh: number; percentage: number }[] }) {
  const total = data.reduce((s, d) => s + d.totalKwh, 0);
  if (total === 0) {
    return <p className="text-center text-text-secondary text-sm py-8">Aucune donnée de consommation</p>;
  }

  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let offset = 0;
  const segments = data.map((d) => {
    const pct = d.totalKwh / total;
    const dash = circumference * pct;
    const seg = { ...d, dashArray: `${dash} ${circumference - dash}`, dashOffset: -offset };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={ENERGY_COLORS[seg.type] || ENERGY_COLORS.AUTRE}
              strokeWidth={strokeWidth}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="butt"
              className="transition-all duration-500"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-primary-dark">{formatNumber(Math.round(total / 1000))}</span>
          <span className="text-xs text-text-secondary">MWh</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ENERGY_COLORS[seg.type] || ENERGY_COLORS.AUTRE }} />
            <div>
              <span className="text-sm text-primary-dark">{ENERGY_LABELS[seg.type] || seg.type}</span>
              <span className="text-xs text-text-secondary ml-2">{seg.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stacked Bar Chart (inline SVG) ─────────────────────────
function StackedBarChart({ data }: { data: MonthlyPoint[] }) {
  if (data.length === 0) {
    return <p className="text-center text-text-secondary text-sm py-8">Aucune donnée mensuelle</p>;
  }

  const energyKeys: { key: keyof MonthlyPoint; color: string; label: string }[] = [
    { key: "gaz", color: ENERGY_COLORS.GAZ, label: "Gaz" },
    { key: "electricite", color: ENERGY_COLORS.ELECTRICITE, label: "Electricité" },
    { key: "fioul", color: ENERGY_COLORS.FIOUL, label: "Fioul" },
    { key: "bois", color: ENERGY_COLORS.BOIS, label: "Bois" },
    { key: "reseauChaleur", color: ENERGY_COLORS.RESEAU_CHALEUR, label: "Réseau chaleur" },
  ];

  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const chartH = 220;
  const chartW = 700;
  const barPadding = 6;
  const barWidth = Math.max((chartW - barPadding * data.length) / data.length, 20);
  const totalWidth = data.length * (barWidth + barPadding);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-2">
        {energyKeys.map((ek) => (
          <div key={ek.key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: ek.color }} />
            <span className="text-xs text-text-secondary">{ek.label}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${totalWidth + 40} ${chartH + 40}`} className="w-full" style={{ minWidth: 400 }}>
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = chartH - chartH * pct + 10;
            const val = Math.round((maxTotal * pct) / 1000);
            return (
              <g key={pct}>
                <line x1={35} y1={y} x2={totalWidth + 35} y2={y} stroke="#f3f4f6" strokeWidth={1} />
                <text x={30} y={y + 4} textAnchor="end" className="text-[10px] fill-gray-400">
                  {val > 0 ? `${val}` : "0"}
                </text>
              </g>
            );
          })}
          <text x={0} y={6} className="text-[9px] fill-gray-400">MWh</text>

          {/* Bars */}
          {data.map((point, i) => {
            const x = 40 + i * (barWidth + barPadding);
            let yOffset = 0;
            return (
              <g key={point.month}>
                {energyKeys.map((ek) => {
                  const val = (point[ek.key] as number) || 0;
                  const h = (val / maxTotal) * chartH;
                  const y = chartH - yOffset - h + 10;
                  yOffset += h;
                  if (val === 0) return null;
                  return (
                    <rect
                      key={ek.key}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(h, 0)}
                      rx={2}
                      fill={ek.color}
                      className="transition-all duration-300"
                    />
                  );
                })}
                <text
                  x={x + barWidth / 2}
                  y={chartH + 25}
                  textAnchor="middle"
                  className="text-[10px] fill-gray-500"
                >
                  {formatMonth(point.month)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
