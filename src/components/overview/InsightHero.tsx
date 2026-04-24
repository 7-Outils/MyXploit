"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowRight, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";

interface SitePerf {
  siteId: string;
  siteName: string;
  nb: number | null;
  deltaPercent: number;
  delta: number;
  nc: number;
  nbPrime: number;
  status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT";
}

interface SummaryPayload {
  totalSites: number;
  totalNc: number;
  totalNbPrime: number;
  totalDelta: number;
  deltaPercent: number;
  sitesEnEconomie: number;
  sitesObjectifAtteint: number;
  sitesEnDepassement: number;
}

interface AnalyticsResponse {
  year: number;
  sites: SitePerf[];
  summary: SummaryPayload;
}

interface Props {
  contractId: string;
  yearType: "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";
}

function currentHeatingSeasonYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

function fmtMwh(kwh: number): string {
  return Math.round(Math.abs(kwh) / 1000).toLocaleString("fr-FR");
}

function fmtPct(v: number, d = 0): string {
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return (r > 0 ? "+" : "") + r.toFixed(d) + "%";
}

export default function InsightHero({ contractId, yearType }: Props) {
  const [year, setYear] = useState<number>(() =>
    yearType === "CIVIL" ? new Date().getFullYear() : currentHeatingSeasonYear()
  );

  const key = `/api/consumptions/analytics?contractId=${contractId}&year=${year}&yearType=${yearType}`;
  const { data, isLoading } = useSWR<AnalyticsResponse>(key, fetcher);

  const comparableSites = useMemo(
    () => (data?.sites ?? []).filter((s) => s.nb != null),
    [data]
  );

  const worst = useMemo(() => {
    const inDepassement = comparableSites.filter((s) => s.status === "DEPASSEMENT");
    return inDepassement.sort((a, b) => b.deltaPercent - a.deltaPercent)[0] ?? null;
  }, [comparableSites]);

  const best = useMemo(() => {
    const inEconomie = comparableSites.filter((s) => s.status === "ECONOMIE");
    return inEconomie.sort((a, b) => a.deltaPercent - b.deltaPercent)[0] ?? null;
  }, [comparableSites]);

  const periodLabel = yearType === "CIVIL" ? `${year}` : `${year - 1}—${year}`;
  const canNext = yearType === "CIVIL"
    ? year < new Date().getFullYear()
    : year < currentHeatingSeasonYear();

  const summary = data?.summary;
  const total = summary
    ? summary.sitesEnEconomie + summary.sitesObjectifAtteint + summary.sitesEnDepassement
    : 0;

  // ─── Narratif ────────────────────────────────────────────────────
  // Ordre de priorité :
  // 1. rien à afficher (pas de sites avec cible)
  // 2. un site unique dérape → on nomme
  // 3. plusieurs sites dérivent → on quantifie + nomme le pire
  // 4. saison en économie nette → on célèbre
  // 5. tout est à l'objectif pile → mention brève
  const insight = useMemo(() => {
    if (!summary || total === 0) return null;

    const pctOnTarget = Math.round(((summary.sitesEnEconomie + summary.sitesObjectifAtteint) / total) * 100);

    // Cas 1 : un seul outlier
    if (summary.sitesEnDepassement === 1 && worst) {
      return {
        tone: "warning" as const,
        headline: `${pctOnTarget} % des sites à l'objectif.`,
        detail: (
          <>
            Seul <strong className="text-primary-dark">{worst.siteName}</strong> dérape cette saison
            {" — "}
            <span className="tabular-nums">{fmtPct(worst.deltaPercent)}</span>{" "}
            <span className="text-text-secondary">
              (+{fmtMwh(worst.delta)} MWh vs cible)
            </span>.
          </>
        ),
        cta: { label: `Voir ${worst.siteName}`, href: `/energy/sites/${worst.siteId}` },
      };
    }

    // Cas 2 : plusieurs sites dérivent
    if (summary.sitesEnDepassement >= 2 && worst) {
      return {
        tone: "warning" as const,
        headline: `${pctOnTarget} % des sites à l'objectif.`,
        detail: (
          <>
            <strong className="text-primary-dark">{summary.sitesEnDepassement} sites</strong> dérivent cette saison — pire :{" "}
            <strong className="text-primary-dark">{worst.siteName}</strong>{" "}
            <span className="tabular-nums">{fmtPct(worst.deltaPercent)}</span>{" "}
            <span className="text-text-secondary">
              (+{fmtMwh(worst.delta)} MWh vs cible)
            </span>.
          </>
        ),
        cta: { label: "Examiner les sites", href: `/energy?contractId=${contractId}&filter=depassement` },
      };
    }

    // Cas 3 : économie globale
    if (summary.deltaPercent <= -5) {
      return {
        tone: "good" as const,
        headline: `Saison en économie : ${fmtPct(summary.deltaPercent, 1)}.`,
        detail: (
          <>
            Équivalent à <strong className="text-emerald-700 tabular-nums">
              {fmtMwh(summary.totalDelta)} MWh économisés
            </strong> sur l&apos;ensemble du contrat.
            {best && (
              <>
                {" "}Le site le plus performant :{" "}
                <strong className="text-primary-dark">{best.siteName}</strong>{" "}
                <span className="tabular-nums">{fmtPct(best.deltaPercent)}</span>.
              </>
            )}
          </>
        ),
        cta: best
          ? { label: `Voir ${best.siteName}`, href: `/energy/sites/${best.siteId}` }
          : { label: "Voir tous les sites", href: `/energy?contractId=${contractId}` },
      };
    }

    // Cas 4 : tout pile à l'objectif
    return {
      tone: "neutral" as const,
      headline: `Tous les sites sont à l'objectif.`,
      detail: (
        <>
          <strong className="text-primary-dark tabular-nums">{total}</strong> sites comparables,
          aucun en dérive vs la cible ajustée DJU cette saison.
        </>
      ),
      cta: { label: "Voir le détail", href: `/energy?contractId=${contractId}` },
    };
  }, [summary, total, worst, best, contractId]);

  if (isLoading && !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 p-12 flex items-center justify-center min-h-[280px]">
        <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
      </div>
    );
  }

  if (!summary || total === 0 || !insight) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 p-12 text-center min-h-[280px] flex flex-col items-center justify-center">
        <div className="text-sm text-text-secondary max-w-sm">
          Aucun site avec cible énergétique (NB) renseignée pour cette saison.
          Renseigne les cibles dans <Link href="/contrat?tab=cibles" className="text-accent hover:underline">Contrat &gt; Cibles</Link> pour voir l&apos;état du contrat.
        </div>
      </div>
    );
  }

  const toneBorder = insight.tone === "warning"
    ? "border-amber-200/60"
    : insight.tone === "good"
    ? "border-emerald-200/60"
    : "border-gray-200/80";

  return (
    <section className={`bg-white rounded-xl border ${toneBorder} overflow-hidden`}>
      {/* Header : saison + navigation ─────────────────────────────── */}
      <div className="flex items-center justify-between px-8 pt-6 pb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-text-secondary font-semibold">
          Saison <span className="tabular-nums ml-1 text-primary-dark">{periodLabel}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setYear(year - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setYear(year + 1)}
            disabled={!canNext}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Narratif ──────────────────────────────────────────────── */}
      <div className="px-8 pt-6 pb-8">
        <h2 className="text-[28px] leading-[1.15] font-semibold text-primary-dark tracking-tight max-w-3xl">
          {insight.headline}
        </h2>
        <p className="text-[15px] text-text-secondary mt-3 leading-relaxed max-w-3xl">
          {insight.detail}
        </p>
      </div>

      {/* Gauge distribution ────────────────────────────────────── */}
      <div className="px-8 pb-6">
        <DistributionGauge
          economie={summary.sitesEnEconomie}
          objectif={summary.sitesObjectifAtteint}
          depassement={summary.sitesEnDepassement}
        />
      </div>

      {/* CTA footer ─────────────────────────────────────────────── */}
      <div className="px-8 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end">
        <Link
          href={insight.cta.href}
          className="inline-flex items-center gap-1.5 text-sm text-primary-dark font-medium hover:text-accent transition-colors"
        >
          {insight.cta.label}
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

