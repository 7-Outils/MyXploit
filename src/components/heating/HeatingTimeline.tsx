"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { HeatingThresholds } from "@/lib/heating-season";
import type { HolidayPeriod } from "@/lib/school-holidays";
import { fmtDeg, fmtDM, fmtWeekdayShort, type DayEval } from "./heating-calc";

/** Couleurs de la page : allumage = braise, arrêt = lagon, fenêtres de calcul = violet. */
export const HX = {
  start: "#EA580C",
  stop: "#0D9488",
  window: "#7C3AED",
  holiday: "#059669",
  ink: "#0F172A",
};

// Largeur de la colonne d'étiquettes, partagée par le graphique et le tableau
// pour que chaque jour tombe exactement dans la même colonne.
const GUTTER = 100;
const H = 320;
const TOP = 52; // bandeau haut : date retenue + accolades des fenêtres
const PLOT_BOTTOM = H - 40; // bandeau bas : zones + vacances
const MIN_WIDTH = 880;

// Dégradé « thermomètre » en °C absolus (même couleur = même température,
// quelle que soit l'échelle).
const THERMO: [number, string][] = [
  [30, "#B91C1C"],
  [24, "#EA580C"],
  [19, "#F59E0B"],
  [15, "#FACC15"],
  [11, "#38BDF8"],
  [6, "#3B82F6"],
  [0, "#4338CA"],
  [-6, "#312E81"],
];

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.floor(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setW(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

interface Props {
  evals: DayEval[];
  thresholds: HeatingThresholds;
  todayIndex: number;
  /** Règle mise en avant (saison) : pilote le seuil « 7 jours » tracé. */
  primary: "start" | "stop";
  decision: { kind: "start" | "stop"; date: string } | null;
  holidays: HolidayPeriod[];
  focus: number | null;
  pinned: number | null;
  onHover: (i: number | null) => void;
  onPick: (i: number) => void;
}

export default function HeatingTimeline(props: Props) {
  const { evals, pinned, onPick } = props;
  const [ref, width] = useWidth<HTMLDivElement>();
  const n = evals.length;

  const move = (delta: number) => {
    const from = pinned ?? props.todayIndex;
    const next = Math.min(n - 1, Math.max(0, (from < 0 ? 0 : from) + delta));
    onPick(next);
  };

  return (
    <div
      className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 rounded-lg"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        }
      }}
      aria-label="Températures jour par jour. Flèches gauche et droite pour changer de jour."
    >
      <div ref={ref} style={{ minWidth: MIN_WIDTH }} onMouseLeave={() => props.onHover(null)}>
        {width > 0 && n > 0 ? (
          <>
            <Chart {...props} width={Math.max(width, MIN_WIDTH)} />
            <DayTable {...props} />
          </>
        ) : (
          <div style={{ height: H + 190 }} />
        )}
      </div>
    </div>
  );
}

// ─── Graphique ──────────────────────────────────────────────────────────────

