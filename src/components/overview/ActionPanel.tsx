"use client";

import Link from "next/link";
import { useMemo } from "react";
import useSWR from "swr";
import { AlertTriangle, Calendar, ChevronRight, FileQuestion, Loader2, Wrench } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";

interface Alert {
  id: string;
  priority: "BASSE" | "MOYENNE" | "HAUTE" | "CRITIQUE";
  isRead: boolean;
  createdAt: string;
  siteId?: string | null;
}

interface Invoice {
  id: string;
  type: "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE";
  issueDate: string;
  contractId?: string | null;
}

interface WorkOrder {
  id: string;
  status: "PLANIFIE" | "EN_COURS" | "TERMINE" | "ATTENTE_ATTACHEMENT" | "ATTENTE_LEVEE" | "CLOTURE" | "ANNULE";
  completionDate: string | null;
}

interface Meeting {
  id: string;
  date: string;
}

interface Contract {
  id: string;
  startDate: string;
  billingFrequency?: "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";
}

interface Props {
  contract: Contract;
}

const PERIODS_PER_YEAR: Record<string, number> = {
  MENSUEL: 12,
  TRIMESTRIEL: 4,
  SEMESTRIEL: 2,
  ANNUEL: 1,
};

const PERIOD_LABEL: Record<string, string> = {
  MENSUEL: "mensuelle",
  TRIMESTRIEL: "trimestrielle",
  SEMESTRIEL: "semestrielle",
  ANNUEL: "annuelle",
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

function monthsElapsed(start: Date, end: Date): number {
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
}

export default function ActionPanel({ contract }: Props) {
  const cid = contract.id;

  // /api/alerts, /api/invoices, /api/meetings ignorent ?contractId= et renvoient
  // l'org entière → on filtre côté client. /api/work-orders renvoie {workOrders:[]}.
  const { data: alertsRaw, isLoading: la } = useSWR<Alert[]>(`/api/alerts`, fetcher);
  const { data: invoicesRaw, isLoading: li } = useSWR<Invoice[]>(`/api/invoices`, fetcher);
  const { data: workOrdersRaw, isLoading: lw } = useSWR<{ workOrders: WorkOrder[] }>(
    `/api/work-orders?contractId=${cid}`,
    fetcher
  );
  const { data: meetingsRaw, isLoading: lm } = useSWR<Meeting[]>(`/api/meetings`, fetcher);

  const loading = la || li || lw || lm;

  const alerts = useMemo(() => (Array.isArray(alertsRaw) ? alertsRaw : []), [alertsRaw]);
  const invoices = useMemo(
    () => (Array.isArray(invoicesRaw) ? invoicesRaw : []).filter((i) => i.contractId === cid),
    [invoicesRaw, cid]
  );
  const workOrders = useMemo(
    () => (Array.isArray(workOrdersRaw?.workOrders) ? workOrdersRaw!.workOrders : []),
    [workOrdersRaw]
  );
  const meetings = useMemo(() => (Array.isArray(meetingsRaw) ? meetingsRaw : []), [meetingsRaw]);

  // Alertes critiques non lues ───────────────────────────────────────
  const alertStats = useMemo(() => {
    const list = alerts.filter((a) => !a.isRead && a.priority === "CRITIQUE");
    const siteIds = new Set(list.map((a) => a.siteId).filter(Boolean));
    const latest = list.reduce<Date | null>((acc, a) => {
      const d = new Date(a.createdAt);
      return !acc || d > acc ? d : acc;
    }, null);
    return {
      count: list.length,
      siteCount: siteIds.size,
      latestDaysAgo: latest ? daysBetween(new Date(), latest) : null,
    };
  }, [alerts]);

  // Factures P2 manquantes ───────────────────────────────────────────
  const invoiceStats = useMemo(() => {
    const billing = contract.billingFrequency ?? "TRIMESTRIEL";
    const periodsPerYear = PERIODS_PER_YEAR[billing] ?? 4;
    const periodMonths = 12 / periodsPerYear;
    const start = new Date(contract.startDate);
    const now = new Date();
    const elapsed = monthsElapsed(start, now);
    const expected = Math.floor(elapsed / periodMonths);
    const p2 = invoices.filter((i) => i.type === "P2");
    const missing = Math.max(0, expected - p2.length);
    return { count: missing, expected, received: p2.length, label: PERIOD_LABEL[billing] };
  }, [invoices, contract.startDate, contract.billingFrequency]);

  // Travaux à clôturer ───────────────────────────────────────────────
  const workStats = useMemo(() => {
    const toClose = workOrders.filter((w) =>
      w.status === "TERMINE" || w.status === "ATTENTE_ATTACHEMENT" || w.status === "ATTENTE_LEVEE"
    );
    const oldest = toClose.reduce<Date | null>((acc, w) => {
      if (!w.completionDate) return acc;
      const d = new Date(w.completionDate);
      return !acc || d < acc ? d : acc;
    }, null);
    return {
      count: toClose.length,
      oldestDaysAgo: oldest ? daysBetween(new Date(), oldest) : null,
    };
  }, [workOrders]);

  // Réunions J+7 ─────────────────────────────────────────────────────
  const meetingStats = useMemo(() => {
    const now = new Date();
    const next7 = new Date(now.getTime() + 7 * 86_400_000);
    const upcoming = meetings
      .map((m) => ({ ...m, dateObj: new Date(m.date) }))
      .filter((m) => m.dateObj >= now && m.dateObj <= next7)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    const nextDaysAway = upcoming[0] ? daysBetween(upcoming[0].dateObj, now) : null;
    return { count: upcoming.length, nextDaysAway };
  }, [meetings]);

  return (
    <div className="bg-white rounded-lg border border-gray-200/80 overflow-hidden">
      <div className="px-4 h-10 flex items-center border-b border-gray-100">
        <span className="text-xs font-semibold text-primary-dark">À faire</span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          <ActionRow
            href={`/alertes?contractId=${cid}`}
            count={alertStats.count}
            color="red"
            icon={<AlertTriangle size={14} />}
            title="Alertes critiques"
            subtitle={
              alertStats.count === 0
                ? "aucune alerte non lue"
                : `${alertStats.siteCount} site${alertStats.siteCount > 1 ? "s" : ""} · dernière ${alertStats.latestDaysAgo === 0 ? "aujourd'hui" : `il y a ${alertStats.latestDaysAgo} j`}`
            }
          />
          <ActionRow
            href={`/financier?contractId=${cid}`}
            count={invoiceStats.count}
            color="amber"
            icon={<FileQuestion size={14} />}
            title="Factures manquantes"
            subtitle={
              invoiceStats.count === 0
                ? `${invoiceStats.received} reçues · facturation ${invoiceStats.label} à jour`
                : `${invoiceStats.received} reçues / ${invoiceStats.expected} attendues · ${invoiceStats.label}`
            }
          />
          <ActionRow
            href={`/exploitation?tab=suivi-p3&contractId=${cid}`}
            count={workStats.count}
            color="blue"
            icon={<Wrench size={14} />}
            title="Travaux à clôturer"
            subtitle={
              workStats.count === 0
                ? "aucun travaux en attente"
                : `${workStats.count} OT · le plus ancien il y a ${workStats.oldestDaysAgo ?? "?"} j`
            }
          />
          <ActionRow
            href={`/exploitation?tab=reunions&contractId=${cid}`}
            count={meetingStats.count}
            color="violet"
            icon={<Calendar size={14} />}
            title="Réunions J+7"
            subtitle={
              meetingStats.count === 0
                ? "aucune réunion planifiée"
                : meetingStats.nextDaysAway === 0
                ? "prochaine aujourd'hui"
                : `prochaine dans ${meetingStats.nextDaysAway} j`
            }
          />
        </div>
      )}
    </div>
  );
}

function ActionRow({
  href,
  count,
  color,
  icon,
  title,
  subtitle,
}: {
  href: string;
  count: number;
  color: "red" | "amber" | "blue" | "violet";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  const active = count > 0;
  const colorMap = {
    red: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-100" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-100" },
    violet: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-100" },
  };
  const c = colorMap[color];
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
    >
      <div
        className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${
          active ? `${c.bg} ${c.text} ring-1 ${c.ring}` : "bg-gray-50 text-gray-400"
        }`}
      >
        <span className="text-base font-bold tabular-nums leading-none">{count}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-primary-dark">
          <span className={active ? c.text : "text-gray-400"}>{icon}</span>
          <span className="truncate">{title}</span>
        </div>
        <div className="text-[11px] text-text-secondary truncate">{subtitle}</div>
      </div>
      <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
    </Link>
  );
}
