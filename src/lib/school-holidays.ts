/**
 * Vacances scolaires (calendrier officiel, data.education.gouv.fr, sans clé).
 * Sert à caler l'allumage d'une école sur la rentrée plutôt qu'en plein
 * congés, et l'arrêt sur le début des vacances.
 */
import { unstable_cache } from "next/cache";

export type SchoolZone = "Zone A" | "Zone B" | "Zone C" | "Corse";

export interface HolidayPeriod {
  label: string;
  /** Premier jour sans classe (YYYY-MM-DD). */
  from: string;
  /** Dernier jour sans classe, veille de la rentrée. */
  to: string;
}

// Départements → zone (découpage académique 2026).
const ZONE_A = ["01","03","07","15","16","17","19","21","23","24","25","26","33","38","39","40","42","43","47","58","63","64","69","70","71","73","74","79","86","87","89","90"];
const ZONE_B = ["02","04","05","06","08","10","13","14","18","22","27","28","29","35","36","37","41","44","45","49","50","51","52","53","54","55","56","57","59","60","61","62","67","68","72","76","80","83","84","85","88"];
const ZONE_C = ["09","11","12","30","31","32","34","46","48","65","66","75","77","78","81","82","91","92","93","94","95"];

export function schoolZoneOf(postalCode: string | null | undefined): SchoolZone | null {
  if (!postalCode) return null;
  const pc = postalCode.trim();
  if (/^20[0-9]{3}$/.test(pc)) return "Corse";
  const dept = pc.slice(0, 2);
  if (ZONE_A.includes(dept)) return "Zone A";
  if (ZONE_B.includes(dept)) return "Zone B";
  if (ZONE_C.includes(dept)) return "Zone C";
  return null; // DOM, Monaco, code invalide : pas d'ajustement
}

function parisDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

function shiftDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
}

async function fetchHolidaysUncached(zone: SchoolZone, schoolYear: string): Promise<HolidayPeriod[]> {
  const where = `zones="${zone}" AND annee_scolaire="${schoolYear}"`;
  const url =
    "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records" +
    `?select=description,start_date,end_date,population&where=${encodeURIComponent(where)}&limit=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`calendrier scolaire ${res.status}`);
  const json = await res.json();
  const seen = new Set<string>();
  const out: HolidayPeriod[] = [];
  for (const r of json?.results ?? []) {
    if (r.population === "Enseignants") continue;
    // start_date = minuit (Paris) du premier jour de congé ; end_date = minuit
    // du jour de la rentrée.
    const from = parisDate(r.start_date);
    const to = shiftDays(parisDate(r.end_date), -1);
    const key = `${from}|${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: r.description, from, to });
  }
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

/** Année scolaire "YYYY-YYYY+1" couvrant la date. */
function schoolYearOf(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export async function fetchSchoolHolidays(zone: SchoolZone, todayIso: string): Promise<HolidayPeriod[]> {
  const year = schoolYearOf(todayIso);
  const cached = unstable_cache(() => fetchHolidaysUncached(zone, year), ["school-holidays", zone, year], {
    revalidate: 24 * 3600,
  });
  return cached();
}

export interface HolidayAdjustment {
  date: string;
  /** Explication quand la date a été déplacée, sinon null. */
  note: string | null;
}

/**
 * Allumage tombant pendant les vacances → veille de la rentrée (le bâtiment
 * est vide, on chauffe pour le premier jour de classe). Arrêt tombant pendant
 * les vacances → premier jour de congé.
 */
export function adjustForSchoolHolidays(
  date: string,
  kind: "start" | "stop",
  holidays: HolidayPeriod[]
): HolidayAdjustment {
  const h = holidays.find((p) => date >= p.from && date <= p.to);
  if (!h) return { date, note: null };
  if (kind === "start") {
    return h.to === date
      ? { date, note: null }
      : { date: h.to, note: `${h.label} : allumage reporté à la veille de la rentrée` };
  }
  return h.from === date
    ? { date, note: null }
    : { date: h.from, note: `${h.label} : arrêt avancé au début des vacances` };
}
