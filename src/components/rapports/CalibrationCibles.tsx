"use client";

import Link from "next/link";
import { useMemo } from "react";
import useSWR from "swr";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { useContract } from "@/contexts/ContractContext";
import { fetcher } from "@/lib/swr-fetcher";
import { diagnose, type SeasonPoint, type Verdict } from "@/lib/signature-energetique";

interface SiteApiShape {
  siteId: string;
  siteName: string;
  nb: number | null;
  nc: number;
  djrTotal: number;
  djuContractuel: number | null;
}
interface AnalyticsResponse {
  year: number;
  sites: SiteApiShape[];
}

const MAX_YEARS_BACK = 6;

function currentHeatingSeasonYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

function url(cid: string, year: number) {
  return `/api/consumptions/analytics?contractId=${cid}&year=${year}&yearType=HEATING_SEASON`;
}

export default function CalibrationCibles() {
  const { selectedContract, isLoading: loadingContract } = useContract();

  if (loadingContract) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </div>
    );
  }

  if (!selectedContract) {
    return (
      <div className="bg-white border border-gray-200/80 rounded-xl p-8 text-center text-sm text-text-secondary">
        Sélectionne un contrat pour voir le diagnostic de calibration.
      </div>
    );
  }

  return <CalibrationInner contract={selectedContract} />;
}

