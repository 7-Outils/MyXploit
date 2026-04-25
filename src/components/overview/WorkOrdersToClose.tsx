"use client";

import Link from "next/link";
import { useMemo } from "react";
import useSWR from "swr";
import { ArrowRight, Wrench } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";

type WorkStatus =
  | "PLANIFIE" | "EN_COURS" | "TERMINE"
  | "ATTENTE_ATTACHEMENT" | "ATTENTE_LEVEE"
  | "CLOTURE" | "ANNULE";

interface WorkOrder {
  id: string;
  status: WorkStatus;
  planifiedDate: string | null;
  startDate: string | null;
  completionDate: string | null;
  createdAt: string;
  quote: {
    reference: string;
    title: string | null;
    amountHT: number | null;
    site: { id: string; name: string } | null;
  };
}

interface Props {
  contractId: string;
}

const OPEN_STATUSES: WorkStatus[] = [
  "PLANIFIE", "EN_COURS",
  "TERMINE", "ATTENTE_ATTACHEMENT", "ATTENTE_LEVEE",
];

const STATUS_REASON: Record<string, string> = {
  PLANIFIE:            "planifié",
  EN_COURS:            "en cours d'exécution",
  TERMINE:             "prêt pour clôture",
  ATTENTE_ATTACHEMENT: "en attente d'attachement",
  ATTENTE_LEVEE:       "réserves non levées",
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function tone(oldestDays: number | null) {
  const urgent = oldestDays !== null && oldestDays > 60;
  const warning = oldestDays !== null && oldestDays > 30;
  if (urgent) return { border: "border-rose-200/70", emphasis: "text-rose-700" };
  if (warning) return { border: "border-amber-200/60", emphasis: "text-amber-700" };
  return { border: "border-gray-200/80", emphasis: "text-primary-dark" };
}

export default function WorkOrdersToClose({ contractId }: Props) {
  const { data } = useSWR<{ workOrders: WorkOrder[] }>(
    `/api/work-orders?contractId=${contractId}`,
    fetcher
  );

  const stats = useMemo(() => {
    const list = Array.isArray(data?.workOrders) ? data!.workOrders : [];
    const open = list.filter((w) => OPEN_STATUSES.includes(w.status));
    if (open.length === 0) return null;

    const finishedAwaitingClosure = open.filter((w) =>
      w.status === "TERMINE" || w.status === "ATTENTE_ATTACHEMENT" || w.status === "ATTENTE_LEVEE"
    );
    const inProgress = open.filter((w) => w.status === "PLANIFIE" || w.status === "EN_COURS");

    const byStatus = open.reduce<Record<string, WorkOrder[]>>((acc, w) => {
      (acc[w.status] = acc[w.status] || []).push(w);
      return acc;
    }, {});

    // Plus ancien par completionDate (chantiers finis) sinon par createdAt
    const refDate = (w: WorkOrder) =>
      w.completionDate ? new Date(w.completionDate).getTime() : new Date(w.createdAt).getTime();
    const oldest = [...open].sort((a, b) => refDate(a) - refDate(b))[0];
    const oldestDays = daysSince(
      oldest?.completionDate ?? oldest?.createdAt ?? null
    );

    const totalAmount = open.reduce((s, w) => s + (w.quote.amountHT ?? 0), 0);

    return { open, byStatus, oldest, oldestDays, totalAmount, count: open.length, finishedAwaitingClosure, inProgress };
  }, [data]);

  if (!stats) return null;

  const { count, byStatus, oldest, oldestDays, totalAmount, finishedAwaitingClosure, inProgress } = stats;
  const finishedCount = finishedAwaitingClosure.length;
  const inProgressCount = inProgress.length;

  // Headline qui s'adapte au mix
  const headline =
    finishedCount > 0 && inProgressCount > 0
      ? <><span className={`tabular-nums ${tone(oldestDays).emphasis}`}>{count}</span> chantiers ouverts <span className="text-text-secondary text-[18px] font-normal">— {finishedCount} à clôturer, {inProgressCount} en cours.</span></>
      : finishedCount > 0
      ? <><span className={`tabular-nums ${tone(oldestDays).emphasis}`}>{finishedCount}</span> travaux terminés attendent leur clôture.</>
      : <><span className={`tabular-nums ${tone(oldestDays).emphasis}`}>{inProgressCount}</span> chantiers en cours d&apos;exécution.</>;

  const t = tone(oldestDays);

  return (
    <section className={`bg-white rounded-xl border ${t.border} overflow-hidden`}>
      <div className="px-8 py-6">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-text-secondary font-semibold mb-2">
          <Wrench size={12} />
          <span>Suivi travaux</span>
        </div>

        <h2 className="text-[22px] leading-[1.2] font-semibold text-primary-dark tracking-tight max-w-3xl">
          {headline}
        </h2>

        <p className="text-[14px] text-text-secondary mt-3 leading-relaxed max-w-3xl">
          {oldest && oldestDays !== null && oldest.quote.site ? (
            <>
              Le plus ancien :{" "}
              <strong className="text-primary-dark">{oldest.quote.title || oldest.quote.reference}</strong>{" "}
              sur <strong className="text-primary-dark">{oldest.quote.site.name}</strong>,{" "}
              {oldest.completionDate ? "terminé" : "ouvert"}{" "}
              <strong className="text-primary-dark tabular-nums">il y a {oldestDays} j</strong>.
            </>
          ) : null}
          {" "}
          Détail :{" "}
          {Object.entries(byStatus)
            .sort(([a], [b]) => (a === "ATTENTE_LEVEE" ? -1 : b === "ATTENTE_LEVEE" ? 1 : 0))
            .map(([status, items], i, arr) => (
              <span key={status}>
                <strong className="text-primary-dark tabular-nums">{items.length}</strong>{" "}
                <span>{STATUS_REASON[status] ?? status.toLowerCase()}</span>
                {i < arr.length - 1 ? ", " : "."}
              </span>
            ))}
          {totalAmount > 0 && (
            <>
              {" "}Montant cumulé engagé non comptabilisé en P3 :{" "}
              <strong className="text-primary-dark tabular-nums">
                {Math.round(totalAmount).toLocaleString("fr-FR")} €
              </strong>.
            </>
          )}
        </p>
      </div>

      <div className="px-8 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end">
        <Link
          href={`/exploitation?tab=suivi-p3&contractId=${contractId}`}
          className="inline-flex items-center gap-1.5 text-sm text-primary-dark font-medium hover:text-accent transition-colors"
        >
          Ouvrir le suivi P3
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