function DistributionGauge({
  economie,
  objectif,
  depassement,
}: {
  economie: number;
  objectif: number;
  depassement: number;
}) {
  const total = economie + objectif + depassement;
  if (total === 0) return null;
  const pctE = (economie / total) * 100;
  const pctO = (objectif / total) * 100;
  const pctD = (depassement / total) * 100;

  return (
    <div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100 gap-[2px]">
        {economie > 0 && (
          <div className="bg-emerald-500 transition-all" style={{ width: `${pctE}%` }} />
        )}
        {objectif > 0 && (
          <div className="bg-gray-300 transition-all" style={{ width: `${pctO}%` }} />
        )}
        {depassement > 0 && (
          <div className="bg-amber-500 transition-all" style={{ width: `${pctD}%` }} />
        )}
      </div>
      <div className="flex items-center gap-6 mt-3 text-xs">
        <GaugeLegend color="bg-emerald-500" count={economie} label="en économie" tone="text-emerald-700" />
        <GaugeLegend color="bg-gray-300" count={objectif} label="à l'objectif" tone="text-gray-600" />
        <GaugeLegend color="bg-amber-500" count={depassement} label="en dépassement" tone="text-amber-700" />
      </div>
    </div>
  );
}

function GaugeLegend({
  color,
  count,
  label,
  tone,
}: {
  color: string;
  count: number;
  label: string;
  tone: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${color} shrink-0 translate-y-[-2px]`} />
      <span className={`tabular-nums font-semibold ${tone}`}>{count}</span>
      <span className="text-text-secondary">{label}</span>
    </div>
  );
}
