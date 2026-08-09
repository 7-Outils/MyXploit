"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const [autoAdvanced, setAutoAdvanced] = useState(false);

  // Reset l'auto-advance quand on change de contrat — chaque contrat doit
  // pouvoir réévaluer la meilleure saison à afficher au mount.
  useEffect(() => {
    setAutoAdvanced(false);
  }, [contractId]);

  const key = `/api/consumptions/analytics?contractId=${contractId}&year=${year}&yearType=${yearType}`;
  const { data, isLoading } = useSWR<AnalyticsResponse>(key, fetcher);

  // Si la saison par défaut (dernière complète) n'a aucun site comparable
  // (ni cibles, ni conso suffisante), on bascule auto sur la saison en cours.
  // Couvre les contrats récents (Bouffémont, cibles seulement sur l'année en cours)
  // et les saisons passées sans relevés (tous les sites en INCOMPLET).
  // Auto-advance unique pour ne pas créer de boucle.
  useEffect(() => {
    if (autoAdvanced || isLoading || !data) return;
    const s = data.summary;
    const usableSites = s
      ? s.sitesEnEconomie + s.sitesObjectifAtteint + s.sitesEnDepassement
      : 0;
    if (usableSites === 0) {
      const next = yearType === "CIVIL"
        ? new Date().getFullYear()
        : currentHeatingSeasonYear();
      if (year < next) {
        setYear(next);
        setAutoAdvanced(true);
      }
    }
  }, [data, isLoading, year, yearType, autoAdvanced]);

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
          Équivalent à <strong className="font-mono text-green-700 tabular-nums">
            {fmtMwh(summary.totalDelta)} MWh économisés
          </strong> sur la saison. Aucun site en dérive.
          {best && (
            <>
              {" "}Le plus performant : <strong className="text-ink">{best.siteName}</strong>{" "}
              <span className="font-mono tabular-nums">{fmtPct(best.deltaPercent)}</span>.
            </>
          )}
        </>
      ) : (
        <>
          <strong className="font-mono text-ink tabular-nums">{total} sites</strong> comparables,
          tous dans la fenêtre de performance. Pas de site en dérive.
        </>
      );
    } else if (dep === 1 && worst) {
      // Un seul outlier — on le nomme, on explique la pondération s'il y a de l'économie
      detail = tone === "good" ? (
        <>
          Malgré <strong className="text-ink">{worst.siteName}</strong>{" "}
          <span className="text-ink/50">
            (+<span className="font-mono tabular-nums">{fmtMwh(worst.delta)}</span> MWh · {fmtPct(worst.deltaPercent)})
          </span>,
          les {eco} sites en économie tirent le contrat vers le bas.
        </>
      ) : (
        <>
          Un seul site en cause : <strong className="text-ink">{worst.siteName}</strong>,{" "}
          <strong className="font-mono text-amber-700 tabular-nums">+{fmtMwh(worst.delta)} MWh</strong>{" "}
          <span className="text-ink/50">(soit {fmtPct(worst.deltaPercent)} vs cible)</span>.
        </>
      );
    } else if (dep >= 2 && worst) {
      // Plusieurs dérives : on nomme l'impact le plus lourd (MWh absolu),
      // pas le % le plus élevé — un gros site à +5 % coûte plus qu'un petit à +30 %.
      const compensation = eco > 0 && globalDelta < 5
        ? (
          <>
            {" "}Les <strong className="font-mono text-green-700 tabular-nums">{eco} sites en économie</strong>{" "}
            compensent et maintiennent le contrat à l&apos;équilibre.
          </>
        )
        : null;
      detail = (
        <>
          <strong className="font-mono text-ink tabular-nums">{dep} sites en dérive</strong>.
          Impact principal : <strong className="text-ink">{worst.siteName}</strong>{" "}
          <strong className="font-mono text-amber-700 tabular-nums">+{fmtMwh(worst.delta)} MWh</strong>{" "}
          <span className="text-ink/50">(soit {fmtPct(worst.deltaPercent)} vs cible)</span>.
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
          Hiver plus doux que la cible (<span className="font-mono tabular-nums">DJR {djrStr} vs DJC {djcStr}</span>, −{pctStr} %) : ces dérives sont
          <strong className="text-ink"> 100 % comportementales</strong>, aucune excuse météo.
        </>
      );
    }
    if (climate.kind === "doux" && summary.deltaPercent <= -5) {
      return (
        <>
          À noter : l&apos;hiver a été −{pctStr} % plus doux (<span className="font-mono tabular-nums">DJR {djrStr} vs DJC {djcStr}</span>).
          Une partie de l&apos;économie est attribuable au climat — la N&apos;B en tient compte mais reste un signal à lire avec ce contexte.
        </>
      );
    }
    if (climate.kind === "rigoureux" && summary.deltaPercent >= 5) {
      return (
        <>
          Hiver plus rigoureux que la cible (<span className="font-mono tabular-nums">DJR {djrStr} vs DJC {djcStr}</span>, +{pctStr} %) :
          la N&apos;B est déjà ajustée climatiquement, la dérive restante est
          <strong className="text-ink"> bien d&apos;origine exploitation</strong>.
        </>
      );
    }
    if (climate.kind === "rigoureux" && summary.deltaPercent <= -5) {
      return (
        <>
          Performance remarquable : <strong className="text-green-700">économie malgré un hiver +{pctStr} % plus rigoureux</strong>{" "}
          (<span className="font-mono tabular-nums">DJR {djrStr} vs DJC {djcStr}</span>).
        </>
      );
    }
    return null;
  }, [climate, summary]);

  if (isLoading && !data) {
    return (
      <div className="panel p-12 flex items-center justify-center min-h-[240px]">
        <Loader2 className="w-5 h-5 animate-spin text-ink/40" />
      </div>
    );
  }

  if (!summary || total === 0 || !insight) {
    return (
      <div className="panel overflow-hidden min-h-[240px] flex flex-col">
        <div className="panel-header">
          <div className="label-tech">
            Saison <span className="ml-1 tabular-nums text-ink">{periodLabel}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => { setYear(year - 1); setAutoAdvanced(true); }}
              className="w-7 h-7 flex items-center justify-center text-ink/40 hover:bg-ink/[0.04] hover:text-ink"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => { setYear(year + 1); setAutoAdvanced(true); }}
              disabled={!canNext}
              className="w-7 h-7 flex items-center justify-center text-ink/40 hover:bg-ink/[0.04] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-sm text-ink/50 max-w-sm text-center">
            Aucun site avec cible énergétique (NB) renseignée pour <span className="font-mono tabular-nums">{periodLabel}</span>.
            Renseigne les cibles dans <Link href="/contrat?tab=cibles" className="text-accent hover:underline">Contrat &gt; Cibles</Link>, ou navigue vers une autre saison ci-dessus.
          </div>
        </div>
      </div>
    );
  }

  // Le statut du contrat est porté par un filet haut sémantique (pas de card colorée).
  const toneRule =
    insight.tone === "bad" ? "border-t-2 border-t-red-600"
    : insight.tone === "warning" ? "border-t-2 border-t-amber-600"
    : insight.tone === "good" ? "border-t-2 border-t-green-600"
    : "border-t-2 border-t-ink";

  return (
    <section className={`panel overflow-hidden ${toneRule}`}>
      {/* Cartouche : saison + navigation ─────────────────────────── */}
      <div className="panel-header">
        <div className="label-tech">
          Saison <span className="ml-1 tabular-nums text-ink">{periodLabel}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setYear(year - 1)}
            className="w-7 h-7 flex items-center justify-center text-ink/40 hover:bg-ink/[0.04] hover:text-ink"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setYear(year + 1)}
            disabled={!canNext}
            className="w-7 h-7 flex items-center justify-center text-ink/40 hover:bg-ink/[0.04] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Narratif ──────────────────────────────────────────────── */}
      <div className="px-4 py-4">
        <h2 className="text-xl font-semibold leading-snug tracking-tight text-ink max-w-3xl">
          {insight.headline}
        </h2>
        <p className="text-sm text-ink/60 mt-2 leading-relaxed max-w-3xl">
          {insight.detail}
        </p>
        {climateContext && (
          <div className="mt-3 text-[13px] text-ink/60 border-l border-ink/15 pl-3 max-w-3xl">
            {climateContext}
          </div>
        )}
      </div>

      {/* Gauge distribution ────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <DistributionGauge
          economie={summary.sitesEnEconomie}
          objectif={summary.sitesObjectifAtteint}
          depassement={summary.sitesEnDepassement}
        />
      </div>

      {/* CTA footer ─────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-t border-ink/10 flex items-center justify-end">
        <Link
          href={insight.cta.href}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
        >
          {insight.cta.label}
          <ArrowRight size={13} />
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
      <div className="flex h-1.5 overflow-hidden bg-ink/[0.06] gap-[2px]">
        {economie > 0 && (
          <div className="bg-green-600 transition-all" style={{ width: `${pctE}%` }} />
        )}
        {objectif > 0 && (
          <div className="bg-ink/25 transition-all" style={{ width: `${pctO}%` }} />
        )}
        {depassement > 0 && (
          <div className="bg-amber-600 transition-all" style={{ width: `${pctD}%` }} />
        )}
      </div>
      <div className="flex items-center gap-6 mt-2.5 text-xs">
        <GaugeLegend color="bg-green-600" count={economie} label="en économie" tone="text-green-700" />
        <GaugeLegend color="bg-ink/25" count={objectif} label="à l'objectif" tone="text-ink" />
        <GaugeLegend color="bg-amber-600" count={depassement} label="en dépassement" tone="text-amber-700" />
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
      <span className={`font-mono tabular-nums font-semibold ${tone}`}>{count}</span>
      <span className="text-ink/50">{label}</span>
    </div>
  );
}
