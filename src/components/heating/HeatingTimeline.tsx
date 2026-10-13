"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { HeatingThresholds } from "@/lib/heating-season";
import type { HolidayPeriod } from "@/lib/school-holidays";
import { fmtDeg, fmtDM, fmtWeekdayShort, type DayEval } from "./heating-calc";

/**
 * Couleurs du thème : encre pour la structure, amber pour l'allumage, accent
 * pour l'arrêt (et pour la date retenue).
 */
export const HX = {
  start: "#D97706", // amber-600
  stop: "#2563EB", // accent
  accent: "#2563EB",
  ink: "#0F1E33",
};

// Largeur de la colonne d'étiquettes, partagée par le graphique et le tableau
// pour que chaque jour tombe exactement dans la même colonne.
const GUTTER = 100;
const H = 300;
const TOP = 44; // bandeau haut : date retenue + accolades des fenêtres
const PLOT_BOTTOM = H - 40; // bandeau bas : zones + vacances
const MIN_WIDTH = 880;

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
  /** Dates à marquer (une par famille de bâtiments). */
  decisions: { kind: "start" | "stop"; date: string; label: string }[];
  holidays: HolidayPeriod[];
  /** Mode « comment c'est calculé » : seuils, fenêtres au survol et tableau. */
  detail: boolean;
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
      className="overflow-x-auto outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent"
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
            {props.detail && <DayTable {...props} />}
          </>
        ) : (
          <div style={{ height: props.detail ? H + 190 : H }} />
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
  decisions,
  holidays,
  focus,
  onHover,
  onPick,
  width: W,
  detail,
}: Props & { width: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const n = evals.length;
  const days = evals.map((e) => e.day);
  const colW = (W - GUTTER) / n;
  const colX = (i: number) => GUTTER + colW * i;
  const cx = (i: number) => GUTTER + colW * (i + 0.5);

  // Échelle verticale : données + seuils, arrondie à un pas lisible.
  const temps = days
    .flatMap((d) => [d.tMin, d.tMax])
    .concat(detail ? [t.start, t.stop, t.startForecastMax, t.stopForecastMin] : []);
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

  const barW = Math.max(4, Math.min(10, colW * 0.3));
  const trendIndex = todayIndex >= 0 ? todayIndex + 7 : -1;
  const marks = decisions
    .map((d) => ({ ...d, index: days.findIndex((x) => x.date === d.date) }))
    .filter((d) => d.index >= 0)
    .sort((a, b) => a.index - b.index);
  const f = focus !== null ? evals[focus] : null;
  // Fenêtres de calcul seulement en mode détail ; min/max du jour survolé toujours.
  const fw = detail ? f : null;
  const plotTop = TOP - 6;
  const plotH = PLOT_BOTTOM - plotTop;

  // Étiquettes de seuil dans la marge : décalées si elles se chevauchent.
  let yStartLabel = y(t.start);
  let yStopLabel = y(t.stop);
  if (Math.abs(yStartLabel - yStopLabel) < 14) {
    const mid = (yStartLabel + yStopLabel) / 2;
    yStartLabel = mid + 7;
    yStopLabel = mid - 7;
  }
  const nearLabel = (yy: number) => detail && (Math.abs(yy - yStartLabel) < 11 || Math.abs(yy - yStopLabel) < 11);

  const meanPath = days.map((d, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${y(d.tMean).toFixed(1)}`).join(" ");

  // Bandes de vacances (colonnes consécutives).
  const holidayBands = holidays
    .map((h) => {
      const idx = days.map((d, i) => (d.date >= h.from && d.date <= h.to ? i : -1)).filter((i) => i >= 0);
      return idx.length ? { label: h.label, from: idx[0], to: idx[idx.length - 1] } : null;
    })
    .filter((b): b is { label: string; from: number; to: number } => b !== null);

  // Étiquettes des dates marquées, décalées à droite si elles se chevauchent ;
  // plusieurs familles le même jour partagent une étiquette.
  const markLabels = (() => {
    const byIndex = new Map<number, (typeof marks)[number][]>();
    for (const m of marks) byIndex.set(m.index, [...(byIndex.get(m.index) ?? []), m]);
    const out: { text: string; x: number; index: number }[] = [];
    let lastRight = GUTTER;
    for (const [index, ms] of [...byIndex.entries()].sort((a, b) => a[0] - b[0])) {
      const date = ms[0].date;
      const verb = ms[0].kind === "start" ? "ALLUMER" : "ARRÊTER";
      const who = ms.length === 1 ? ms[0].label : `${ms.length} groupes`;
      const text = `${verb} ${fmtWeekdayShort(date).toUpperCase()} ${fmtDM(date)}${who ? ` · ${who}` : ""}`.toUpperCase();
      const w = text.length * 6.2;
      let x = Math.min(W - w / 2 - 2, Math.max(GUTTER + w / 2, cx(index)));
      if (x - w / 2 < lastRight + 8) x = Math.min(W - w / 2 - 2, lastRight + 8 + w / 2);
      lastRight = x + w / 2;
      out.push({ text, x, index });
    }
    return out;
  })();

  const fwdThreshold = primary === "start" ? t.startForecastMax : t.stopForecastMin;
  const fwdColor = primary === "start" ? HX.start : HX.stop;

  return (
    <svg
      width={W}
      height={H}
      className="block select-none"
      role="img"
      aria-label="Températures minimales, moyennes et maximales jour par jour, avec les seuils d'allumage et d'arrêt"
    >
      <defs>
        <pattern id={`hatch${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke={HX.ink} strokeOpacity="0.08" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Zones : observé, vacances */}
      {todayIndex > 0 && (
        <rect x={GUTTER} y={plotTop} width={colX(todayIndex) - GUTTER} height={plotH} fill={HX.ink} fillOpacity="0.025" />
      )}
      {holidayBands.map((b) => (
        <g key={b.label + b.from}>
          <rect x={colX(b.from)} y={plotTop} width={colW * (b.to - b.from + 1)} height={plotH} fill={`url(#hatch${uid})`} />
          <line x1={colX(b.from)} x2={colX(b.to + 1)} y1={PLOT_BOTTOM + 0.5} y2={PLOT_BOTTOM + 0.5} stroke={HX.ink} strokeOpacity="0.4" />
        </g>
      ))}

      {/* Grille + échelle */}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={GUTTER} x2={W} y1={y(v)} y2={y(v)} stroke={HX.ink} strokeOpacity={v === 0 ? 0.2 : 0.06} />
          {!nearLabel(y(v)) && (
            <text x={GUTTER - 8} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill={HX.ink} fillOpacity="0.4" className="font-mono">
              {String(v).replace("-", "−")}°
            </text>
          )}
        </g>
      ))}

      {/* Dates retenues : colonne teintée + trait */}
      {marks.map((m) => (
        <g key={m.date + m.label}>
          <rect x={colX(m.index)} y={plotTop} width={colW} height={plotH} fill={HX.accent} fillOpacity="0.05" />
          <line x1={cx(m.index)} x2={cx(m.index)} y1={18} y2={PLOT_BOTTOM} stroke={HX.accent} strokeOpacity="0.6" strokeDasharray="2 3" />
        </g>
      ))}

      {/* Fenêtres de calcul du jour survolé */}
      {fw && fw.back && (
        <g style={{ transform: `translateX(${colX(fw.back.from)}px)`, transition: "transform 180ms ease" }}>
          <rect x={0} y={plotTop} width={colW * 5} height={plotH} fill={HX.ink} fillOpacity="0.04" />
          <g style={{ transform: `translateY(${y(fw.back.mean)}px)`, transition: "transform 180ms ease" }}>
            <line x1={2} x2={colW * 5 - 2} y1={0} y2={0} stroke={HX.ink} strokeOpacity="0.7" />
          </g>
          <Bracket w={colW * 5} label={`5 j avant · moy. ${fmtDeg(fw.back.mean)}`} short={fmtDeg(fw.back.mean)} />
        </g>
      )}
      {fw && fw.fwd && (
        <g style={{ transform: `translateX(${colX(fw.fwd.from)}px)`, transition: "transform 180ms ease" }}>
          <rect
            x={0.5}
            y={plotTop + 0.5}
            width={colW * fw.fwd.count - 1}
            height={plotH - 1}
            fill="none"
            stroke={HX.ink}
            strokeOpacity="0.3"
            strokeDasharray="3 3"
          />
          <g style={{ transform: `translateY(${y(fw.fwd.mean)}px)`, transition: "transform 180ms ease" }}>
            <line x1={2} x2={colW * fw.fwd.count - 2} y1={0} y2={0} stroke={HX.ink} strokeOpacity="0.7" />
          </g>
          <line
            x1={2}
            x2={colW * fw.fwd.count - 2}
            y1={y(fwdThreshold)}
            y2={y(fwdThreshold)}
            stroke={fwdColor}
            strokeDasharray="1 3"
          />
          <Bracket
            w={colW * fw.fwd.count}
            label={`${fw.fwd.count} j après · moy. ${fmtDeg(fw.fwd.mean)}`}
            short={fmtDeg(fw.fwd.mean)}
          />
        </g>
      )}

      {/* Seuils du profil (mode détail) */}
      {detail && (
        <g>
          <line x1={GUTTER} x2={W} y1={y(t.start)} y2={y(t.start)} stroke={HX.start} strokeDasharray="5 3" />
          <line x1={GUTTER} x2={W} y1={y(t.stop)} y2={y(t.stop)} stroke={HX.stop} strokeDasharray="5 3" />
          <text x={GUTTER - 8} y={yStartLabel + 3.5} textAnchor="end" fontSize="10" fill={HX.start} className="font-mono">
            allumage {t.start}°
          </text>
          <text x={GUTTER - 8} y={yStopLabel + 3.5} textAnchor="end" fontSize="10" fill={HX.stop} className="font-mono">
            arrêt {t.stop}°
          </text>
        </g>
      )}

      {/* Min → max de chaque jour */}
      {days.map((d, i) => {
        const top = y(d.tMax);
        const h = Math.max(2, y(d.tMin) - top);
        return (
          <rect
            key={d.date}
            x={cx(i) - barW / 2}
            y={top}
            width={barW}
            height={h}
            fill={HX.ink}
            fillOpacity={evals[i].past || evals[i].trend ? 0.1 : 0.15}
          />
        );
      })}

      {/* Moyenne journalière : trait sur chaque barre, reliés finement */}
      <path d={meanPath} fill="none" stroke={HX.ink} strokeOpacity="0.3" strokeLinejoin="round" />
      {days.map((d, i) => (
        <line
          key={d.date}
          x1={cx(i) - barW / 2 - 2}
          x2={cx(i) + barW / 2 + 2}
          y1={y(d.tMean)}
          y2={y(d.tMean)}
          stroke={HX.ink}
          strokeWidth={focus === i ? 2 : 1.5}
        />
      ))}

      {/* Min / max du jour survolé */}
      {f && (
        <g fontSize="10" className="font-mono">
          <text x={cx(f.index)} y={y(f.day.tMax) - 5} textAnchor="middle" fill={HX.ink} stroke="#fff" strokeWidth="3" paintOrder="stroke">
            {fmtDeg(f.day.tMax)}
          </text>
          <text x={cx(f.index)} y={y(f.day.tMin) + 13} textAnchor="middle" fill={HX.ink} stroke="#fff" strokeWidth="3" paintOrder="stroke">
            {fmtDeg(f.day.tMin)}
          </text>
          <rect
            x={colX(f.index) + 0.5}
            y={plotTop + 0.5}
            width={colW - 1}
            height={plotH - 1}
            fill="none"
            stroke={HX.ink}
            strokeOpacity="0.25"
          />
        </g>
      )}

      {/* Aujourd'hui et début de la tendance */}
      {todayIndex >= 0 && (
        <line x1={colX(todayIndex)} x2={colX(todayIndex)} y1={plotTop} y2={H - 24} stroke={HX.ink} strokeOpacity="0.5" />
      )}
      {trendIndex > 0 && trendIndex < n && (
        <line
          x1={colX(trendIndex)}
          x2={colX(trendIndex)}
          y1={plotTop}
          y2={H - 24}
          stroke={HX.ink}
          strokeOpacity="0.3"
          strokeDasharray="3 3"
        />
      )}

      {/* Bandeau bas : zones et vacances */}
      <g fontSize="10" letterSpacing="0.08em" className="font-mono">
        {todayIndex > 0 && (
          <text x={GUTTER + 6} y={H - 26} fill={HX.ink} fillOpacity="0.4">
            OBSERVÉ
          </text>
        )}
        {todayIndex >= 0 && (
          <text x={colX(todayIndex) + 6} y={H - 26} fill={HX.ink} fillOpacity="0.75">
            AUJOURD&apos;HUI → PRÉVISION
          </text>
        )}
        {trendIndex > 0 && trendIndex < n && (
          <text x={colX(trendIndex) + 6} y={H - 26} fill={HX.ink} fillOpacity="0.4">
            TENDANCE · MOINS FIABLE
          </text>
        )}
      </g>
      {holidayBands.map((b) => (
        <text key={b.label + b.from} x={colX(b.from) + 4} y={H - 10} fontSize="10" fill={HX.ink} fillOpacity="0.5" className="font-mono">
          {b.label}
        </text>
      ))}

      {/* Étiquettes des dates retenues */}
      {markLabels.map((l) => (
        <text key={l.index} x={l.x} y={13} textAnchor="middle" fontSize="10.5" letterSpacing="0.06em" fill={HX.accent} className="font-mono">
          {l.text}
        </text>
      ))}

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
  const text = label.length * 6 + 8 <= w ? label : short;
  return (
    <g>
      <path d={`M2.5,${TOP - 2} V${TOP - 7} H${w - 2.5} V${TOP - 2}`} fill="none" stroke={HX.ink} strokeOpacity="0.4" />
      <text x={w / 2} y={TOP - 11} textAnchor="middle" fontSize="10" fill={HX.ink} fillOpacity="0.6" className="font-mono">
        {text}
      </text>
    </g>
  );
}