function CalibrationInner({ contract }: { contract: { id: string; reference: string; title: string; startDate: string } }) {
  const cid = contract.id;
  const currentY = currentHeatingSeasonYear();
  const contractStartYear = new Date(contract.startDate).getFullYear();

  const years = useMemo(
    () => Array.from({ length: MAX_YEARS_BACK }, (_, i) => currentY - i),
    [currentY]
  );

  // Hooks fixes (6) — clé null si saison antérieure à début de contrat
  const r0 = useSWR<AnalyticsResponse>(years[0] >= contractStartYear ? url(cid, years[0]) : null, fetcher);
  const r1 = useSWR<AnalyticsResponse>(years[1] >= contractStartYear ? url(cid, years[1]) : null, fetcher);
  const r2 = useSWR<AnalyticsResponse>(years[2] >= contractStartYear ? url(cid, years[2]) : null, fetcher);
  const r3 = useSWR<AnalyticsResponse>(years[3] >= contractStartYear ? url(cid, years[3]) : null, fetcher);
  const r4 = useSWR<AnalyticsResponse>(years[4] >= contractStartYear ? url(cid, years[4]) : null, fetcher);
  const r5 = useSWR<AnalyticsResponse>(years[5] >= contractStartYear ? url(cid, years[5]) : null, fetcher);
  const responses = [r0, r1, r2, r3, r4, r5];
  const loading = responses.some((r) => r.isLoading);

  const siteHistories = useMemo(() => {
    const m = new Map<string, SeasonPoint[]>();
    responses.forEach((r, i) => {
      const year = years[i];
      if (!r.data?.sites) return;
      r.data.sites.forEach((s) => {
        if (!s.nb || s.nc <= 0 || s.djrTotal <= 0 || !s.djuContractuel) return;
        const existing = m.get(s.siteId) ?? [];
        existing.push({
          year,
          nc: s.nc,
          djr: s.djrTotal,
          djc: s.djuContractuel,
          currentNb: s.nb,
          siteName: s.siteName,
        });
        m.set(s.siteId, existing);
      });
    });
    m.forEach((pts) => pts.sort((a, b) => a.year - b.year));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r0.data, r1.data, r2.data, r3.data, r4.data, r5.data, years]);

  const diagnoses = useMemo(
    () =>
      Array.from(siteHistories.entries()).map(([siteId, points]) => ({
        siteId,
        siteName: points[0].siteName,
        points,
        verdict: diagnose(points),
      })),
    [siteHistories]
  );

  const sorted = useMemo(() => {
    const order: Record<string, number> = { LACHE: 0, SERREE: 1, unstable: 2, insufficient: 3, OK: 4 };
    return [...diagnoses].sort((a, b) => {
      const ka = a.verdict.kind === "calibrated" ? a.verdict.severity : a.verdict.kind;
      const kb = b.verdict.kind === "calibrated" ? b.verdict.severity : b.verdict.kind;
      const rankDiff = (order[ka] ?? 99) - (order[kb] ?? 99);
      if (rankDiff !== 0) return rankDiff;
      // entre deux "lâches" ou "serrées" : trier par amplitude décroissante
      if (a.verdict.kind === "calibrated" && b.verdict.kind === "calibrated") {
        return Math.abs(b.verdict.deltaMwh) - Math.abs(a.verdict.deltaMwh);
      }
      return 0;
    });
  }, [diagnoses]);

  const summary = useMemo(() => {
    let lache = 0, serree = 0, ok = 0, unstable = 0, insufficient = 0;
    diagnoses.forEach(({ verdict }) => {
      if (verdict.kind === "calibrated") {
        if (verdict.severity === "LACHE") lache++;
        else if (verdict.severity === "SERREE") serree++;
        else ok++;
      } else if (verdict.kind === "unstable") unstable++;
      else insufficient++;
    });
    return { lache, serree, ok, unstable, insufficient, total: diagnoses.length };
  }, [diagnoses]);

  return (
    <div className="space-y-6">
      {/* Header ─────────────────────────────────────────────────── */}
      <header className="bg-white border border-gray-200/80 rounded-xl px-8 py-6">
        <div className="text-[10px] uppercase tracking-[0.2em] text-text-secondary font-semibold mb-2">
          Rapport · Expertise AMO
        </div>
        <h1 className="text-2xl font-semibold text-primary-dark tracking-tight">
          Calibration des cibles NB
        </h1>
        <p className="text-sm text-text-secondary mt-2 max-w-2xl">
          Diagnostic par signature énergétique : pour chaque site, on vérifie si la cible NB contractuelle
          est cohérente avec la performance réellement observée sur l&apos;historique. Contrat
          <strong className="text-primary-dark"> {contract.reference}</strong> · max {MAX_YEARS_BACK} saisons analysées.
        </p>
      </header>

      {loading ? (
        <div className="bg-white border border-gray-200/80 rounded-xl py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
        </div>
      ) : diagnoses.length === 0 ? (
        <div className="bg-white border border-gray-200/80 rounded-xl py-12 text-center text-sm text-text-secondary">
          Aucune donnée exploitable pour diagnostiquer les cibles de ce contrat.
        </div>
      ) : (
        <>
          {/* Résumé ─────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-200/80 rounded-xl px-8 py-5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-text-secondary font-semibold mb-3">
              Synthèse — {summary.total} sites avec cible
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <Tile count={summary.lache}  label="cible lâche"     tone="amber" />
              <Tile count={summary.serree} label="cible serrée"    tone="rose"  />
              <Tile count={summary.ok}     label="bien calibrée"   tone="emerald" />
              <Tile count={summary.unstable}     label="signature instable" tone="gray" />
              <Tile count={summary.insufficient} label="données insuffisantes" tone="gray" />
            </div>
          </div>

          {/* Liste sites ───────────────────────────────────────── */}
          <div className="space-y-3">
            {sorted.map(({ siteId, siteName, verdict, points }) => (
              <SiteCard key={siteId} siteId={siteId} siteName={siteName} verdict={verdict} points={points} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tile de synthèse ────────────────────────────────────────────

function Tile({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "amber" | "rose" | "emerald" | "gray";
}) {
  const toneClass = {
    amber: "text-amber-700",
    rose: "text-rose-700",
    emerald: "text-emerald-700",
    gray: "text-gray-500",
  }[tone];
  return (
    <div>
      <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{count}</div>
      <div className="text-[11px] uppercase tracking-wider text-text-secondary font-medium mt-0.5">
        {label}
      </div>
    </div>
  );
}

// ─── Carte par site ──────────────────────────────────────────────

function SiteCard({
  siteId,
  siteName,
  verdict,
  points,
}: {
  siteId: string;
  siteName: string;
  verdict: Verdict;
  points: SeasonPoint[];
}) {
  return (
    <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/energy/sites/${siteId}`}
            className="text-sm font-semibold text-primary-dark hover:text-accent transition-colors"
          >
            {siteName}
          </Link>
          <VerdictBadge verdict={verdict} />
        </div>
        <Link
          href={`/energy/sites/${siteId}`}
          className="text-xs text-text-secondary hover:text-primary-dark flex items-center gap-1"
        >
          Voir le site <ArrowRight size={12} />
        </Link>
      </div>

      <div className="px-6 py-5 grid md:grid-cols-[380px_1fr] gap-6">
        <div>
          <SignatureChart points={points} verdict={verdict} />
        </div>
        <div className="space-y-3">
          <DiagnosticBody verdict={verdict} points={points} />
        </div>
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (verdict.kind === "insufficient") {
    return (
      <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-500">
        {verdict.count} saison{verdict.count > 1 ? "s" : ""} · insuffisant
      </span>
    );
  }
  if (verdict.kind === "unstable") {
    return (
      <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 inline-flex items-center gap-1">
        <AlertCircle size={11} /> Signature instable
      </span>
    );
  }
  const m = {
    LACHE:   { bg: "bg-amber-100",   text: "text-amber-800",   label: "Cible trop lâche" },
    SERREE:  { bg: "bg-rose-100",    text: "text-rose-800",    label: "Cible trop serrée" },
    OK:      { bg: "bg-emerald-100", text: "text-emerald-800", label: "Bien calibrée" },
  }[verdict.severity];
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

function DiagnosticBody({ verdict, points }: { verdict: Verdict; points: SeasonPoint[] }) {
  if (verdict.kind === "insufficient") {
    return (
      <p className="text-sm text-text-secondary">
        Seulement <strong>{verdict.count} saison{verdict.count > 1 ? "s" : ""}</strong> de données exploitables
        — le diagnostic nécessite au moins 3 saisons. Revenir dans {3 - verdict.count} saison{3 - verdict.count > 1 ? "s" : ""}.
      </p>
    );
  }
  if (verdict.kind === "unstable") {
    return (
      <>
        <p className="text-sm text-text-secondary">
          La relation NC/DJR est peu linéaire (R² = <strong className="tabular-nums">{verdict.r2.toFixed(2)}</strong>) —
          le site a probablement connu des changements de régime (rénovation, changement d&apos;usage, incidents).
        </p>
        <p className="text-sm text-text-secondary">
          Pas de calibration automatique possible. À investiguer manuellement avant de toucher à la cible.
        </p>
      </>
    );
  }

  const current = points[0].currentNb;
  const absDelta = Math.abs(verdict.deltaMwh);
  const arrow = verdict.severity === "LACHE" ? "durcir" : verdict.severity === "SERREE" ? "renégocier à la hausse" : null;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 text-xs">
        <KeyValue label="Cible actuelle"  value={`${current.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MWh`} />
        <KeyValue label="Cible référence" value={`${verdict.nbRefMwh.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MWh`} />
        <KeyValue
          label="Écart"
          value={`${verdict.deltaMwh > 0 ? "+" : ""}${verdict.deltaMwh.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MWh`}
          valueTone={verdict.severity === "LACHE" ? "amber" : verdict.severity === "SERREE" ? "rose" : "gray"}
          sub={`${verdict.deltaPct > 0 ? "+" : ""}${verdict.deltaPct.toFixed(1)}%`}
        />
      </div>
      {arrow && (
        <p className="text-sm text-text-secondary">
          Sur <strong className="text-primary-dark">{verdict.usedPoints.length} saisons retenues</strong>, la performance
          réelle correspond à une cible <strong className="text-primary-dark tabular-nums">{verdict.nbRefMwh.toFixed(0)} MWh</strong>.
          La cible actuelle est {verdict.severity === "LACHE" ? "au-dessus" : "en-dessous"} de <strong className="text-primary-dark tabular-nums">{absDelta.toFixed(0)} MWh ({Math.abs(verdict.deltaPct).toFixed(1)}%)</strong>.
          Recommandation : <strong className="text-primary-dark">{arrow}</strong>.
        </p>
      )}
      {!arrow && (
        <p className="text-sm text-text-secondary">
          Cible cohérente avec l&apos;historique (écart ≤ 10 %). Rien à changer pour le moment.
        </p>
      )}
      <p className="text-xs text-text-secondary italic border-l-2 border-gray-100 pl-3 mt-3">
        {verdict.method}.
        {verdict.excludedPoints.length > 0 && (
          <> Saisons exclues : {verdict.excludedPoints.map((p) => `${p.year - 1}-${p.year}`).join(", ")}.</>
        )}
      </p>
    </>
  );
}

function KeyValue({
  label,
  value,
  sub,
  valueTone = "primary",
}: {
  label: string;
  value: string;
  sub?: string;
  valueTone?: "primary" | "amber" | "rose" | "gray";
}) {
  const toneClass = {
    primary: "text-primary-dark",
    amber: "text-amber-700",
    rose: "text-rose-700",
    gray: "text-gray-500",
  }[valueTone];
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold mb-1">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${toneClass}`}>
        {value}
        {sub && <span className="text-[11px] text-text-secondary font-normal ml-1">({sub})</span>}
      </div>
    </div>
  );
}

// ─── Scatter plot SVG ────────────────────────────────────────────

function SignatureChart({ points, verdict }: { points: SeasonPoint[]; verdict: Verdict }) {
  if (points.length === 0) return null;

  const W = 360, H = 180, P = 28;
  const djcVal = points[0].djc;
  const allX = [...points.map((p) => p.djr), djcVal];
  const allY = [
    ...points.map((p) => p.nc / 1000),
    points[0].currentNb,
    verdict.kind === "calibrated" ? verdict.nbRefMwh : 0,
  ].filter((v) => v > 0);

  const xMin = Math.min(...allX) * 0.9;
  const xMax = Math.max(...allX) * 1.05;
  const yMin = Math.min(...allY) * 0.9;
  const yMax = Math.max(...allY) * 1.05;

  const xScale = (v: number) => P + ((v - xMin) / (xMax - xMin)) * (W - 2 * P);
  const yScale = (v: number) => H - P - ((v - yMin) / (yMax - yMin)) * (H - 2 * P);

  // regression line
  let lineSeg: null | { x1: number; y1: number; x2: number; y2: number } = null;
  if (verdict.kind === "calibrated") {
    const x1 = xMin, x2 = xMax;
    const y1 = (verdict.slope * x1 + verdict.intercept) / 1000;
    const y2 = (verdict.slope * x2 + verdict.intercept) / 1000;
    lineSeg = { x1: xScale(x1), y1: yScale(y1), x2: xScale(x2), y2: yScale(y2) };
  }

  const excludedYears = new Set(
    verdict.kind === "calibrated" ? verdict.excludedPoints.map((p) => p.year) : []
  );

  const djcX = xScale(djcVal);
  const nbRefY = verdict.kind === "calibrated" ? yScale(verdict.nbRefMwh) : null;
  const currentNbY = yScale(points[0].currentNb);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
        {/* Axes */}
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#e5e7eb" />
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="#e5e7eb" />
        {/* DJC vertical marker */}
        <line x1={djcX} y1={P} x2={djcX} y2={H - P} stroke="#9ca3af" strokeDasharray="2 3" />
        <text x={djcX + 3} y={P + 10} fontSize={9} fill="#6b7280" fontFamily="ui-sans-serif">DJC</text>
        {/* Current NB horizontal */}
        <line x1={P} y1={currentNbY} x2={W - P} y2={currentNbY} stroke="#f59e0b" strokeDasharray="2 3" opacity={0.6} />
        <text x={W - P - 3} y={currentNbY - 3} fontSize={9} fill="#b45309" textAnchor="end" fontFamily="ui-sans-serif">
          NB actuel
        </text>
        {/* Regression line */}
        {lineSeg && (
          <line x1={lineSeg.x1} y1={lineSeg.y1} x2={lineSeg.x2} y2={lineSeg.y2} stroke="#0f172a" strokeWidth={1.2} />
        )}
        {/* NB_ref point (intersection régression × DJC) */}
        {nbRefY !== null && (
          <g>
            <circle cx={djcX} cy={nbRefY} r={5} fill="#0f172a" />
            <circle cx={djcX} cy={nbRefY} r={9} fill="none" stroke="#0f172a" strokeOpacity={0.3} />
            <text x={djcX + 8} y={nbRefY - 6} fontSize={9} fill="#0f172a" fontWeight={600} fontFamily="ui-sans-serif">
              NB réf
            </text>
          </g>
        )}
        {/* Data points */}
        {points.map((p) => {
          const excluded = excludedYears.has(p.year);
          return (
            <g key={p.year}>
              <circle
                cx={xScale(p.djr)}
                cy={yScale(p.nc / 1000)}
                r={4}
                fill={excluded ? "#d1d5db" : "#0ea5e9"}
                stroke={excluded ? "#9ca3af" : "#0369a1"}
                strokeWidth={1}
              />
            </g>
          );
        })}
        {/* Axis labels */}
        <text x={W / 2} y={H - 4} fontSize={9} fill="#9ca3af" textAnchor="middle" fontFamily="ui-sans-serif">
          DJU (DJR)
        </text>
        <text x={8} y={H / 2} fontSize={9} fill="#9ca3af" transform={`rotate(-90, 8, ${H / 2})`} fontFamily="ui-sans-serif">
          NC (MWh)
        </text>
      </svg>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-500 border border-sky-700" />
          saison retenue
        </span>
        {verdict.kind === "calibrated" && verdict.excludedPoints.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-300 border border-gray-400" />
            saison exclue
          </span>
        )}
      </div>
    </div>
  );
}
