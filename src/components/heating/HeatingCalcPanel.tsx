"use client";

import { Check, X } from "lucide-react";
import type { HeatingThresholds } from "@/lib/heating-season";
import { fmtDeg, fmtDM, fmtLongDate, type DayEval } from "./heating-calc";
import { HX } from "./HeatingTimeline";

interface Props {
  e: DayEval | null;
  days: DayEval[];
  thresholds: HeatingThresholds;
  primary: "start" | "stop";
  todayIso: string;
  /** Bornes de l'échelle des jauges (°C). */
  scale: [number, number];
}

/**
 * « Le calcul du jour » : pour le jour survolé, les deux fenêtres comparées
 * aux seuils, condition par condition.
 */
export default function HeatingCalcPanel({ e, days, thresholds: t, primary, todayIso, scale }: Props) {
  if (!e) return null;
  const isToday = e.day.date === todayIso;
  const title = isToday ? "Aujourd'hui" : fmtLongDate(e.day.date);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-600">Le calcul du jour</div>
          <div key={e.day.date} className="hx-swap mt-0.5 text-lg font-semibold first-letter:uppercase text-slate-900">
            {title}
          </div>
        </div>
        <div className="flex shrink-0 items-baseline gap-2 font-mono text-[11px] tabular-nums text-slate-500">
          <span>min {fmtDeg(e.day.tMin)}</span>
          <span className="text-[13px] font-semibold text-slate-900">moy {fmtDeg(e.day.tMean)}</span>
          <span>max {fmtDeg(e.day.tMax)}</span>
        </div>
      </div>

      {e.past ? (
        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
          Jour déjà passé (température relevée). Il sert au calcul des jours suivants : il fait partie de leur moyenne
          « 5 jours avant ».
        </p>
      ) : !e.back || !e.fwd || !e.start || !e.stop ? (
        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
          Fin de la prévision : moins de 3 jours connus après ce jour, on ne peut pas juger la semaine qui suit.
        </p>
      ) : (
        <div key={primary} className="mt-3 grid gap-3">
          {(primary === "start" ? (["start", "stop"] as const) : (["stop", "start"] as const)).map((kind, k) => {
            const r = e[kind]!;
            const color = kind === "start" ? HX.start : HX.stop;
            const backDates = `${fmtDM(days[e.back!.from].day.date)} → ${fmtDM(days[e.back!.to].day.date)}`;
            const fwdDates = `${fmtDM(days[e.fwd!.from].day.date)} → ${fmtDM(days[e.fwd!.to].day.date)}`;
            const fwdDays = e.fwd!.count < 7 ? ` (${e.fwd!.count} jours connus)` : "";
            return (
              <div
                key={kind}
                className={`hx-rise rounded-lg border px-3 py-2.5 ${k === 1 ? "bg-slate-50/70" : ""}`}
                style={{ animationDelay: `${k * 70}ms`, borderColor: r.ok ? color : "rgb(226 232 240)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color }}>
                    {kind === "start" ? "Allumage" : "Arrêt"}
                  </div>
                  <div
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={r.ok ? { background: color, color: "#fff" } : { background: "rgb(241 245 249)", color: "rgb(100 116 139)" }}
                  >
                    {r.ok
                      ? kind === "start"
                        ? "On allume"
                        : "On arrête"
                      : r.back || r.fwd
                        ? "1 condition sur 2"
                        : "Pas encore"}
                  </div>
                </div>
                <Condition
                  label={`Moyenne des 5 jours d'avant · ${backDates}`}
                  value={e.back!.mean}
                  op={kind === "start" ? "<" : "≥"}
                  threshold={kind === "start" ? t.start : t.stop}
                  pass={r.back}
                  color={color}
                  scale={scale}
                />
                <Condition
                  label={
                    kind === "start"
                      ? `Moyenne des 7 jours à partir de ce jour · ${fwdDates}${fwdDays}`
                      : `Jour le plus froid des 7 suivants (${fmtDM(days[e.fwd!.minIndex].day.date)})${fwdDays}`
                  }
                  value={kind === "start" ? e.fwd!.mean : e.fwd!.min}
                  op={kind === "start" ? "<" : "≥"}
                  threshold={kind === "start" ? t.startForecastMax : t.stopForecastMin}
                  pass={r.fwd}
                  color={color}
                  scale={scale}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Condition({
  label,
  value,
  op,
  threshold,
  pass,
  color,
  scale: [lo, hi],
}: {
  label: string;
  value: number;
  op: "<" | "≥";
  threshold: number;
  pass: boolean;
  color: string;
  scale: [number, number];
}) {
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  const thr = pct(threshold);
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
          style={pass ? { background: color, color: "#fff" } : { background: "rgb(255 228 230)", color: "rgb(225 29 72)" }}
        >
          {pass ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-slate-600" title={label}>
          {label}
        </span>
        <span className="shrink-0 font-mono text-[12px] tabular-nums">
          <span className="font-semibold text-slate-900">{fmtDeg(value)}</span>
          <span className="text-slate-400">
            {" "}
            {op} {threshold}°
          </span>
        </span>
      </div>
      {/* Jauge : zone qui satisfait la condition teintée, seuil, valeur */}
      <div className="relative ml-6 mt-1.5 h-1.5 rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            left: op === "<" ? 0 : `${thr}%`,
            right: op === "<" ? `${100 - thr}%` : 0,
            background: color,
            opacity: 0.22,
          }}
        />
        <div className="absolute -top-1 h-3.5 w-0.5 rounded bg-slate-500" style={{ left: `calc(${thr}% - 1px)` }} />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-[left] duration-300 ease-out"
          style={{ left: `${pct(value)}%`, background: pass ? color : "rgb(225 29 72)" }}
        />
      </div>
    </div>
  );
}
