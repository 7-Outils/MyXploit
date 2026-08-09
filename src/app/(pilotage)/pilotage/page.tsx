"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useUserProfile, type UserProfileType } from "@/contexts/UserProfileContext";
import {
  Building2,
  Zap,
  Euro,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Wrench,
  Clock,
  Activity,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────
interface CommandData {
  profile: string;
  kpis: {
    buildingCount: number;
    totalSurface: number;
    totalMwh: number;
    totalCost: number;
    costPerM2: number;
    avgKwhPerM2: number;
    avgDpe: string;
    trendPercent: number;
    alertCount: number;
    criticalAlerts: number;
    ticketCount: number;
    overdueTickets: number;
    equipmentIssueCount: number;
    equipmentTotal: number;
    p3Budget: number;
  };
  buildings: BuildingRow[];
  topCostly: BuildingRow[];
  energyBreakdown: { type: string; totalKwh: number; percentage: number }[];
  monthlyTrend: MonthlyPoint[];
  alerts: AlertItem[];
  tickets: TicketItem[];
  equipmentIssues: EquipmentItem[];
  expiringContracts: { id: string; title: string; provider: string; endDate: string }[];
  invoices: InvoiceItem[];
  recentActivity: ActivityItem[];
}

interface BuildingRow {
  id: string; name: string; type: string; city: string;
  surface: number; surfaceChauffee: number; kwhPerM2: number;
  score: string; trend: number; cost: number; provider: string | null;
}

interface MonthlyPoint {
  month: string; gaz: number; electricite: number; fioul: number;
  bois: number; reseauChaleur: number; total: number;
}

interface AlertItem {
  id: string; type: string; priority: string; title: string;
  siteName: string; createdAt: string;
}

interface TicketItem {
  id: string; reference: string; title: string; status: string;
  siteName: string; dueDate: string | null; isOverdue: boolean;
}

interface EquipmentItem {
  id: string; name: string; status: string; power: number | null; siteName: string;
}

interface InvoiceItem {
  id: string; type: string; status: string; amount: number;
  issueDate: string; siteName: string;
}

interface ActivityItem {
  id: string; type: string; title: string; date: string;
  siteName: string; userName: string;
}

// ─── Constants ───────────────────────────────────────────────
const DPE_COLORS: Record<string, string> = {
  A: "#22c55e", B: "#84cc16", C: "#eab308", D: "#f59e0b",
  E: "#f97316", F: "#ef4444", G: "#991b1b",
};

const ENERGY_COLORS: Record<string, string> = {
  GAZ: "#f59e0b", ELECTRICITE: "#3b82f6", FIOUL: "#78716c",
  BOIS: "#84cc16", RESEAU_CHALEUR: "#ef4444", AUTRE: "#6b7280",
};

const ENERGY_LABELS: Record<string, string> = {
  GAZ: "Gaz", ELECTRICITE: "Électricité", FIOUL: "Fioul",
  BOIS: "Bois", RESEAU_CHALEUR: "Réseau chaleur", AUTRE: "Autre",
};

const PRIORITY_STYLES: Record<string, string> = {
  CRITIQUE: "bg-red-50 text-red-700 border-red-600/20",
  HAUTE: "bg-amber-50 text-amber-700 border-amber-600/20",
  MOYENNE: "bg-white text-ink/60 border-ink/15",
  BASSE: "bg-white text-ink/40 border-ink/10",
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PANNE: { bg: "bg-red-50 border border-red-600/20", text: "text-red-700" },
  HORS_SERVICE: { bg: "bg-white border border-ink/15", text: "text-ink/50" },
  MAINTENANCE: { bg: "bg-amber-50 border border-amber-600/20", text: "text-amber-700" },
};

function fmt(n: number): string { return n.toLocaleString("fr-FR"); }

function formatMonth(m: string): string {
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const [, month] = m.split("-");
  return months[parseInt(month) - 1] || m;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return `${Math.floor(days / 7)}sem`;
}

// ─── Page ────────────────────────────────────────────────────
export default function PilotageCommandCenter() {
  const [data, setData] = useState<CommandData | null>(null);
  const [loading, setLoading] = useState(true);
  const { profile } = useUserProfile();

  useEffect(() => {
    fetch("/api/pilotage/command-center")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!data) return <ErrorState />;

  const { kpis } = data;
  const effectiveProfile = profile || (data.profile as UserProfileType) || "AMO";

  return (
    <div className="p-6 lg:p-8 space-y-4 max-w-[1600px] mx-auto">
      {/* ─── Bandeau de faits (KPI) ─────────────────────── */}
      <div className="border border-ink/10 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-ink/10 lg:grid-cols-4 lg:divide-y-0">
          {effectiveProfile === "CLIENT" && (
            <>
              <HeroKpi icon={Building2} label="Patrimoine" value={`${fmt(kpis.buildingCount)}`} sub={`${fmt(kpis.totalSurface)} m² chauffés`} />
              <HeroKpi icon={Euro} label="Budget énergie" value={`${fmt(kpis.totalCost)} €`} sub={`${kpis.costPerM2} €/m²`} />
              <HeroKpi icon={Zap} label="Score DPE moyen" value={kpis.avgDpe} sub={`${fmt(kpis.avgKwhPerM2)} kWh/m²/an`} valueColor={DPE_COLORS[kpis.avgDpe]} />
              <HeroKpi icon={AlertTriangle} label="Alertes" value={`${kpis.alertCount}`} sub={kpis.criticalAlerts > 0 ? `${kpis.criticalAlerts} critiques` : "Aucune critique"} alert={kpis.criticalAlerts > 0} />
            </>
          )}
          {effectiveProfile === "AMO" && (
            <>
              <HeroKpi icon={Building2} label="Sites suivis" value={`${fmt(kpis.buildingCount)}`} sub={`${fmt(kpis.totalSurface)} m²`} />
              <HeroKpi icon={Zap} label="Consommation" value={`${fmt(kpis.totalMwh)} MWh`} trend={kpis.trendPercent} sub="vs N-1" />
              <HeroKpi icon={Clock} label="Tickets ouverts" value={`${kpis.ticketCount}`} sub={kpis.overdueTickets > 0 ? `${kpis.overdueTickets} en retard` : "Aucun en retard"} alert={kpis.overdueTickets > 0} />
              <HeroKpi icon={AlertTriangle} label="Alertes" value={`${kpis.alertCount}`} sub={kpis.criticalAlerts > 0 ? `${kpis.criticalAlerts} critiques` : "RAS"} alert={kpis.criticalAlerts > 0} />
            </>
          )}
          {effectiveProfile === "EXPLOITANT" && (
            <>
              <HeroKpi icon={Building2} label="Sites en exploitation" value={`${fmt(kpis.buildingCount)}`} sub={`${fmt(kpis.totalSurface)} m²`} />
              <HeroKpi icon={TrendingUp} label="Consommation" value={`${fmt(kpis.totalMwh)} MWh`} trend={kpis.trendPercent} sub="Conformité P1" />
              <HeroKpi icon={Euro} label="Budget P3" value={`${fmt(kpis.p3Budget)} €`} sub="provisionné" />
              <HeroKpi icon={Wrench} label="Équipements" value={`${kpis.equipmentIssueCount}`} sub={`en panne / ${fmt(kpis.equipmentTotal)} total`} alert={kpis.equipmentIssueCount > 0} />
            </>
          )}
        </div>
      </div>

      {/* ─── Cards Grid (profile-adaptive) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1 */}
        <div className="space-y-4">
          <GlassCard title="Répartition énergie" accentColor="#3b82f6" href="/pilotage/performance">
            <EnergyDonut data={data.energyBreakdown} />
          </GlassCard>

          {(effectiveProfile === "CLIENT" || effectiveProfile === "AMO") && data.expiringContracts.length > 0 && (
            <GlassCard title="Contrats expirant" accentColor="#f59e0b" href="/pilotage/contrats">
              <div className="space-y-3">
                {data.expiringContracts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{c.title}</p>
                      <p className="text-xs text-text-secondary">{c.provider}</p>
                    </div>
                    <span className="ml-2 shrink-0 border border-amber-600/20 bg-amber-50 px-2 py-0.5 font-mono text-[11px] tabular-nums text-amber-700">
                      {new Date(c.endDate).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Column 2 */}
        <div className="space-y-4">
          <GlassCard
            title={effectiveProfile === "CLIENT" ? "Top bâtiments coûteux" : "Classement bâtiments"}
            accentColor="#ef4444"
            href="/pilotage/patrimoine"
          >
            <div className="space-y-2">
              {(effectiveProfile === "CLIENT" ? data.topCostly : [...data.buildings].sort((a, b) => b.kwhPerM2 - a.kwhPerM2).slice(0, 6)).map((b, i) => (
                <Link key={b.id} href={`/buildings/${b.id}`} className="flex items-center gap-3 p-2 -mx-2 hover:bg-ink/[0.02] transition-colors group">
                  <span className="w-5 text-right font-mono text-[11px] tabular-nums text-ink/40">{i + 1}</span>
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center font-mono text-[11px] font-medium text-white"
                    style={{ backgroundColor: DPE_COLORS[b.score] || DPE_COLORS.G }}
                  >
                    {b.score}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate group-hover:text-accent transition-colors">{b.name}</p>
                    <p className="text-xs text-text-secondary">
                      {effectiveProfile === "CLIENT" ? `${fmt(b.cost)} €` : `${fmt(b.kwhPerM2)} kWh/m²`}
                    </p>
                  </div>
                  <TrendBadge value={b.trend} />
                </Link>
              ))}
            </div>
          </GlassCard>

          {effectiveProfile === "CLIENT" ? (
            <GlassCard title="Dernières factures" accentColor="#8b5cf6">
              <div className="space-y-3">
                {data.invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{inv.siteName}</p>
                      <p className="text-xs text-text-secondary">{inv.type}</p>
                    </div>
                    <span className="font-mono text-sm font-medium tabular-nums text-ink">{fmt(inv.amount)} €</span>
                  </div>
                ))}
                {data.invoices.length === 0 && <EmptyText text="Aucune facture récente" />}
              </div>
            </GlassCard>
          ) : (
            <GlassCard title="Tickets ouverts" accentColor="#f97316" href="/pilotage/alertes">
              <div className="space-y-2">
                {data.tickets.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-start gap-2">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${t.isOverdue ? "bg-red-500" : "bg-amber-400"}`} />
                    <div className="min-w-0">
                      <p className="text-sm text-ink truncate">{t.title}</p>
                      <p className="text-xs text-text-secondary">{t.siteName} · {t.reference}</p>
                    </div>
                  </div>
                ))}
                {data.tickets.length === 0 && <EmptyText text="Aucun ticket ouvert" />}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Column 3 */}
        <div className="space-y-4">
          <GlassCard title="Alertes récentes" accentColor="#ef4444" href="/pilotage/alertes"
            badge={data.alerts.length > 0 ? `${data.alerts.length}` : undefined}
          >
            <div className="space-y-2">
              {data.alerts.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-start gap-2">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 border shrink-0 mt-0.5 ${PRIORITY_STYLES[a.priority] || PRIORITY_STYLES.MOYENNE}`}>
                    {a.priority === "CRITIQUE" ? "CRIT" : a.priority === "HAUTE" ? "HAUT" : a.priority === "BASSE" ? "BAS" : "MOY"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{a.title}</p>
                    <p className="text-xs text-text-secondary">{a.siteName} · {timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              ))}
              {data.alerts.length === 0 && <EmptyText text="Aucune alerte active" />}
            </div>
          </GlassCard>

          {(effectiveProfile === "AMO" || effectiveProfile === "EXPLOITANT") && (
            <GlassCard title="Équipements critiques" accentColor="#f97316" href="/pilotage/equipements">
              <div className="space-y-2">
                {data.equipmentIssues.slice(0, 5).map((eq) => {
                  const st = STATUS_STYLES[eq.status] || STATUS_STYLES.MAINTENANCE;
                  return (
                    <div key={eq.id} className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm text-ink truncate">{eq.name}</p>
                        <p className="text-xs text-text-secondary">{eq.siteName}{eq.power ? ` · ${eq.power} kW` : ""}</p>
                      </div>
                      <span className={`font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 ${st.bg} ${st.text}`}>
                        {eq.status === "PANNE" ? "Panne" : eq.status === "HORS_SERVICE" ? "HS" : "Maint."}
                      </span>
                    </div>
                  );
                })}
                {data.equipmentIssues.length === 0 && <EmptyText text="Tous opérationnels" />}
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      {/* ─── Monthly Chart (full width) ────────────────── */}
      <GlassCard title="Consommation mensuelle" subtitle="12 derniers mois · kWh par énergie" accentColor="#2563EB">
        <StackedBarChart data={data.monthlyTrend} />
      </GlassCard>

      {/* ─── Activity Timeline ─────────────────────────── */}
      {data.recentActivity.length > 0 && (
        <GlassCard title="Activité récente" accentColor="#6b7280">
          <div className="space-y-3">
            {data.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <Activity size={14} className="mt-1 shrink-0 text-ink/30" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{a.title}</p>
                  <p className="text-xs text-text-secondary">
                    {a.siteName} · {a.userName} · {timeAgo(a.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function HeroKpi({ icon: Icon, label, value, sub, trend, alert, valueColor }: {
  icon: LucideIcon; label: string; value: string; sub: string;
  trend?: number; alert?: boolean; valueColor?: string;
}) {
  return (
    <div className="relative px-4 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={12} className="text-ink/30" />
        <span className="label-tech">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <AnimatedNumber value={value} color={valueColor} />
        {trend !== undefined && trend !== 0 && (
          <span className={`flex items-center gap-0.5 font-mono text-xs font-medium tabular-nums ${trend < 0 ? "text-green-600" : "text-red-600"}`}>
            {trend < 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-xs text-text-secondary mt-1">{sub}</p>
      {alert && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
        </span>
      )}
    </div>
  );
}

function AnimatedNumber({ value, color }: { value: string; color?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayed, setDisplayed] = useState(value);

  useEffect(() => {
    const num = parseFloat(value.replace(/[^\d.-]/g, ""));
    if (isNaN(num) || num === 0) {
      setDisplayed(value);
      return;
    }

    const suffix = value.replace(/[\d.,\s-]/g, "").trim();
    const prefix = value.match(/^[^\d]*/)?.[0] || "";
    const duration = 600;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(num * eased);
      setDisplayed(`${prefix}${current.toLocaleString("fr-FR")}${suffix ? " " + suffix : ""}`);
      if (progress < 1) requestAnimationFrame(animate);
      else setDisplayed(value);
    }

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span
      ref={ref}
      className="font-mono text-2xl font-medium tabular-nums tracking-tight"
      style={{ color: color || "#0F1E33" }}
    >
      {displayed}
    </span>
  );
}

function GlassCard({ title, subtitle, children, accentColor, href, badge }: {
  title: string; subtitle?: string; children: React.ReactNode;
  accentColor?: string; href?: string; badge?: string;
}) {
  return (
    <div className="border border-ink/10 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
        <div>
          <h3 className="label-tech">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="min-w-[20px] border border-red-600/20 bg-red-50 px-1.5 py-0.5 text-center font-mono text-[10px] tabular-nums text-red-700">
              {badge}
            </span>
          )}
          {href && (
            <Link href={href} className="text-ink/40 transition-colors hover:text-accent">
              <ChevronRight size={16} />
            </Link>
          )}
        </div>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const isDown = value < 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium shrink-0 ${isDown ? "text-green-600" : "text-red-600"}`}>
      {isDown ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
      {Math.abs(value)}%
    </span>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-center text-text-secondary text-sm py-4">{text}</p>;
}

// ─── Energy Donut ────────────────────────────────────────────
function EnergyDonut({ data }: { data: { type: string; totalKwh: number; percentage: number }[] }) {
  const total = data.reduce((s, d) => s + d.totalKwh, 0);
  if (total === 0) return <EmptyText text="Aucune donnée" />;

  const size = 140;
  const strokeWidth = 20;
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
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#0F1E33" strokeOpacity="0.08" strokeWidth={strokeWidth} />
          {segments.map((seg, i) => (
            <circle key={i} cx={center} cy={center} r={radius} fill="none"
              stroke={ENERGY_COLORS[seg.type] || ENERGY_COLORS.AUTRE}
              strokeWidth={strokeWidth} strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset} strokeLinecap="butt"
              className="transition-all duration-700"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-lg font-medium tabular-nums text-ink">{fmt(Math.round(total / 1000))}</span>
          <span className="text-[10px] text-text-secondary">MWh</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ENERGY_COLORS[seg.type] || ENERGY_COLORS.AUTRE }} />
            <span className="text-xs text-ink truncate">{ENERGY_LABELS[seg.type] || seg.type}</span>
            <span className="text-xs text-text-secondary ml-auto">{seg.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stacked Bar Chart ───────────────────────────────────────
function StackedBarChart({ data }: { data: MonthlyPoint[] }) {
  if (data.length === 0) return <EmptyText text="Aucune donnée mensuelle" />;

  const energyKeys: { key: keyof MonthlyPoint; color: string; label: string }[] = [
    { key: "gaz", color: ENERGY_COLORS.GAZ, label: "Gaz" },
    { key: "electricite", color: ENERGY_COLORS.ELECTRICITE, label: "Électricité" },
    { key: "fioul", color: ENERGY_COLORS.FIOUL, label: "Fioul" },
    { key: "bois", color: ENERGY_COLORS.BOIS, label: "Bois" },
    { key: "reseauChaleur", color: ENERGY_COLORS.RESEAU_CHALEUR, label: "Réseau chaleur" },
  ];

  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const chartH = 200;
  const barPad = 8;
  const barW = Math.max((680 - barPad * data.length) / data.length, 24);
  const totalW = data.length * (barW + barPad) + 50;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        {energyKeys.map((ek) => (
          <div key={ek.key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5" style={{ backgroundColor: ek.color }} />
            <span className="text-xs text-text-secondary">{ek.label}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${totalW} ${chartH + 35}`} className="w-full" style={{ minWidth: 380 }}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = chartH - chartH * pct + 8;
            const val = Math.round((maxTotal * pct) / 1000);
            return (
              <g key={pct}>
                <line x1={40} y1={y} x2={totalW} y2={y} stroke="#0F1E33" strokeOpacity="0.08" strokeWidth={1} strokeDasharray="4 4" />
                <text x={36} y={y + 3} textAnchor="end" className="text-[9px] fill-ink/40">{val > 0 ? val : "0"}</text>
              </g>
            );
          })}
          <text x={0} y={6} className="text-[8px] fill-ink/40">MWh</text>
          {data.map((point, i) => {
            const x = 44 + i * (barW + barPad);
            let yOff = 0;
            return (
              <g key={point.month}>
                {energyKeys.map((ek) => {
                  const val = (point[ek.key] as number) || 0;
                  const h = (val / maxTotal) * chartH;
                  const y = chartH - yOff - h + 8;
                  yOff += h;
                  if (val === 0) return null;
                  return <rect key={ek.key} x={x} y={y} width={barW} height={Math.max(h, 0)} fill={ek.color} className="transition-all duration-500" />;
                })}
                <text x={x + barW / 2} y={chartH + 22} textAnchor="middle" className="text-[9px] fill-ink/50">{formatMonth(point.month)}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── Loading & Error ─────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-4 max-w-[1600px] mx-auto animate-pulse">
      <div className="border border-ink/10 bg-ink/[0.03] h-24" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="bg-ink/[0.03] h-64" />)}
      </div>
      <div className="bg-ink/[0.03] h-72" />
    </div>
  );
}

function ErrorState() {
  return (
    <div className="p-8 text-center">
      <AlertTriangle size={24} className="mx-auto mb-4 text-red-600" />
      <p className="text-ink font-medium">Impossible de charger les données</p>
      <p className="text-sm text-text-secondary mt-1">Vérifiez votre connexion et réessayez.</p>
    </div>
  );
}
