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
  djrTotal: number;
  djuContractuel: number | null;
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
  // Par défaut, on affiche la dernière saison complète et non la saison en
  // cours : sinon DJR partiel (~50 % de l'historique) crée un faux verdict
  // 'économie' (ex : −47 % à mi-saison parce que le froid n'est pas encore tombé).
  const [year, setYear] = useState<number>(() => {
    if (yearType === "CIVIL") {
      const now = new Date();
      // Année civile précédente si on est au 1er semestre
      return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
    }
    return currentHeatingSeasonYear() - 1;
  });

  const key = `/api/consumptions/analytics?contractId=${contractId}&year=${year}&yearType=${yearType}`;
  const { data, isLoading } = useSWR<AnalyticsResponse>(key, fetcher);

  const comparableSites = useMemo(
    () => (data?.sites ?? []).filter((s) => s.nb != null),
    [data]
  );

  // On trie par IMPACT (MWh absolu), pas par %. Un gros site à +5 % pèse
  // souvent plus qu'un petit à +30 %, et c'est l'impact qui compte pour
  // l'intéressement, les pénalités et la facture finale.
  const worst = useMemo(() => {
    const inDepassement = comparableSites.filter((s) => s.status === "DEPASSEMENT");
    return inDepassement.sort((a, b) => b.delta - a.delta)[0] ?? null;
  }, [comparableSites]);

  const best = useMemo(() => {
    const inEconomie = comparableSites.filter((s) => s.status === "ECONOMIE");
    return inEconomie.sort((a, b) => a.delta - b.delta)[0] ?? null;
  }, [comparableSites]);

  const periodLabel = yearType === "CIVIL" ? `${year}` : `${year - 1}—${year}`;
  const canNext = yearType === "CIVIL"
    ? year < new Date().getFullYear()
    : year < currentHeatingSeasonYear();

  const summary = data?.summary;
  const total = summary
    ? summary.sitesEnEconomie + summary.sitesObjectifAtteint + summary.sitesEnDepassement
    : 0;

  // ─── Analyse climatique ────────────────────────────────────────
  // DJR moyen de la saison sur les sites comparables vs DJC du contrat.
  // Si DJR < DJC de plus de 5 %, l'hiver a été plus doux que prévu → les
  // dérives ne peuvent PAS être imputées au climat (ce qui est le killer).
  const climate = useMemo(() => {
    if (comparableSites.length === 0) return null;
    const djc = comparableSites.find((s) => s.djuContractuel && s.djuContractuel > 0)?.djuContractuel;
    if (!djc) return null;
    const djrValues = comparableSites.map((s) => s.djrTotal).filter((v) => v > 0);
    if (djrValues.length === 0) return null;
    const djrAvg = djrValues.reduce((a, b) => a + b, 0) / djrValues.length;
    const pctVsDjc = ((djrAvg - djc) / djc) * 100;
    // Seuil 5 % pour écarter les variations mineures
    if (pctVsDjc <= -5) return { kind: "doux" as const, djrAvg, djc, pctVsDjc };
    if (pctVsDjc >= 5) return { kind: "rigoureux" as const, djrAvg, djc, pctVsDjc };
    return { kind: "normal" as const, djrAvg, djc, pctVsDjc };
  }, [comparableSites]);

  // ─── Narratif ────────────────────────────────────────────────────
  // On lead avec un VERDICT global (pas un ratio de sites), puis on raconte
  // l'histoire : s'il y a des dérives qui compensent des économies, on le dit.
  // Objectif : lecture en 5 sec, pas de redondance avec la gauge en-dessous.
  const insight = useMemo(() => {
    if (!summary || total === 0) return null;

    const globalDelta = summary.deltaPercent;
    const dep = summary.sitesEnDepassement;
    const eco = summary.sitesEnEconomie;

    // ─ Verdict global
    let headline: string;
    let tone: "good" | "neutral" | "warning" | "bad";
    if (globalDelta <= -5) {
      headline = `Saison en économie : ${fmtPct(globalDelta, 1)}`;
      tone = "good";
    } else if (globalDelta < 5) {
      headline = `Contrat à l'équilibre (${fmtPct(globalDelta, 1)} global)`;
      tone = "neutral";
    } else if (globalDelta < 15) {
      headline = `Contrat en léger dépassement : ${fmtPct(globalDelta, 1)}`;
      tone = "warning";
    } else {
      headline = `Contrat en dérive : ${fmtPct(globalDelta, 1)}`;
      tone = "bad";
    }

    // ─ Détail — l'histoire derrière le verdict
    let detail: React.ReactNode;

    if (dep === 0) {
      // Pas de dérive : célébration nette ou équilibre calme
      detail = tone === "good" ? (
        <>
          Équivalent à <strong className="text-emerald-700 tabular-nums">
            {fmtMwh(summary.totalDelta)} MWh économisés
          </strong> sur la saison. Aucun site en dérive.
          {best && (
            <>
              {" "}Le plus performant : <strong className="text-primary-dark">{best.siteName}</strong>{" "}
              <span className="tabular-nums">{fmtPct(best.deltaPercent)}</span>.
            </>
          )}
        </>
      ) : (
        <>
          <strong className="text-primary-dark tabular-nums">{total} sites</strong> comparables,
          tous dans la fenêtre de performance. Pas de site en dérive.
        </>
      );
    } else if (dep === 1 && worst) {
      // Un seul outlier — on le nomme, on explique la pondération s'il y a de l'économie
      detail = tone === "good" ? (
        <>
          Malgré <strong className="text-primary-dark">{worst.siteName}</strong>{" "}
          <span className="text-text-secondary">
            (+<span className="tabular-nums">{fmtMwh(worst.delta)}</span> MWh · {fmtPct(worst.deltaPercent)})
          </span>,
          les {eco} sites en économie tirent le contrat vers le bas.
        </>
      ) : (
        <>
          Un seul site en cause : <strong className="text-primary-dark">{worst.siteName}</strong>,{" "}
          <strong className="text-amber-800 tabular-nums">+{fmtMwh(worst.delta)} MWh</strong>{" "}
          <span className="text-text-secondary">(soit {fmtPct(worst.deltaPercent)} vs cible)</span>.
        </>
      );
    } else if (dep >= 2 && worst) {
      // Plusieurs dérives : on nomme l'impact le plus lourd (MWh absolu),
      // pas le % le plus élevé — un gros site à +5 % coûte plus qu'un petit à +30 %.
      const compensation = eco > 0 && globalDelta < 5
        ? (
          <>
            {" "}Les <strong className="text-emerald-700 tabular-nums">{eco} sites en économie</strong>{" "}
            compensent et maintiennent le contrat à l&apos;équilibre.
          </>
        )
        : null;
      detail = (
        <>
          <strong className="text-primary-dark tabular-nums">{dep} sites en dérive</strong>.
          Impact principal : <strong className="text-primary-dark">{worst.siteName}</strong>{" "}
          <strong className="text-amber-800 tabular-nums">+{fmtMwh(worst.delta)} MWh</strong>{" "}
          <span className="text-text-secondary">(soit {fmtPct(worst.deltaPercent)} vs cible)</span>.
          {compensation}
        </>
      );
    } else {
      detail = null;
    }

    // ─ CTA
    const cta = worst
      ? { label: `Examiner ${worst.siteName}`, href: `/energy/sites/${worst.siteId}` }
      : best
      ? { label: `Voir ${best.siteName}`, href: `/energy/sites/${best.siteId}` }
      : { label: "Voir le détail", href: `/energy?contractId=${contractId}` };

    return { headline, detail, cta, tone };
  }, [summary, total, worst, best, contractId]);

  // ─── Contexte climatique ajouté au narratif ───────────────────────
  // On le sort quand il change la lecture des résultats : hiver doux +
  // dérive = zéro excuse possible. Hiver rigoureux + éco = perf notable.
  const climateContext = useMemo((): React.ReactNode => {
    if (!climate || !summary || climate.kind === "normal") return null;
    const djrStr = Math.round(climate.djrAvg).toLocaleString("fr-FR");
    const djcStr = Math.round(climate.djc).toLocaleString("fr-FR");
    const pctStr = Math.round(Math.abs(climate.pctVsDjc));

    if (climate.kind === "doux" && summary.deltaPercent >= 5) {
      return (
        <>
          Hiver plus doux que la cible (<span className="tabular-nums">DJR {djrStr} vs DJC {djcStr}</span>, −{pctStr} %) : ces dérives sont
          <strong className="text-primary-dark"> 100 % comportementales</strong>, aucune excuse météo.
        </>
      );
    }
    if (climate.kind === "doux" && summary.deltaPercent <= -5) {
      return (
        <>
          À noter : l&apos;hiver a été −{pctStr} % plus doux (<span className="tabular-nums">DJR {djrStr} vs DJC {djcStr}</span>).
          Une partie de l&apos;économie est attribuable au climat — la N&apos;B en tient compte mais reste un signal à lire avec ce contexte.
        </>
      );
    }
    if (climate.kind === "rigoureux" && summary.deltaPercent >= 5) {
      return (
        <>
          Hiver plus rigoureux que la cible (<span className="tabular-nums">DJR {djrStr} vs DJC {djcStr}</span>, +{pctStr} %) :
          la N&apos;B est déjà ajustée climatiquement, la dérive restante est
          <strong className="text-primary-dark"> bien d&apos;origine exploitation</strong>.
        </>
      );
    }
    if (climate.kind === "rigoureux" && summary.deltaPercent <= -5) {
      return (
        <>
          Performance remarquable : <strong className="text-emerald-700">économie malgré un hiver +{pctStr} % plus rigoureux</strong>{" "}
          (<span className="tabular-nums">DJR {djrStr} vs DJC {djcStr}</span>).
        </>
      );
    }
    return null;
  }, [climate, summary]);

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

  const toneBorder =
    insight.tone === "bad" ? "border-rose-200/70"
    : insight.tone === "warning" ? "border-amber-200/60"
    : insight.tone === "good" ? "border-emerald-200/60"
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
        {climateContext && (
          <div className="mt-4 text-[13px] text-text-secondary border-l-2 border-gray-200 pl-3 max-w-3xl">
            {climateContext}
          </div>
        )}
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
      <div className="px-8 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-4">
        <Link
          href={`/rapports/calibration-cibles?contract=${contractId}`}
          className="text-xs text-text-secondary hover:text-primary-dark transition-colors"
        >
          Diagnostic calibration des cibles →
        </Link>
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
