"use client";

import Link from "next/link";
import { useMemo } from "react";
import useSWR from "swr";
import { ArrowRight, Calendar } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";

interface Meeting {
  id: string;
  title: string;
  type: string;
  date: string;
  location: string | null;
  contractId: string | null;
  site: { id: string; name: string } | null;
}

interface Props {
  contractId: string;
}

const TYPE_LABEL: Record<string, string> = {
  EXPLOITATION: "Exploitation",
  TRAVAUX: "Travaux",
  BILAN_ANNUEL: "Bilan annuel",
  URGENCE: "Urgence",
  AUTRE: "Autre",
};

function relativeDays(iso: string): { days: number; label: string } {
  const target = new Date(iso);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const days = Math.round(diffMs / 86_400_000);
  if (days === 0) return { days, label: "aujourd'hui" };
  if (days === 1) return { days, label: "demain" };
  if (days < 7) return { days, label: `dans ${days} j` };
  if (days < 30) return { days, label: `dans ${Math.round(days / 7)} sem` };
  return { days, label: `dans ${Math.round(days / 30)} mois` };
}

function tone(days: number) {
  if (days <= 1) return { border: "border-rose-200/70", emphasis: "text-rose-700" };
  if (days <= 7) return { border: "border-amber-200/60", emphasis: "text-amber-700" };
  return { border: "border-gray-200/80", emphasis: "text-primary-dark" };
}

export default function UpcomingMeetings({ contractId }: Props) {
  const { data } = useSWR<Meeting[]>("/api/meetings", fetcher);

  const upcoming = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    const now = Date.now();
    return list
      .filter((m) => new Date(m.date).getTime() >= now)
      .filter((m) => !m.contractId || m.contractId === contractId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, contractId]);

  if (upcoming.length === 0) return null;

  const next = upcoming[0];
  const rel = relativeDays(next.date);
  const t = tone(rel.days);
  const dateStr = new Date(next.date).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = new Date(next.date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const others = upcoming.length - 1;

  return (
    <Link
      href={`/exploitation?tab=reunions&contractId=${contractId}`}
      className={`group bg-white rounded-xl border ${t.border} hover:border-accent/50 px-5 py-4 flex items-center gap-4 transition-colors`}
    >
      <div className="w-10 h-10 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
        <Calendar size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${t.emphasis}`}>
            Prochaine réunion
          </span>
          <span className={`text-sm font-semibold ${t.emphasis}`}>
            {next.title}
          </span>
          <span className={`text-[11px] tabular-nums ${t.emphasis}`}>· {rel.label}</span>
        </div>
        <p className="text-[12px] text-text-secondary mt-1 leading-snug">
          <span className="tabular-nums">{dateStr} · {timeStr}</span>
          {" · "}
          <span>{TYPE_LABEL[next.type] ?? next.type}</span>
          {next.location && <> · {next.location}</>}
          {next.site && <> · {next.site.name}</>}
          {others > 0 && (
            <>
              {" · "}
              <span className="tabular-nums font-semibold text-primary-dark">+{others}</span> autre{others > 1 ? "s" : ""} planifiée{others > 1 ? "s" : ""}
            </>
          )}
        </p>
      </div>

      <ArrowRight size={16} className="text-gray-300 group-hover:text-accent transition-colors shrink-0" />
    </Link>
  );
}