function Chart({
  evals,
  thresholds: t,
  todayIndex,
  primary,
  decision,
  holidays,
  focus,
  onHover,
  onPick,
  width: W,
}: Props & { width: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const n = evals.length;
  const days = evals.map((e) => e.day);
  const colW = (W - GUTTER) / n;
  const colX = (i: number) => GUTTER + colW * i;
  const cx = (i: number) => GUTTER + colW * (i + 0.5);

  // Échelle verticale : données + seuils, arrondie à un pas lisible.
  const temps = days.flatMap((d) => [d.tMin, d.tMax]).concat([t.start, t.stop, t.startForecastMax, t.stopForecastMin]);
  let lo = Math.floor(Math.min(...temps) - 1);
  let hi = Math.ceil(Math.max(...temps) + 1);
  if (hi - lo < 12) {
    const pad = (12 - (hi - lo)) / 2;
    lo = Math.floor(lo - pad);
    hi = Math.ceil(hi + pad);
  }
  const step = hi - lo > 24 ? 5 : 2;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const y = (v: number) => TOP + ((hi - v) / (hi - lo)) * (PLOT_BOTTOM - TOP);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);

  const capW = Math.max(6, Math.min(14, colW * 0.36));
  const trendIndex = todayIndex >= 0 ? todayIndex + 7 : -1;
  const decisionIndex = decision ? days.findIndex((d) => d.date === decision.date) : -1;
  const decisionColor = decision?.kind === "stop" ? HX.stop : HX.start;
  const f = focus !== null ? evals[focus] : null;

  // Étiquettes de seuil dans la marge : décalées si elles se chevauchent.
  let yStartLabel = y(t.start);
  let yStopLabel = y(t.stop);
  if (Math.abs(yStartLabel - yStopLabel) < 14) {
    const mid = (yStartLabel + yStopLabel) / 2;
    yStartLabel = mid + 7;
    yStopLabel = mid - 7;
  }
  const nearLabel = (yy: number) => Math.abs(yy - yStartLabel) < 11 || Math.abs(yy - yStopLabel) < 11;

  const meanPath = days.map((d, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${y(d.tMean).toFixed(1)}`).join(" ");

  // Bandes de vacances (colonnes consécutives).
  const holidayBands = holidays
    .map((h) => {
      const idx = days.map((d, i) => (d.date >= h.from && d.date <= h.to ? i : -1)).filter((i) => i >= 0);
      return idx.length ? { label: h.label, from: idx[0], to: idx[idx.length - 1] } : null;
    })
    .filter((b): b is { label: string; from: number; to: number } => b !== null);

  const pill = (() => {
    if (decisionIndex < 0 || !decision) return null;
    const text = `${decision.kind === "start" ? "ALLUMER" : "ARRÊTER"} · ${fmtWeekdayShort(decision.date)} ${fmtDM(decision.date)}`;
    const w = text.length * 6.4 + 18;
    const x = Math.min(W - w - 2, Math.max(GUTTER, cx(decisionIndex) - w / 2));
    return { text, w, x };
  })();

  const fwdThreshold = primary === "start" ? t.startForecastMax : t.stopForecastMin;
  const fwdColor = primary === "start" ? HX.start : HX.stop;

  return (
    <svg width={W} height={H} className="block select-none" role="img" aria-label="Températures minimales, moyennes et maximales jour par jour, avec les seuils d'allumage et d'arrêt">
      <defs>
        <linearGradient id={`thermo${uid}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={y(30)} y2={y(-6)}>
          {THERMO.map(([v, c]) => (
            <stop key={v} offset={(30 - v) / 36} stopColor={c} />
          ))}
        </linearGradient>
        <pattern id={`hatch${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={HX.ink} strokeOpacity="0.07" strokeWidth="2" />
        </pattern>
      </defs>

      {/* Zones : observé, tendance, vacances */}
      {todayIndex > 0 && (
        <rect x={GUTTER} y={TOP - 6} width={colX(todayIndex) - GUTTER} height={PLOT_BOTTOM - TOP + 6} fill={HX.ink} fillOpacity="0.035" />
      )}
      {trendIndex > 0 && trendIndex < n && (
        <rect x={colX(trendIndex)} y={TOP - 6} width={W - colX(trendIndex)} height={PLOT_BOTTOM - TOP + 6} fill={`url(#hatch${uid})`} />
      )}
      {holidayBands.map((b) => (
        <g key={b.label + b.from}>
          <rect x={colX(b.from)} y={TOP - 6} width={colW * (b.to - b.from + 1)} height={PLOT_BOTTOM - TOP + 6} fill={HX.holiday} fillOpacity="0.08" />
          <line x1={colX(b.from)} x2={colX(b.to + 1)} y1={PLOT_BOTTOM + 1} y2={PLOT_BOTTOM + 1} stroke={HX.holiday} strokeWidth="3" />
        </g>
      ))}

      {/* Grille + échelle */}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={GUTTER} x2={W} y1={y(v)} y2={y(v)} stroke={HX.ink} strokeOpacity={v === 0 ? 0.18 : 0.06} />
          {!nearLabel(y(v)) && (
            <text x={GUTTER - 8} y={y(v) + 3.5} textAnchor="end" className="fill-slate-400 font-mono" fontSize="10">
              {String(v).replace("-", "−")}°
            </text>
          )}
        </g>
      ))}

      {/* Date retenue : colonne teintée + trait */}
      {decisionIndex >= 0 && (
        <g className="hx-fade" style={{ animationDelay: "900ms" }}>
          <rect x={colX(decisionIndex)} y={TOP - 6} width={colW} height={PLOT_BOTTOM - TOP + 6} fill={decisionColor} fillOpacity="0.1" />
          <line x1={cx(decisionIndex)} x2={cx(decisionIndex)} y1={22} y2={PLOT_BOTTOM} stroke={decisionColor} strokeWidth="1.5" strokeDasharray="2 3" />
        </g>
      )}

      {/* Fenêtres de calcul du jour survolé */}
      {f && f.back && (
        <g style={{ transform: `translateX(${colX(f.back.from)}px)`, transition: "transform 220ms ease" }}>
          <rect x={1} y={TOP - 6} width={colW * 5 - 2} height={PLOT_BOTTOM - TOP + 6} fill={HX.window} fillOpacity="0.09" rx="3" />
          <g style={{ transform: `translateY(${y(f.back.mean)}px)`, transition: "transform 220ms ease" }}>
            <line x1={3} x2={colW * 5 - 3} y1={0} y2={0} stroke={HX.window} strokeWidth="2.5" strokeLinecap="round" />
          </g>
          <Bracket w={colW * 5} label={`5 j avant · moy. ${fmtDeg(f.back.mean)}`} short={fmtDeg(f.back.mean)} />
        </g>
      )}
      {f && f.fwd && (
        <g style={{ transform: `translateX(${colX(f.fwd.from)}px)`, transition: "transform 220ms ease" }}>
          <rect
            x={1}
            y={TOP - 6}
            width={colW * f.fwd.count - 2}
            height={PLOT_BOTTOM - TOP + 6}
            fill={HX.window}
            fillOpacity="0.04"
            stroke={HX.window}
            strokeOpacity="0.35"
            strokeDasharray="3 3"
            rx="3"
          />
          <g style={{ transform: `translateY(${y(f.fwd.mean)}px)`, transition: "transform 220ms ease" }}>
            <line x1={3} x2={colW * f.fwd.count - 3} y1={0} y2={0} stroke={HX.window} strokeWidth="2.5" strokeLinecap="round" />
          </g>
          <line
            x1={3}
            x2={colW * f.fwd.count - 3}
            y1={y(fwdThreshold)}
            y2={y(fwdThreshold)}
            stroke={fwdColor}
            strokeWidth="1.5"
            strokeDasharray="1 3"
            strokeLinecap="round"
          />
          <Bracket
            w={colW * f.fwd.count}
            label={`${f.fwd.count} j après · moy. ${fmtDeg(f.fwd.mean)}`}
            short={fmtDeg(f.fwd.mean)}
          />
        </g>
      )}

      {/* Seuils du profil */}
      <line x1={GUTTER} x2={W} y1={y(t.start)} y2={y(t.start)} stroke={HX.start} strokeWidth="1.5" strokeDasharray="6 4" />
      <line x1={GUTTER} x2={W} y1={y(t.stop)} y2={y(t.stop)} stroke={HX.stop} strokeWidth="1.5" strokeDasharray="6 4" />
      <text x={GUTTER - 8} y={yStartLabel + 3.5} textAnchor="end" fontSize="10.5" fontWeight="600" fill={HX.start} className="font-mono">
        allumage {t.start}°
      </text>
      <text x={GUTTER - 8} y={yStopLabel + 3.5} textAnchor="end" fontSize="10.5" fontWeight="600" fill={HX.stop} className="font-mono">
        arrêt {t.stop}°
      </text>

      {/* Min → max de chaque jour */}
      {days.map((d, i) => {
        const top = y(d.tMax);
        const h = Math.max(3, y(d.tMin) - top);
        const e = evals[i];
        return (
          <rect
            key={d.date}
            className="hx-grow"
            style={{ animationDelay: `${120 + i * 22}ms` }}
            x={cx(i) - capW / 2}
            y={top}
            width={capW}
            height={h}
            rx={capW / 2}
            fill={`url(#thermo${uid})`}
            opacity={e.past ? 0.45 : e.trend ? 0.6 : 0.92}
          />
        );
      })}

      {/* Moyenne journalière */}
      <path
        d={meanPath}
        pathLength={1}
        className="hx-draw"
        fill="none"
        stroke={HX.ink}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {days.map((d, i) => (
        <circle
          key={d.date}
          className="hx-fade"
          style={{ animationDelay: `${500 + i * 25}ms` }}
          cx={cx(i)}
          cy={y(d.tMean)}
          r={focus === i ? 5 : 3.2}
          fill="#fff"
          stroke={HX.ink}
          strokeWidth={focus === i ? 2.5 : 1.6}
        />
      ))}

      {/* Pulsation sur la date retenue */}
      {decisionIndex >= 0 && (
        <circle cx={cx(decisionIndex)} cy={y(days[decisionIndex].tMean)} r="6" fill="none" stroke={decisionColor} strokeWidth="2" className="hx-ping" />
      )}

      {/* Min / max du jour survolé */}
      {f && (
        <g className="font-mono" fontSize="10.5" fontWeight="600">
          <text x={cx(f.index)} y={y(f.day.tMax) - 6} textAnchor="middle" fill={HX.ink} stroke="#fff" strokeWidth="3" paintOrder="stroke">
            {fmtDeg(f.day.tMax)}
          </text>
          <text x={cx(f.index)} y={y(f.day.tMin) + 14} textAnchor="middle" fill={HX.ink} stroke="#fff" strokeWidth="3" paintOrder="stroke">
            {fmtDeg(f.day.tMin)}
          </text>
          <rect x={colX(f.index) + 1} y={TOP - 6} width={colW - 2} height={PLOT_BOTTOM - TOP + 6} fill="none" stroke={HX.ink} strokeOpacity="0.25" rx="3" />
        </g>
      )}

      {/* Aujourd'hui */}
      {todayIndex >= 0 && (
        <line x1={colX(todayIndex)} x2={colX(todayIndex)} y1={TOP - 10} y2={H - 26} stroke={HX.ink} strokeOpacity="0.55" strokeWidth="1.5" />
      )}

      {/* Bandeau bas : zones et vacances */}
      <g fontSize="10" className="font-mono uppercase" letterSpacing="0.06em">
        {todayIndex > 0 && (
          <text x={GUTTER + 6} y={H - 26} fill={HX.ink} fillOpacity="0.4">
            Observé
          </text>
        )}
        {todayIndex >= 0 && (
          <text x={colX(todayIndex) + 6} y={H - 26} fill={HX.ink} fontWeight="700">
            Aujourd&apos;hui → prévision
          </text>
        )}
        {trendIndex > 0 && trendIndex < n && (
          <text x={colX(trendIndex) + 6} y={H - 26} fill={HX.ink} fillOpacity="0.45">
            Tendance · moins fiable
          </text>
        )}
      </g>
      {holidayBands.map((b) => (
        <text key={b.label + b.from} x={colX(b.from) + 4} y={H - 10} fontSize="10.5" fontWeight="600" fill={HX.holiday}>
          {b.label}
        </text>
      ))}

      {/* Étiquette de la date retenue */}
      {pill && (
        <g className="hx-pop" style={{ animationDelay: "1000ms" }}>
          <rect x={pill.x} y={4} width={pill.w} height={19} rx="9.5" fill={decisionColor} />
          <text x={pill.x + pill.w / 2} y={17.5} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#fff" className="font-mono" letterSpacing="0.04em">
            {pill.text}
          </text>
        </g>
      )}

      {/* Zones de survol / clic par jour */}
      {days.map((d, i) => (
        <rect
          key={d.date}
          x={colX(i)}
          y={0}
          width={colW}
          height={H}
          fill="transparent"
          className="cursor-pointer"
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(i)}
        />
      ))}
    </svg>
  );
}

