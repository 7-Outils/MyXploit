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

  const t = tone(oldestDays);

  return (
    <Link
      href={`/exploitation?tab=suivi-p3&contractId=${contractId}`}
      className={`group bg-white rounded-xl border ${t.border} hover:border-accent/50 px-5 py-4 flex items-center gap-4 transition-colors`}
    >
      <div className="w-10 h-10 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
        <Wrench size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${t.emphasis}`}>
            Suivi travaux
          </span>
          <span className={`text-sm font-semibold tabular-nums ${t.emphasis}`}>
            {headlineText({ count, finishedCount, inProgressCount })}
          </span>
        </div>
        <p className="text-[12px] text-text-secondary mt-1 leading-snug">
          {oldest && oldestDays !== null && oldest.quote.site && (
            <>
              Plus ancien : <strong className="text-primary-dark">{oldest.quote.title || oldest.quote.reference}</strong>{" "}
              ({oldest.quote.site.name}) <span className="tabular-nums">il y a {oldestDays} j</span>.
            </>
          )}
          {" "}
          {Object.entries(byStatus)
            .sort(([a], [b]) => (a === "ATTENTE_LEVEE" ? -1 : b === "ATTENTE_LEVEE" ? 1 : 0))
            .map(([status, items], i, arr) => (
              <span key={status}>
                <span className="tabular-nums font-semibold text-primary-dark">{items.length}</span>{" "}
                {STATUS_REASON[status] ?? status.toLowerCase()}
                {i < arr.length - 1 ? " · " : ""}
              </span>
            ))}
          {totalAmount > 0 && (
            <>
              {" · "}
              <span className="tabular-nums font-semibold text-primary-dark">
                {Math.round(totalAmount).toLocaleString("fr-FR")} €
              </span> engagés
            </>
          )}
        </p>
      </div>

      <ArrowRight size={16} className="text-gray-300 group-hover:text-accent transition-colors shrink-0" />
    </Link>
  );
}

function headlineText({ count, finishedCount, inProgressCount }: { count: number; finishedCount: number; inProgressCount: number }) {
  if (finishedCount > 0 && inProgressCount > 0) {
    return `${count} chantiers ouverts (${finishedCount} à clôturer, ${inProgressCount} en cours)`;
  }
  if (finishedCount > 0) {
    return `${finishedCount} travaux à clôturer`;
  }
  return `${inProgressCount} chantier${inProgressCount > 1 ? "s" : ""} en cours`;
}
