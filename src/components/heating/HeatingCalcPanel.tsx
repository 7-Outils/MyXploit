"use client";

import type { HeatingThresholds } from "@/lib/heating-season";
import { fmtDeg, fmtDM, fmtLongDate, type DayEval } from "./heating-calc";

interface Props {
  e: DayEval | null;
  days: DayEval[];
  thresholds: HeatingThresholds;
  primary: "start" | "stop";
  todayIso: string;
}

const KIND_TEXT = { start: "text-amber-600", stop: "text-accent" } as const;

/**
 * « Le calcul du jour » : pour le jour survolé, les deux fenêtres comparées
 * aux seuils, condition par condition.
 */
export default function HeatingCalcPanel({ e, days, thresholds: t, primary, todayIso }: Props) {
  if (!e) return null;
  const isToday = e.day.date === todayIso;
  const title = isToday ? "Aujourd'hui" : fmtLongDate(e.day.date);

  return (
    <div className="panel h-full">
      <div className="panel-header">
        <span className="label-tech">Le calcul du jour</span>
        <span className="font-mono text-[11px] tabular-nums text-ink/50">
          min {fmtDeg(e.day.tMin)} · <span className="text-ink">moy {fmtDeg(e.day.tMean)}</span> · max {fmtDeg(e.day.tMax)}
        </span>
      </div>
      <div className="px-4 pb-3 pt-2.5">
        <div className="text-sm font-semibold text-ink first-letter:uppercase">{title}</div>

        {e.past ? (
          <p className="mt-2 text-[12px] leading-relaxed text-ink/50">
            Jour passé (température relevée). Il entre dans la moyenne « 5 jours avant » des jours suivants.
          </p>
        ) : !e.back || !e.fwd || !e.start || !e.stop ? (
          <p className="mt-2 text-[12px] leading-relaxed text-ink/50">
            Fin de la prévision : moins de 3 jours connus après ce jour, impossible de juger la semaine qui suit.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-ink/10 border-t border-ink/10">
            {(primary === "start" ? (["start", "stop"] as const) : (["stop", "start"] as const)).map((kind) => {
              const r = e[kind]!;
              const backDates = `${fmtDM(days[e.back!.from].day.date)} → ${fmtDM(days[e.back!.to].day.date)}`;
              const fwdDates = `${fmtDM(days[e.fwd!.from].day.date)} → ${fmtDM(days[e.fwd!.to].day.date)}`;
              const fwdDays = e.fwd!.count < 7 ? ` (${e.fwd!.count} j connus)` : "";
              const verdict = r.ok ? (kind === "start" ? "On allume" : "On arrête") : r.back || r.fwd ? "1 condition sur 2" : "Non";
              return (
                <div key={kind} className="py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`font-mono text-[11px] uppercase tracking-widest ${KIND_TEXT[kind]}`}>
                      {kind === "start" ? "Allumage" : "Arrêt"}
                    </span>
                    <span
                      className={`font-mono text-[11px] uppercase tracking-widest ${
                        r.ok ? `font-semibold ${KIND_TEXT[kind]}` : "text-ink/40"
                      }`}
                    >
                      {verdict}
                    </span>
                  </div>
                  <Condition
                    label={`Moy. 5 jours d'avant · ${backDates}`}
                    value={e.back!.mean}
                    op={kind === "start" ? "<" : "≥"}
                    threshold={kind === "start" ? t.start : t.stop}
                    pass={r.back}
                    passClass={KIND_TEXT[kind]}
                  />
                  <Condition
                    label={
                      kind === "start"
                        ? `Moy. 7 jours à partir du jour · ${fwdDates}${fwdDays}`
                        : `Jour le plus froid des 7 suivants (${fmtDM(days[e.fwd!.minIndex].day.date)})${fwdDays}`
                    }
                    value={kind === "start" ? e.fwd!.mean : e.fwd!.min}
                    op={kind === "start" ? "<" : "≥"}
                    threshold={kind === "start" ? t.startForecastMax : t.stopForecastMin}
                    pass={r.fwd}
                    passClass={KIND_TEXT[kind]}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Condition({
  label,
  value,
  op,
  threshold,
  pass,
  passClass,
}: {
  label: string;
  value: number;
  op: "<" | "≥";
  threshold: number;
  pass: boolean;
  passClass: string;
}) {
  return (
    <div className="mt-1 flex items-baseline gap-2">
      <span className={`w-3 shrink-0 font-mono text-[12px] ${pass ? passClass : "text-ink/40"}`} aria-label={pass ? "vrai" : "faux"}>
        {pass ? "✓" : "✗"}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-ink/60" title={label}>
        {label}
      </span>
      <span className="shrink-0 font-mono text-[12px] tabular-nums">
        <span className="font-semibold text-ink">{fmtDeg(value)}</span>
        <span className="text-ink/40">
          {" "}
          {op} {threshold}°
        </span>
      </span>
    </div>
  );
}
