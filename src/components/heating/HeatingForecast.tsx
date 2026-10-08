import { HEATING_RELIABLE_DAYS, type DailyTemp } from "@/lib/heating-season";

const fmtWeekday = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");

const fmtDayMonth = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

/** « jeu. 15/10 » */
export const fmtHeatingDate = (iso: string) => `${fmtWeekday(iso)}. ${fmtDayMonth(iso)}`;

/** Nombre de jours entre aujourd'hui et la date (0 = aujourd'hui). */
export const daysFrom = (todayIso: string, iso: string) =>
  Math.round((new Date(iso + "T12:00:00").getTime() - new Date(todayIso + "T12:00:00").getTime()) / 86400000);

interface Props {
  /** Jours prévus uniquement (aujourd'hui inclus), jusqu'à 15. */
  days: DailyTemp[];
  /** Date(s) d'allumage/arrêt projetée(s), mises en évidence. */
  highlight?: string | string[] | null;
}

function Cell({ day, highlight, faded }: { day: DailyTemp; highlight: boolean; faded: boolean }) {
  return (
    <div
      className={`text-center py-1 border ${
        highlight ? "border-accent bg-accent/5" : "border-ink/10"
      } ${faded && !highlight ? "opacity-50" : ""}`}
      title={`${fmtHeatingDate(day.date)} · min ${Math.round(day.tMin)}° / max ${Math.round(day.tMax)}°`}
    >
      <div className={`text-[10px] uppercase tracking-wide ${highlight ? "text-accent" : "text-ink/40"}`}>
        {fmtWeekday(day.date)}
      </div>
      <div className="font-mono text-[10px] tabular-nums text-ink/40 leading-tight">{fmtDayMonth(day.date)}</div>
      <div className={`font-mono tabular-nums text-sm leading-tight ${highlight ? "text-accent font-semibold" : "text-ink"}`}>
        {Math.round(day.tMean)}°
      </div>
    </div>
  );
}

/** Prévision 15 jours : 7 jours fiables, puis la tendance J+8 → J+15 en retrait. */
export default function HeatingForecast({ days, highlight }: Props) {
  const week = days.slice(0, HEATING_RELIABLE_DAYS);
  const trend = days.slice(HEATING_RELIABLE_DAYS);
  const marks = new Set(Array.isArray(highlight) ? highlight : highlight ? [highlight] : []);
  return (
    <div className="space-y-2">
      <div>
        <div className="label-tech mb-1">7 jours · moyenne journalière</div>
        <div className="grid grid-cols-7 gap-1">
          {week.map((d) => (
            <Cell key={d.date} day={d} highlight={marks.has(d.date)} faded={false} />
          ))}
        </div>
      </div>
      {trend.length > 0 && (
        <div>
          <div className="label-tech mb-1">Tendance · jours 8 à {days.length}</div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${trend.length}, minmax(0, 1fr))` }}>
            {trend.map((d) => (
              <Cell key={d.date} day={d} highlight={marks.has(d.date)} faded />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
