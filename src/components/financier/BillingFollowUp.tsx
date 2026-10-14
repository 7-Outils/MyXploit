"use client";

/**
 * Finances › Facturation : bandeau de suivi de l'échéancier pour la saison.
 * Replié (par défaut) : compteurs + une rangée de carrés, un par facture
 * attendue, dans l'ordre chronologique. Déplié : la planche de saison complète
 * (lecture seule). L'échéancier se modifie dans Contrat › Facturation.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";
import { cn } from "@/lib/utils";
import { BoardLegend, SeasonBoard, mergeExpected } from "@/components/billing/SeasonBoard";
import {
  HATCH,
  POSTES,
  STATUS_BLOCK,
  day,
  expectedTooltip,
  swrErrorMessage,
  type BillingScheduleResponse,
  type ExpectedInvoice,
} from "@/components/billing/shared";

const EXPANDED_KEY = "billing-followup-expanded";

const iconBtn =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center text-ink/50 transition-colors hover:bg-ink/[0.03] hover:text-accent disabled:pointer-events-none disabled:opacity-30";

function Count({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1.5 px-3 first:pl-0">
      <span className={cn("font-mono text-base font-medium tabular-nums", tone ?? "text-ink")}>{n}</span>
      <span className="text-xs text-ink/50">{label}</span>
    </span>
  );
}

export default function BillingFollowUp({ contractId }: { contractId: string }) {
  const base = `/api/contracts/${contractId}/billing-schedule`;
  const [seasonKey, setSeasonKey] = useState<string | null>(null);
  const url = seasonKey ? `${base}?season=${encodeURIComponent(seasonKey)}` : base;
  const { data, error, isLoading, isValidating } = useSWR<BillingScheduleResponse>(url, fetcher, {
    keepPreviousData: true,
  });

  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(EXPANDED_KEY) === "1");
    } catch {
      // stockage indisponible : replié
    }
  }, []);
  const toggle = () =>
    setExpanded((v) => {
      try {
        localStorage.setItem(EXPANDED_KEY, v ? "0" : "1");
      } catch {
        // ignore
      }
      return !v;
    });

  // Changement de contrat : retour à la saison en cours
  useEffect(() => setSeasonKey(null), [contractId]);

  const season = data?.season ?? null;
  const seasons = Array.isArray(data?.seasons) ? data.seasons : [];
  const lines = useMemo(() => (Array.isArray(data?.lines) ? data.lines : []), [data?.lines]);
  const expected = useMemo(() => (Array.isArray(data?.expected) ? data.expected : []), [data?.expected]);

  const strip = useMemo(() => {
    const order = (p: string) => POSTES.indexOf(p as (typeof POSTES)[number]);
    return [...expected].sort(
      (a, b) =>
        day(a.periodStart).getTime() - day(b.periodStart).getTime() ||
        order(a.poste) - order(b.poste) ||
        a.index - b.index
    );
  }, [expected]);

  const expectedByLine = useMemo(() => mergeExpected(lines, expected, season), [lines, expected, season]);

  if (isLoading && !data) {
    return (
      <div className="panel flex h-[52px] items-center px-4">
        <span className="label-tech">Échéancier</span>
        <Loader2 size={14} className="ml-3 animate-spin text-ink/40" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="panel flex items-center gap-3 px-4 py-3">
        <span className="label-tech">Échéancier</span>
        <span className="text-sm text-ink/60">{swrErrorMessage(error)}</span>
      </div>
    );
  }

  if (!season) return null;

  if (lines.length === 0) {
    return (
      <div className="panel flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="label-tech">Échéancier</span>
          <span className="text-sm text-ink/60">Aucun échéancier pour ce contrat</span>
        </div>
        <Link href="/contrat?tab=facturation" className={iconBtn} title="Définir l'échéancier (Contrat › Facturation)">
          <ArrowUpRight size={16} />
        </Link>
      </div>
    );
  }

  const counts = {
    RECUE: data?.counts?.RECUE ?? 0,
    ATTENDUE: data?.counts?.ATTENDUE ?? 0,
    EN_RETARD: data?.counts?.EN_RETARD ?? 0,
    A_VENIR: data?.counts?.A_VENIR ?? 0,
  };
  const idx = seasons.findIndex((s) => s.key === season.key);
  const now = new Date();
  // Position du trait « aujourd'hui » dans la rangée : avant le premier attendu qui n'a pas commencé
  const todayAt = season.isCurrent ? strip.findIndex((e) => day(e.periodStart) > now) : -2;

  const square = (e: ExpectedInvoice, i: number) => (
    <span
      key={e.key}
      title={expectedTooltip(e)}
      className={cn("block h-3.5 w-3.5 flex-shrink-0 animate-pop-in transition-transform hover:scale-125", STATUS_BLOCK[e.status])}
      style={{ animationDelay: `${i * 18}ms`, ...(e.status === "ATTENDUE" ? HATCH : {}) }}
    />
  );
  const todayMark = <span key="today" title="Aujourd'hui" className="mx-0.5 block h-5 w-px flex-shrink-0 bg-accent" />;

  return (
    <div className="panel">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1">
        <div className="flex items-center">
          <button
            type="button"
            className={iconBtn}
            title="Saison précédente"
            disabled={idx <= 0}
            onClick={() => idx > 0 && setSeasonKey(seasons[idx - 1].key)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[132px] text-center text-sm font-medium text-ink">
            {season.label}
            {isValidating && seasonKey !== null && season.key !== seasonKey && (
              <Loader2 size={11} className="ml-1.5 inline animate-spin text-ink/40" />
            )}
          </span>
          <button
            type="button"
            className={iconBtn}
            title="Saison suivante"
            disabled={idx < 0 || idx >= seasons.length - 1}
            onClick={() => idx < seasons.length - 1 && setSeasonKey(seasons[idx + 1].key)}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-baseline divide-x divide-ink/10">
          <Count n={counts.RECUE} label="reçues" />
          <Count n={counts.ATTENDUE} label="attendues" />
          <Count n={counts.EN_RETARD} label="en retard" tone={counts.EN_RETARD > 0 ? "text-red-700" : "text-ink/40"} />
          <Count n={counts.A_VENIR} label="à venir" tone="text-ink/50" />
        </div>

        <div className="ml-auto flex items-center">
          <Link href="/contrat?tab=facturation" className={iconBtn} title="Modifier l'échéancier (Contrat › Facturation)">
            <ArrowUpRight size={16} />
          </Link>
          <button
            type="button"
            className={iconBtn}
            title={expanded ? "Replier" : "Déplier la planche de la saison"}
            onClick={toggle}
            aria-expanded={expanded}
          >
            <ChevronDown size={16} className={cn("transition-transform duration-200", expanded && "rotate-180")} />
          </button>
        </div>
      </div>

      {!expanded ? (
        <div key={season.key} className="flex flex-wrap items-center gap-1 border-t border-ink/10 px-4 py-2.5">
          {strip.map((e, i) => (i === todayAt ? [todayMark, square(e, i)] : square(e, i)))}
          {todayAt === -1 && todayMark}
        </div>
      ) : (
        <div className="border-t border-ink/10 animate-fade-in">
          <SeasonBoard season={season} lines={lines} expectedByLine={expectedByLine} labelWidth={220} />
          <div className="border-t border-ink/10 px-4 py-2">
            <BoardLegend />
          </div>
        </div>
      )}
    </div>
  );
}
