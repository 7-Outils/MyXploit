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
  completionDate: string | null;
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

const ACTIONABLE_STATUSES: WorkStatus[] = ["TERMINE", "ATTENTE_ATTACHEMENT", "ATTENTE_LEVEE"];

const STATUS_LABEL: Record<string, { label: string; reason: string }> = {
  TERMINE:             { label: "à clôturer",   reason: "prêt pour clôture administrative" },
  ATTENTE_ATTACHEMENT: { label: "sans pj",      reason: "en attente d'attachement (preuve d'exécution)" },
  ATTENTE_LEVEE:       { label: "réserves",     reason: "réserves non levées" },
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export default function WorkOrdersToClose({ contractId }: Props) {
  const { data } = useSWR<{ workOrders: WorkOrder[] }>(
    `/api/work-orders?contractId=${contractId}`,
    fetcher
  );

  const stats = useMemo(() => {
    const list = Array.isArray(data?.workOrders) ? data!.workOrders : [];
    const open = list.filter((w) => ACTIONABLE_STATUSES.includes(w.status));
    if (open.length === 0) return null;

    const byStatus = open.reduce<Record<string, WorkOrder[]>>((acc, w) => {
      (acc[w.status] = acc[w.status] || []).push(w);
      return acc;
    }, {});

    // Oldest by completionDate (ou createdAt si pas de completionDate — on n'a que completionDate ici)
    const sortedByOld = [...open].sort((a, b) => {
      const da = a.completionDate ? new Date(a.completionDate).getTime() : Infinity;
      const db = b.completionDate ? new Date(b.completionDate).getTime() : Infinity;
      return da - db;
    });
    const oldest = sortedByOld[0];
    const oldestDays = daysSince(oldest?.completionDate ?? null);

    const totalAmount = open.reduce((s, w) => s + (w.quote.amountHT ?? 0), 0);

    return { open, byStatus, oldest, oldestDays, totalAmount, count: open.length };
  }, [data]);

  if (!stats) return null;

  const { count, byStatus, oldest, oldestDays, totalAmount } = stats;

  // Tone selon urgence (âge du plus vieux)
  const urgent = oldestDays !== null && oldestDays > 60;
  const warning = oldestDays !== null && oldestDays > 30;
  const tone =
    urgent ? { border: "border-rose-200/70", emphasis: "text-rose-700" }
    : warning ? { border: "border-amber-200/60", emphasis: "text-amber-700" }
    : { border: "border-gray-200/80", emphasis: "text-primary-dark" };

  return (
    <section className={`bg-white rounded-xl border ${tone.border} overflow-hidden`}>
      <div className="px-8 py-6">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-text-secondary font-semibold mb-2">
          <Wrench size={12} />
          <span>Suivi travaux</span>
        </div>

        <h2 className="text-[22px] leading-[1.2] font-semibold text-primary-dark tracking-tight max-w-3xl">
          <span className={`tabular-nums ${tone.emphasis}`}>{count}</span> travaux terminés attendent leur clôture.
        </h2>

        <p className="text-[14px] text-text-secondary mt-3 leading-relaxed max-w-3xl">
          {oldest && oldestDays !== null && oldest.quote.site ? (
            <>
              Le plus ancien :{" "}
              <strong className="text-primary-dark">{oldest.quote.title || oldest.quote.reference}</strong>{" "}
              sur <strong className="text-primary-dark">{oldest.quote.site.name}</strong>, terminé{" "}
              <strong className="text-primary-dark tabular-nums">il y a {oldestDays} j</strong>.
            </>
          ) : (
            <>Aucune date de fin renseignée pour le plus ancien.</>
          )}
          {" "}
          Détail :{" "}
          {Object.entries(byStatus)
            .sort(([a], [b]) => (a === "ATTENTE_LEVEE" ? -1 : b === "ATTENTE_LEVEE" ? 1 : 0))
            .map(([status, items], i, arr) => (
              <span key={status}>
                <strong className="text-primary-dark tabular-nums">{items.length}</strong>{" "}
                <span>{STATUS_LABEL[status]?.reason ?? status.toLowerCase()}</span>
                {i < arr.length - 1 ? ", " : "."}
              </span>
            ))}
          {totalAmount > 0 && (
            <>
              {" "}Montant cumulé non comptabilisé en P3 :{" "}
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