// ─── Tableau aligné sur les colonnes du graphique ──────────────────────────

function DayTable({ evals, thresholds: t, todayIndex, decisions, focus, pinned, onHover, onPick }: Props) {
  const n = evals.length;
  const marked = new Set(decisions.map((d) => d.date));
  const cols = `${GUTTER}px repeat(${n}, minmax(0, 1fr))`;

  const colBg = (e: DayEval) => {
    if (focus === e.index) return "bg-ink/[0.05]";
    if (marked.has(e.day.date)) return "bg-accent/5";
    if (e.past) return "bg-ink/[0.02]";
    return "";
  };

  const cell = (e: DayEval, content: ReactNode, extra = "") => (
    <div
      key={e.day.date}
      onMouseEnter={() => onHover(e.index)}
      onClick={() => onPick(e.index)}
      className={`flex h-[22px] cursor-pointer items-center justify-center font-mono text-[11px] tabular-nums ${colBg(e)} ${
        e.trend ? "opacity-70" : ""
      } ${extra}`}
    >
      {content}
    </div>
  );

  const tone = (ok: boolean | undefined, color: "start" | "stop") =>
    ok ? (color === "start" ? "font-semibold text-amber-600" : "font-semibold text-accent") : "text-ink/50";

  const rows: { label: string; hint?: string; render: (e: DayEval) => ReactNode }[] = [
    { label: "Max", render: (e) => cell(e, fmtDeg(e.day.tMax), "text-ink/50") },
    { label: "Moyenne", render: (e) => cell(e, fmtDeg(e.day.tMean), "font-semibold text-ink") },
    { label: "Min", render: (e) => cell(e, fmtDeg(e.day.tMin), "text-ink/50") },
    {
      label: "Moy. 5 j avant",
      hint: `Moyenne des 5 jours qui précèdent. Allumage si < ${t.start}°, arrêt si ≥ ${t.stop}°.`,
      render: (e) =>
        cell(
          e,
          e.back ? fmtDeg(e.back.mean) : "",
          e.back ? (e.back.mean < t.start ? tone(true, "start") : e.back.mean >= t.stop ? tone(true, "stop") : "text-ink/50") : ""
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
      render: (e) => cell(e, e.start ? (e.start.ok ? "✓" : "·") : "", e.start?.ok ? "font-semibold text-amber-600" : "text-ink/20"),
    },
    {
      label: "Arrêter ?",
      render: (e) => cell(e, e.stop ? (e.stop.ok ? "✓" : "·") : "", e.stop?.ok ? "font-semibold text-accent" : "text-ink/20"),
    },
  ];

  return (
    <div className="border-t border-ink/10">
      {/* En-tête : jours */}
      <div className="grid border-b border-ink/10" style={{ gridTemplateColumns: cols }}>
        <div />
        {evals.map((e) => {
          const isToday = e.index === todayIndex;
          return (
            <button
              key={e.day.date}
              type="button"
              onMouseEnter={() => onHover(e.index)}
              onClick={() => onPick(e.index)}
              className={`relative flex flex-col items-center py-1 font-mono leading-tight ${colBg(e)} ${e.trend ? "opacity-70" : ""}`}
              title="Voir le calcul de ce jour"
            >
              <span
                className={`px-1 text-[10px] uppercase tracking-wider ${isToday ? "bg-ink text-paper" : "text-ink/50"}`}
              >
                {isToday ? "auj." : fmtWeekdayShort(e.day.date)}
              </span>
              <span className="text-[10px] tabular-nums text-ink/40">{fmtDM(e.day.date)}</span>
              {pinned === e.index && <span className="absolute bottom-0 h-1 w-1 rounded-full bg-ink" />}
            </button>
          );
        })}
      </div>
      {rows.map((r, ri) => (
        <div
          key={r.label}
          className={`grid ${ri === 3 || ri === 6 ? "border-t border-ink/10" : ""}`}
          style={{ gridTemplateColumns: cols }}
        >
          <div className="flex h-[22px] items-center pr-2 text-[11px] text-ink/50" title={r.hint}>
            <span className={r.hint ? "cursor-help border-b border-dotted border-ink/30" : ""}>{r.label}</span>
          </div>
          {evals.map((e) => r.render(e))}
        </div>
      ))}
    </div>
  );
}
