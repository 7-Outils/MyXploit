"use client";

import { editorialDisplay, editorialMono } from "@/lib/editorial-fonts";

interface Props {
  reference?: string;
  title?: string;
  startDate: string | Date;
  endDate: string | Date;
}

function fmtDate(d: Date): string {
  return d
    .toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(".", "")
    .toUpperCase();
}

export default function ContractPeriodBar({ reference, title, startDate, endDate }: Props) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = Date.now();

  const span = end.getTime() - start.getTime();
  const elapsed = Math.max(0, now - start.getTime());
  const progress = span > 0 ? Math.min(100, (elapsed / span) * 100) : 0;
  const totalDays = Math.max(1, Math.round(span / 86_400_000));
  const elapsedDays = Math.max(0, Math.round(elapsed / 86_400_000));
  const daysLeft = totalDays - elapsedDays;
  const isExpired = daysLeft < 0;
  const isEndingSoon = !isExpired && daysLeft <= 90;

  // Tonalité couleur selon état — pas de rouge "alerte" dans le standard,
  // on reste sur stone/emerald/amber pour une lecture calme.
  const progressColor = isExpired
    ? "bg-rose-500"
    : isEndingSoon
    ? "bg-amber-500"
    : "bg-emerald-500";

  const statusColor = isExpired
    ? "text-rose-700"
    : isEndingSoon
    ? "text-amber-700"
    : "text-stone-500";

  const statusLabel = isExpired
    ? `expiré · ${Math.abs(daysLeft)} j`
    : isEndingSoon
    ? `${daysLeft} j · fin proche`
    : `${daysLeft} j restants`;

  return (
    <section
      className={`${editorialDisplay.variable} ${editorialMono.variable} bg-white rounded-xl border border-stone-200/70 overflow-hidden`}
    >
      <div className="px-8 pt-7 pb-6">
        {/* Eyebrow */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-stone-400 font-semibold">
            <span>§</span>
            <span>Cycle contractuel</span>
            {reference && (
              <span className={`${editorialMono.className} text-stone-500 tabular-nums normal-case tracking-normal`}>
                réf · {reference}
              </span>
            )}
          </div>
          <div
            className={`${editorialMono.className} text-[10px] uppercase tracking-[0.18em] font-semibold ${statusColor}`}
          >
            {statusLabel}
          </div>
        </div>

        {/* Display chiffre : % écoulé */}
        <div className="flex items-end justify-between gap-10">
          <div className="flex-shrink-0">
            <div className="flex items-baseline gap-3">
              <div
                className={`${editorialDisplay.className} italic text-stone-900 tabular-nums leading-none`}
                style={{ fontSize: "clamp(56px, 5.5vw, 88px)" }}
              >
                {Math.round(progress)}
                <span className="text-stone-400 text-[0.55em] ml-1 not-italic">%</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-stone-400 font-semibold pb-3">
                écoulé
              </div>
            </div>
            {title && (
              <div className="mt-1 text-sm text-stone-600 font-medium truncate max-w-md">
                {title}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Timeline avec dates */}
            <div className="flex items-end justify-between mb-2">
              <Pole label="Début" value={fmtDate(start)} />
              <Pole label="Fin" value={fmtDate(end)} align="right" />
            </div>
            <div className="relative h-[3px] bg-stone-100 overflow-visible">
              <div
                className={`absolute inset-y-0 left-0 ${progressColor} transition-all`}
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute -top-1.5 w-3 h-3 rounded-full bg-white border-2 border-stone-900 shadow-sm"
                style={{
                  left: `${progress}%`,
                  transform: "translateX(-50%)",
                }}
              />
            </div>
            <div
              className={`${editorialMono.className} mt-3 flex justify-between text-[10px] uppercase tracking-wider text-stone-400 tabular-nums`}
            >
              <span>
                J·<span className="text-stone-700 font-medium">{elapsedDays.toLocaleString("fr-FR")}</span>
              </span>
              <span className="italic normal-case tracking-normal">
                {Math.abs(daysLeft).toLocaleString("fr-FR")} j {isExpired ? "depuis l'échéance" : "à courir"}
              </span>
              <span>
                J·<span className="text-stone-700 font-medium">{totalDays.toLocaleString("fr-FR")}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pole({ label, value, align = "left" }: { label: string; value: string; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="text-[9px] uppercase tracking-[0.22em] text-stone-400 font-semibold mb-1">
        {label}
      </div>
      <div className={`${editorialMono.className} text-[11px] tabular-nums text-stone-900 font-medium`}>
        {value}
      </div>
    </div>
  );
}