/** Accolade au-dessus d'une fenêtre de calcul, avec son étiquette. */
function Bracket({ w, label, short }: { w: number; label: string; short: string }) {
  // Fenêtre étroite (fin d'horizon) : étiquette courte pour ne pas déborder.
  const text = label.length * 6.4 + 8 <= w ? label : short;
  return (
    <g>
      <path d={`M3,${TOP - 2} V${TOP - 8} H${w - 3} V${TOP - 2}`} fill="none" stroke={HX.window} strokeWidth="1.5" />
      <text x={w / 2} y={TOP - 13} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={HX.window} className="font-mono">
        {text}
      </text>
    </g>
  );
}

// ─── Tableau aligné sur les colonnes du graphique ──────────────────────────

function DayTable({ evals, thresholds: t, todayIndex, decision, focus, pinned, onHover, onPick }: Props) {
  const n = evals.length;
  const cols = `${GUTTER}px repeat(${n}, minmax(0, 1fr))`;

  const colBg = (e: DayEval) => {
    if (focus === e.index) return "bg-violet-500/[0.08]";
    if (decision && e.day.date === decision.date) return decision.kind === "start" ? "bg-orange-500/[0.08]" : "bg-teal-500/[0.08]";
    if (e.past) return "bg-slate-900/[0.03]";
    return "";
  };

  const cell = (e: DayEval, content: ReactNode, extra = "") => (
    <div
      key={e.day.date}
      onMouseEnter={() => onHover(e.index)}
      onClick={() => onPick(e.index)}
      className={`flex h-[22px] cursor-pointer items-center justify-center font-mono text-[11px] tabular-nums transition-colors ${colBg(e)} ${
        e.trend ? "opacity-70" : ""
      } ${extra}`}
    >
      {content}
    </div>
  );

  const tone = (ok: boolean | undefined, color: "start" | "stop") =>
    ok ? (color === "start" ? "text-orange-600 font-semibold" : "text-teal-600 font-semibold") : "text-slate-500";

  const rows: { label: string; hint?: string; render: (e: DayEval) => ReactNode }[] = [
    { label: "Max", render: (e) => cell(e, fmtDeg(e.day.tMax), "text-slate-500") },
    { label: "Moyenne", render: (e) => cell(e, fmtDeg(e.day.tMean), "font-semibold text-slate-900") },
    { label: "Min", render: (e) => cell(e, fmtDeg(e.day.tMin), "text-slate-500") },
    {
      label: "Moy. 5 j avant",
      hint: `Moyenne des 5 jours qui précèdent. Allumage si < ${t.start}°, arrêt si ≥ ${t.stop}°.`,
      render: (e) =>
        cell(
          e,
          e.back ? fmtDeg(e.back.mean) : "",
          e.back ? (e.back.mean < t.start ? tone(true, "start") : e.back.mean >= t.stop ? tone(true, "stop") : "text-slate-500") : ""
        ),
    },
    {
      label: "Moy. 7 j après",
      hint: `Moyenne des 7 jours à partir du jour. Allumage si < ${t.startForecastMax}°.`,
      render: (e) => cell(e, e.fwd ? fmtDeg(e.fwd.mean) : "", tone(e.start?.fwd, "start")),
    },
    {
      label: "Mini 7 j après",
      hint: `Jour le plus froid (moyenne) des 7 jours à partir du jour. Arrêt si ≥ ${t.stopForecastMin}°.`,
      render: (e) => cell(e, e.fwd ? fmtDeg(e.fwd.min) : "", tone(e.stop?.fwd, "stop")),
    },
    {
      label: "Allumer ?",
      render: (e) =>
        cell(e, e.start ? (e.start.ok ? "✓" : "·") : "", e.start?.ok ? "text-orange-600 text-[13px] font-bold" : "text-slate-300"),
    },
    {
      label: "Arrêter ?",
      render: (e) =>
        cell(e, e.stop ? (e.stop.ok ? "✓" : "·") : "", e.stop?.ok ? "text-teal-600 text-[13px] font-bold" : "text-slate-300"),
    },
  ];

  return (
    <div className="mt-1 border-t border-slate-200 pt-1">
      {/* En-tête : jours */}
      <div className="grid" style={{ gridTemplateColumns: cols }}>
        <div />
        {evals.map((e) => {
          const isToday = e.index === todayIndex;
          return (
            <button
              key={e.day.date}
              type="button"
              onMouseEnter={() => onHover(e.index)}
              onClick={() => onPick(e.index)}
              className={`relative flex flex-col items-center py-1 leading-tight transition-colors ${colBg(e)} ${
                e.trend ? "opacity-70" : ""
              }`}
              title="Voir le calcul de ce jour"
            >
              <span
                className={`rounded px-1 text-[10px] uppercase tracking-wide ${
                  isToday ? "bg-slate-900 text-white font-semibold" : "text-slate-500"
                }`}
              >
                {isToday ? "auj." : fmtWeekdayShort(e.day.date)}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-slate-400">{fmtDM(e.day.date)}</span>
              {pinned === e.index && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-violet-600" />}
            </button>
          );
        })}
      </div>
      {rows.map((r, ri) => (
        <div
          key={r.label}
          className={`grid ${ri === 3 || ri === 6 ? "mt-1 border-t border-dashed border-slate-200 pt-1" : ""}`}
          style={{ gridTemplateColumns: cols }}
        >
          <div className="flex h-[22px] items-center pr-2 text-[11px] text-slate-500" title={r.hint}>
            <span className={r.hint ? "cursor-help border-b border-dotted border-slate-300" : ""}>{r.label}</span>
          </div>
          {evals.map((e) => r.render(e))}
        </div>
      ))}
    </div>
  );
}
