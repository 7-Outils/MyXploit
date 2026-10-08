/**
 * Dates d'allumage/arrêt par famille de bâtiments d'un contrat : même météo
 * pour tous, seuils du profil, et calendrier scolaire pour les écoles.
 */
import { computeHeatingSignal, type DailyTemp, type HeatingSignal } from "@/lib/heating-season";
import {
  HEATING_PROFILE_LABELS,
  HEATING_PROFILE_THRESHOLDS,
  PROFILE_ORDER,
  SCHOOL_TYPES,
  heatingProfileOf,
  type HeatingProfile,
} from "@/lib/heating-profiles";
import { adjustForSchoolHolidays, fetchSchoolHolidays, schoolZoneOf, type HolidayPeriod } from "@/lib/school-holidays";

export interface HeatingGroup {
  key: string; // profil, suffixé "-ECOLE" pour la part scolaire
  profile: HeatingProfile;
  label: string;
  siteIds: string[];
  signal: HeatingSignal;
  startDate: string | null;
  stopDate: string | null;
  /** Explication si la date a été calée sur le calendrier scolaire. */
  startNote: string | null;
  stopNote: string | null;
}

interface GroupSite {
  id: string;
  type: string;
  postalCode: string | null;
}

export async function computeHeatingGroups(sites: GroupSite[], daily: DailyTemp[], todayIso: string): Promise<HeatingGroup[]> {
  const byKey = new Map<string, { profile: HeatingProfile; school: boolean; sites: GroupSite[] }>();
  for (const s of sites) {
    const profile = heatingProfileOf(s.type);
    const school = SCHOOL_TYPES.has(s.type);
    const key = school ? `${profile}-ECOLE` : profile;
    const g = byKey.get(key) ?? { profile, school, sites: [] };
    g.sites.push(s);
    byKey.set(key, g);
  }

  // Calendrier scolaire : jamais bloquant, on garde la date brute en cas d'échec.
  const holidaysByZone = new Map<string, HolidayPeriod[]>();
  const schoolGroups = [...byKey.values()].filter((g) => g.school);
  if (schoolGroups.length > 0) {
    const zone = schoolZoneOf(schoolGroups[0].sites.find((s) => s.postalCode)?.postalCode);
    if (zone) {
      try {
        holidaysByZone.set(zone, await fetchSchoolHolidays(zone, todayIso));
      } catch (e) {
        console.warn("[heating-groups] calendrier scolaire indisponible:", e instanceof Error ? e.message : e);
      }
    }
  }

  const groups: HeatingGroup[] = [];
  for (const [key, g] of byKey) {
    const siteIds = g.sites.map((s) => s.id);
    const label = g.school ? "Écoles, collèges, lycées" : HEATING_PROFILE_LABELS[g.profile];
    if (g.profile === "HORS_SIGNAL") {
      groups.push({ key, profile: g.profile, label, siteIds, signal: "NEUTRAL", startDate: null, stopDate: null, startNote: null, stopNote: null });
      continue;
    }
    const w = computeHeatingSignal(daily, todayIso, HEATING_PROFILE_THRESHOLDS[g.profile]);
    let startDate = w.startDate;
    let stopDate = w.stopDate;
    let startNote: string | null = null;
    let stopNote: string | null = null;
    if (g.school) {
      const zone = schoolZoneOf(g.sites.find((s) => s.postalCode)?.postalCode);
      const holidays = zone ? holidaysByZone.get(zone) : undefined;
      if (holidays) {
        if (startDate) ({ date: startDate, note: startNote } = adjustForSchoolHolidays(startDate, "start", holidays));
        if (stopDate) ({ date: stopDate, note: stopNote } = adjustForSchoolHolidays(stopDate, "stop", holidays));
      }
    }
    const signal: HeatingSignal = stopDate === todayIso ? "STOP" : startDate === todayIso ? "START" : "NEUTRAL";
    groups.push({ key, profile: g.profile, label, siteIds, signal, startDate, stopDate, startNote, stopNote });
  }

  return groups.sort(
    (a, b) => PROFILE_ORDER.indexOf(a.profile) - PROFILE_ORDER.indexOf(b.profile) || a.key.localeCompare(b.key)
  );
}
