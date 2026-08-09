"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { AlertCircle, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { useContract } from "@/contexts/ContractContext";
import { fetcher } from "@/lib/swr-fetcher";
import { diagnose, diagnoseManual, type SeasonPoint, type Verdict } from "@/lib/signature-energetique";

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
      <div className="panel p-8 text-center text-sm text-ink/50">
        Sélectionne un contrat pour voir le diagnostic de calibration.
      </div>
    );
  }

  return <CalibrationInner contract={selectedContract} />;
}

function CalibrationInner({ contract }: { contract: { id: string; reference: string; startDate: string } }) {
  const cid = contract.id;
  const currentY = currentHeatingSeasonYear();
  const contractStartYear = new Date(contract.startDate).getFullYear();

  const years = useMemo(
    () => Array.from({ length: MAX_YEARS_BACK }, (_, i) => currentY - i),
    [currentY]
  );

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
    const order: Record<string, number> = { LACHE: 0, SERREE: 1, unstable: 2, OK: 3, insufficient: 4 };
    return [...diagnoses].sort((a, b) => {
      const ka = a.verdict.kind === "calibrated" ? a.verdict.severity : a.verdict.kind;
      const kb = b.verdict.kind === "calibrated" ? b.verdict.severity : b.verdict.kind;
      const rankDiff = (order[ka] ?? 99) - (order[kb] ?? 99);
      if (rankDiff !== 0) return rankDiff;
      if (a.verdict.kind === "calibrated" && b.verdict.kind === "calibrated") {
        return Math.abs(b.verdict.deltaMwh) - Math.abs(a.verdict.deltaMwh);
      }
      return a.siteName.localeCompare(b.siteName);
    });
  }, [diagnoses]);

  type Filter = "all" | "flagged" | "ok" | "unstable";
  const [filter, setFilter] = useState<Filter>("flagged");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return sorted.filter((d) => {
      if (filter === "all") return true;
      if (filter === "flagged") {
        return d.verdict.kind === "calibrated" && d.verdict.severity !== "OK";
      }
      if (filter === "ok") return d.verdict.kind === "calibrated" && d.verdict.severity === "OK";
      if (filter === "unstable") return d.verdict.kind !== "calibrated";
      return true;
    });
  }, [sorted, filter]);

  // Default selection : premier de la liste filtrée
  const selected = useMemo(
    () => filtered.find((d) => d.siteId === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  const counts = useMemo(() => {
    let lache = 0, serree = 0, ok = 0, unstable = 0, insufficient = 0;
    diagnoses.forEach(({ verdict }) => {
      if (verdict.kind === "calibrated") {
        if (verdict.severity === "LACHE") lache++;
        else if (verdict.severity === "SERREE") serree++;
        else ok++;
      } else if (verdict.kind === "unstable") unstable++;
      else insufficient++;
    });
    return { lache, serree, ok, unstable, insufficient, flagged: lache + serree };
  }, [diagnoses]);

  return (
    <div className="space-y-4">
      {/* Header ligne 1 + filters ──────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border-b border-ink/10 pb-2">
        <div className="flex items-center gap-3">
          <Link href="/rapports" className="text-ink/40 hover:text-accent transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-xl font-semibold text-ink">
            Calibration des cibles NB
          </h1>
          <span className="label-tech">
            {contract.reference} · {diagnoses.length} sites
          </span>
        </div>
        <div className="flex items-center border border-ink/15 divide-x divide-ink/15">
          <FilterBtn active={filter === "flagged"} onClick={() => setFilter("flagged")}>
            À réviser <CountDot>{counts.flagged}</CountDot>
          </FilterBtn>
          <FilterBtn active={filter === "unstable"} onClick={() => setFilter("unstable")}>
            Instables <CountDot>{counts.unstable + counts.insufficient}</CountDot>
          </FilterBtn>
          <FilterBtn active={filter === "ok"} onClick={() => setFilter("ok")}>
            OK <CountDot>{counts.ok}</CountDot>
          </FilterBtn>
          <FilterBtn active={filter === "all"} onClick={() => setFilter("all")}>
            Toutes <CountDot>{diagnoses.length}</CountDot>
          </FilterBtn>
        </div>
      </div>

      {loading ? (
        <div className="panel py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-ink/40" />
        </div>
      ) : diagnoses.length === 0 ? (
        <div className="panel py-12 text-center text-sm text-ink/50">
          Aucune donnée exploitable pour diagnostiquer les cibles de ce contrat.
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel py-12 text-center text-sm text-ink/50">
          Aucun site dans cette catégorie.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4">
          {/* Liste compacte ─────────────────────────────────── */}
          <div className="panel overflow-hidden">
            <div className="max-h-[calc(100vh-180px)] overflow-auto divide-y divide-ink/10">
              {filtered.map(({ siteId, siteName, verdict }) => {
                const active = selected?.siteId === siteId;
                return (
                  <button
                    key={siteId}
                    onClick={() => setSelectedId(siteId)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                      active ? "bg-accent/5 border-l-2 border-accent" : "hover:bg-ink/[0.02] border-l-2 border-transparent"
                    }`}
                  >
                    <Dot verdict={verdict} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-medium truncate ${active ? "text-accent" : "text-ink"}`}>
                        {siteName}
                      </div>
                      <div className="font-mono text-[11px] text-ink/50 tabular-nums">
                        <VerdictInline verdict={verdict} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Détail ────────────────────────────────────────── */}
          <div className="panel overflow-hidden">
            {selected ? <DetailPane site={selected} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
        active ? "bg-accent/5 text-accent" : "text-ink/50 hover:text-ink hover:bg-ink/[0.02]"
      }`}
    >
      {children}
    </button>
  );
}

function CountDot({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono tabular-nums text-[10px] text-ink/40 font-semibold">
      {children}
    </span>
  );
}

function Dot({ verdict }: { verdict: Verdict }) {
  const color =
    verdict.kind === "calibrated" && verdict.severity === "LACHE" ? "bg-amber-600" :
    verdict.kind === "calibrated" && verdict.severity === "SERREE" ? "bg-red-600" :
    verdict.kind === "calibrated" ? "bg-green-600" :
    verdict.kind === "unstable" ? "bg-ink/40" :
    "bg-ink/15";
  return <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />;
}

function VerdictInline({ verdict }: { verdict: Verdict }) {
  if (verdict.kind === "insufficient") return <span>{verdict.count} saison{verdict.count > 1 ? "s" : ""} · historique en constitution</span>;
  if (verdict.kind === "unstable") return <span>signature instable · R² {verdict.r2.toFixed(2)}</span>;
  const sign = verdict.deltaMwh > 0 ? "+" : "";
  const label = verdict.severity === "LACHE" ? "lâche" : verdict.severity === "SERREE" ? "serrée" : "OK";
  return (
    <span>
      {sign}{verdict.deltaMwh.toFixed(0)} MWh · {label}
    </span>
  );
}

type Mode = "auto" | "all" | "last3" | "custom";

function DetailPane({
  site,
}: {
  site: { siteId: string; siteName: string; verdict: Verdict; points: SeasonPoint[] };
}) {
  // Reset de la sélection quand on change de site
  const [mode, setMode] = useState<Mode>("auto");
  const [manualExcluded, setManualExcluded] = useState<Set<number>>(new Set());

  useEffect(() => {
    setMode("auto");
    setManualExcluded(new Set());
  }, [site.siteId]);

  // Calcul du verdict selon le mode sélectionné (interactif)
  const liveVerdict: Verdict = useMemo(() => {
    const sorted = [...site.points].sort((a, b) => a.year - b.year);
    if (mode === "auto") return site.verdict; // verdict du diagnose() initial
    if (mode === "all") return diagnoseManual(site.points, sorted);
    if (mode === "last3") {
      const last3 = sorted.slice(-3);
      return diagnoseManual(site.points, last3);
    }
    // custom
    const kept = site.points.filter((p) => !manualExcluded.has(p.year));
    return diagnoseManual(site.points, kept);
  }, [mode, manualExcluded, site]);

  const togglePoint = (year: number) => {
    // Un clic sur un point ou chip → passe en mode custom avec cette saison exclue
    setMode("custom");
    setManualExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const sortedPoints = [...site.points].sort((a, b) => a.year - b.year);
  const excludedNow = new Set<number>(
    liveVerdict.kind === "calibrated" ? liveVerdict.excludedPoints.map((p) => p.year) : []
  );

  return (
    <>
      {/* Entête pane ─────────────────────────────────────────── */}
      <div className="panel-header">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-semibold text-ink truncate">
            {site.siteName}
          </h2>
          <VerdictBadge verdict={liveVerdict} />
        </div>
        <Link
          href={`/energy/sites/${site.siteId}`}
          className="font-mono text-[11px] uppercase tracking-widest text-ink/50 hover:text-accent flex items-center gap-1 shrink-0 transition-colors"
        >
          Voir le site <ArrowRight size={12} />
        </Link>
      </div>

      {/* Contenu ─────────────────────────────────────────────── */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
          {/* Scatter + chips */}
          <div className="space-y-4">
            <SignatureChart points={site.points} verdict={liveVerdict} onTogglePoint={togglePoint} />

            {/* Chips saisons — cliquables */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="label-tech">Saisons prises en compte</span>
                <span className="label-tech normal-case tracking-normal text-ink/40">clic pour exclure / inclure</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sortedPoints.map((p) => {
                  const excluded = excludedNow.has(p.year);
                  return (
                    <button
                      key={p.year}
                      onClick={() => togglePoint(p.year)}
                      className={`font-mono text-[11px] px-2 py-1 border transition-colors tabular-nums ${
                        excluded
                          ? "border-dashed border-ink/20 text-ink/30 line-through"
                          : "border-ink/20 text-ink hover:border-accent hover:text-accent"
                      }`}
                    >
                      {p.year - 1}–{p.year}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode presets */}
            <div>
              <div className="flex items-center border border-ink/15 divide-x divide-ink/15 w-fit">
                {(["auto", "all", "last3", "custom"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      if (m !== "custom") setManualExcluded(new Set());
                    }}
                    className={`px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                      mode === m ? "bg-accent/5 text-accent" : "text-ink/50 hover:text-ink hover:bg-ink/[0.02]"
                    }`}
                  >
                    {m === "auto" ? "Auto algo" : m === "all" ? "Toutes saisons" : m === "last3" ? "3 dernières" : "Manuel"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ink/50 mt-2">
                {mode === "auto" && "L'algorithme choisit : tendance → 3 dernières, outlier → exclusion auto, sinon toutes."}
                {mode === "all" && "Toutes les saisons disponibles sont incluses dans la régression."}
                {mode === "last3" && "Seules les 3 saisons les plus récentes sont utilisées — reflète la performance actuelle."}
                {mode === "custom" && `${site.points.length - manualExcluded.size} saison(s) retenue(s), ${manualExcluded.size} exclue(s) manuellement.`}
              </p>
            </div>
          </div>

          {/* Panel narratif */}
          <div>
            <DiagnosticPanel site={site} verdict={liveVerdict} />
          </div>
        </div>
      </div>
    </>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (verdict.kind === "insufficient") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 border border-ink/15 text-ink/50">
        Historique en constitution
      </span>
    );
  }
  if (verdict.kind === "unstable") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 border border-ink/15 text-ink/50 inline-flex items-center gap-1">
        <AlertCircle size={11} /> Signature instable
      </span>
    );
  }
  const m = {
    LACHE:  { bg: "bg-amber-50 border-amber-600/20", text: "text-amber-700", label: "Cible trop lâche" },
    SERREE: { bg: "bg-red-50 border-red-600/20",     text: "text-red-700",   label: "Cible trop serrée" },
    OK:     { bg: "bg-green-50 border-green-600/20", text: "text-green-700", label: "Bien calibrée" },
  }[verdict.severity];
  return (
    <span className={`font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 border ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

function DiagnosticPanel({
  site,
  verdict,
}: {
  site: { points: SeasonPoint[] };
  verdict: Verdict;
}) {
  if (verdict.kind === "insufficient") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink leading-relaxed">
          <strong className="font-mono tabular-nums">{verdict.count} saison{verdict.count > 1 ? "s" : ""}</strong> exploitable{verdict.count > 1 ? "s" : ""} — il en faut au moins 3 pour calibrer.
        </p>
        <p className="text-[13px] text-ink/50 leading-relaxed">
          La signature énergétique se stabilisera automatiquement aux prochaines saisons. La cible actuelle reste appliquée entre-temps.
        </p>
      </div>
    );
  }
  if (verdict.kind === "unstable") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink leading-relaxed">
          <strong>Signature instable</strong> — la relation NC/DJR est trop bruitée
          (<span className="font-mono tabular-nums">R² {verdict.r2.toFixed(2)}</span>).
        </p>
        <p className="text-[13px] text-ink/50 leading-relaxed">
          Probable changement de régime : rénovation partielle, changement d&apos;usage, incidents. La calibration automatique est désactivée — à investiguer manuellement avant toute action sur la cible.
        </p>
      </div>
    );
  }

  const v = verdict;
  const current = site.points[0].currentNb;
  const djc = site.points[0].djc;
  const absDelta = Math.abs(v.deltaMwh);
  const absPct = Math.abs(v.deltaPct);
  const direction = v.severity === "LACHE" ? "trop haut" : v.severity === "SERREE" ? "trop bas" : null;

  return (
    <div className="space-y-4">
      {/* Chiffres clés empilés */}
      <div className="divide-y divide-ink/10 border-y border-ink/15">
        <NarrativeRow label="Cible contractuelle" value={`${current.toFixed(0)} MWh`} tone="gray" />
        <NarrativeRow
          label="Cible selon signature"
          value={`${v.nbRefMwh.toFixed(0)} MWh`}
          tone={v.severity === "OK" ? "emerald" : v.severity === "LACHE" ? "amber" : "rose"}
          highlight
        />
        <NarrativeRow
          label="Écart"
          value={`${v.deltaMwh > 0 ? "+" : ""}${v.deltaMwh.toFixed(0)} MWh`}
          sub={`${v.deltaPct > 0 ? "+" : ""}${v.deltaPct.toFixed(1)} %`}
          tone={v.severity === "LACHE" ? "amber" : v.severity === "SERREE" ? "rose" : "gray"}
        />
      </div>

      {/* Phrase narrative */}
      <p className="text-[13px] text-ink/60 leading-relaxed">
        À conditions contractuelles (<span className="font-mono tabular-nums">DJC {djc.toLocaleString("fr-FR")}</span>),
        la signature prédit <strong className="font-mono text-ink tabular-nums">{v.nbRefMwh.toFixed(0)} MWh</strong>.
        La cible actuelle de <strong className="font-mono tabular-nums">{current.toFixed(0)} MWh</strong>
        {direction ? (
          <> est donc <strong className="text-ink">{direction} de {absDelta.toFixed(0)} MWh ({absPct.toFixed(0)} %)</strong>.</>
        ) : (
          <> est cohérente avec l&apos;historique (écart ≤ 10 %).</>
        )}
      </p>

      {/* Reco */}
      {v.severity !== "OK" && (
        <div className="pt-3 border-t border-ink/10">
          <div className="label-tech mb-1.5">Recommandation</div>
          <p className="text-sm text-ink leading-relaxed">
            {v.severity === "LACHE" ? "Durcir la cible" : "Renégocier la cible à la hausse"} vers{" "}
            <strong className="font-mono tabular-nums text-accent">{v.nbRefMwh.toFixed(0)} MWh</strong>.
          </p>
        </div>
      )}

      {/* Qualité du fit */}
      <div className="pt-3 border-t border-ink/10 text-[11px] text-ink/50 space-y-1">
        <div className="flex items-center justify-between">
          <span>Qualité du fit</span>
          <span className="font-mono tabular-nums font-medium text-ink">R² {v.r2.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Saisons retenues</span>
          <span className="font-mono tabular-nums">{v.usedPoints.length} / {site.points.length}</span>
        </div>
      </div>
      <p className="text-[10px] text-ink/40">
        {v.method}
      </p>
    </div>
  );
}

function NarrativeRow({
  label,
  value,
  sub,
  tone = "gray",
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "gray" | "amber" | "rose" | "emerald";
  highlight?: boolean;
}) {
  const toneClass = {
    gray: "text-ink",
    amber: "text-amber-700",
    rose: "text-red-700",
    emerald: "text-green-700",
  }[tone];
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="label-tech">{label}</span>
      <div className="text-right">
        <span className={`font-mono text-sm tabular-nums ${highlight ? "font-bold" : "font-semibold"} ${toneClass}`}>
          {value}
        </span>
        {sub && <span className="font-mono text-[11px] text-ink/50 ml-1.5 tabular-nums">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Scatter plot ────────────────────────────────────────────────

function SignatureChart({
  points,
  verdict,
  onTogglePoint,
}: {
  points: SeasonPoint[];
  verdict: Verdict;
  onTogglePoint?: (year: number) => void;
}) {
  if (points.length === 0) return null;

  const W = 520, H = 280, P = 40;
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

  // Gridlines Y : 3 niveaux
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
        {/* Gridlines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={P} y1={yScale(t)} x2={W - P} y2={yScale(t)} stroke="#0F1E33" strokeOpacity={0.08} />
            <text x={P - 6} y={yScale(t) + 3} fontSize={9} fill="#0F1E33" fillOpacity={0.4} textAnchor="end" fontFamily="var(--font-mono, monospace)">
              {Math.round(t).toLocaleString("fr-FR")}
            </text>
          </g>
        ))}
        {/* Axes */}
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#0F1E33" strokeOpacity={0.15} />
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="#0F1E33" strokeOpacity={0.15} />

        {/* DJC vertical — "conditions contractuelles" */}
        <line x1={djcX} y1={P} x2={djcX} y2={H - P} stroke="#0F1E33" strokeOpacity={0.3} strokeDasharray="3 3" />
        <text x={djcX - 5} y={P + 11} fontSize={10} fill="#0F1E33" fillOpacity={0.5} textAnchor="end" fontFamily="var(--font-mono, monospace)">
          DJC {Math.round(djcVal).toLocaleString("fr-FR")}
        </text>

        {/* Ligne cible contractuelle (NB actuel) — horizontale, tireté accent */}
        <line x1={P} y1={currentNbY} x2={W - P} y2={currentNbY} stroke="#2563EB" strokeDasharray="5 5" strokeWidth={1.5} />
        <text x={P + 6} y={currentNbY - 4} fontSize={10} fill="#2563EB" textAnchor="start" fontFamily="var(--font-mono, monospace)">
          Cible contractuelle {points[0].currentNb.toFixed(0)}
        </text>

        {/* Bande de confiance (simple halo autour de la régression) */}
        {lineSeg && verdict.kind === "calibrated" && (
          <polygon
            points={`${lineSeg.x1},${lineSeg.y1 - 8} ${lineSeg.x2},${lineSeg.y2 - 8} ${lineSeg.x2},${lineSeg.y2 + 8} ${lineSeg.x1},${lineSeg.y1 + 8}`}
            fill="#0F1E33"
            opacity={0.06}
          />
        )}

        {/* Droite de signature énergétique */}
        {lineSeg && (
          <line x1={lineSeg.x1} y1={lineSeg.y1} x2={lineSeg.x2} y2={lineSeg.y2} stroke="#0F1E33" strokeWidth={2} />
        )}

        {/* Annotation delta NB actuel ↔ NB ref à x=DJC — le KEY insight visuel */}
        {nbRefY !== null && verdict.kind === "calibrated" && (() => {
          const delta = verdict.deltaMwh;
          const severe = verdict.severity !== "OK";
          const deltaColor = verdict.severity === "LACHE" ? "#b45309" : verdict.severity === "SERREE" ? "#b91c1c" : "#0F1E33";
          const top = Math.min(currentNbY, nbRefY);
          const bot = Math.max(currentNbY, nbRefY);
          const mid = (top + bot) / 2;
          // Flèche verticale le long de la ligne DJC
          return severe ? (
            <g>
              <line x1={djcX} y1={top + 2} x2={djcX} y2={bot - 2} stroke={deltaColor} strokeWidth={2} />
              {/* Têtes de flèche */}
              <polygon points={`${djcX - 4},${top + 6} ${djcX + 4},${top + 6} ${djcX},${top}`} fill={deltaColor} />
              <polygon points={`${djcX - 4},${bot - 6} ${djcX + 4},${bot - 6} ${djcX},${bot}`} fill={deltaColor} />
              {/* Label delta */}
              <rect
                x={djcX - 32}
                y={mid - 8}
                width={64}
                height={16}
                fill="white"
                stroke={deltaColor}
                strokeWidth={0.8}
              />
              <text x={djcX} y={mid + 4} fontSize={10} fontWeight={700} fill={deltaColor} textAnchor="middle" fontFamily="var(--font-mono, monospace)">
                {delta > 0 ? "+" : ""}{Math.round(delta)} MWh
              </text>
            </g>
          ) : null;
        })()}

        {/* Point cible selon signature (NB ref) */}
        {nbRefY !== null && verdict.kind === "calibrated" && (
          <g>
            <circle cx={djcX} cy={nbRefY} r={5} fill="#0F1E33" />
            <circle cx={djcX} cy={nbRefY} r={10} fill="none" stroke="#0F1E33" strokeOpacity={0.25} strokeWidth={1} />
          </g>
        )}
        {/* Label "cible selon signature" placé à l'extérieur pour éviter collision avec le delta */}
        {nbRefY !== null && verdict.kind === "calibrated" && (
          <text
            x={djcX + 14}
            y={nbRefY + (currentNbY < nbRefY ? 12 : -8)}
            fontSize={10}
            fill="#0F1E33"
            fontWeight={700}
            fontFamily="var(--font-mono, monospace)"
          >
            Cible signature {verdict.nbRefMwh.toFixed(0)}
          </text>
        )}

        {/* Data points — cliquables si onTogglePoint fourni */}
        {points.map((p) => {
          const excluded = excludedYears.has(p.year);
          return (
            <g
              key={p.year}
              onClick={() => onTogglePoint?.(p.year)}
              style={{ cursor: onTogglePoint ? "pointer" : undefined }}
            >
              {/* Hit area plus large */}
              {onTogglePoint && (
                <circle
                  cx={xScale(p.djr)}
                  cy={yScale(p.nc / 1000)}
                  r={12}
                  fill="transparent"
                />
              )}
              <circle
                cx={xScale(p.djr)}
                cy={yScale(p.nc / 1000)}
                r={4.5}
                fill={excluded ? "#ffffff" : "#0F1E33"}
                stroke={excluded ? "#0F1E33" : "#0F1E33"}
                strokeOpacity={excluded ? 0.25 : 1}
                strokeWidth={1.5}
                strokeDasharray={excluded ? "2 2" : undefined}
              >
                <title>
                  {`Saison ${p.year - 1}-${p.year}\nNC : ${(p.nc / 1000).toFixed(0)} MWh\nDJR : ${Math.round(p.djr).toLocaleString("fr-FR")}${excluded ? "\n(exclue)" : ""}`}
                </title>
              </circle>
              <text
                x={xScale(p.djr)}
                y={yScale(p.nc / 1000) - 9}
                fontSize={9}
                fill="#0F1E33"
                fillOpacity={excluded ? 0.35 : 0.7}
                textAnchor="middle"
                fontFamily="var(--font-mono, monospace)"
                pointerEvents="none"
              >
                {`${p.year - 1}-${p.year.toString().slice(2)}`}
              </text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={W / 2} y={H - 6} fontSize={10} fill="#0F1E33" fillOpacity={0.4} textAnchor="middle" fontFamily="var(--font-mono, monospace)">
          DJU observés (DJR saison)
        </text>
        <text x={14} y={H / 2} fontSize={10} fill="#0F1E33" fillOpacity={0.4} transform={`rotate(-90, 14, ${H / 2})`} fontFamily="var(--font-mono, monospace)">
          Conso chauffage (MWh)
        </text>
      </svg>
    </div>
  );
}
