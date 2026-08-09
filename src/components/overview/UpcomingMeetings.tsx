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
  if (days <= 1) return { rule: "border-l-2 border-l-red-600", emphasis: "text-red-700" };
  if (days <= 7) return { rule: "border-l-2 border-l-amber-600", emphasis: "text-amber-700" };
  return { rule: "border-l-2 border-l-ink", emphasis: "text-ink" };
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
      className={`group panel ${t.rule} hover:border-accent/40 px-4 py-3 flex items-center gap-3 transition-colors`}
    >
      <Calendar size={16} className="text-ink/40 shrink-0 group-hover:text-accent transition-colors" />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="label-tech">Prochaine réunion</span>
          <span className={`text-sm font-semibold ${t.emphasis}`}>
            {next.title}
          </span>
          <span className={`font-mono text-[11px] tabular-nums ${t.emphasis}`}>· {rel.label}</span>
        </div>
        <p className="text-[12px] text-ink/50 mt-1 leading-snug">
          <span className="font-mono tabular-nums">{dateStr} · {timeStr}</span>
          {" · "}
          <span>{TYPE_LABEL[next.type] ?? next.type}</span>
          {next.location && <> · {next.location}</>}
          {next.site && <> · {next.site.name}</>}
          {others > 0 && (
            <>
              {" · "}
              <span className="font-mono tabular-nums font-semibold text-ink">+{others}</span> autre{others > 1 ? "s" : ""} planifiée{others > 1 ? "s" : ""}
            </>
          )}
        </p>
      </div>

      <ArrowRight size={14} className="text-ink/30 group-hover:text-accent transition-colors shrink-0" />
    </Link>
  );
}
