/**
 * Types et helpers d'affichage des modalités de facturation, partagés par
 * l'onglet Contrat › Facturation et le bandeau de suivi de Finances.
 * Les formes suivent les routes /api/contracts/[id]/billing-*.
 */
import type { ExpectedInvoice, ExpectedStatus, SeasonInfo } from "@/lib/billing-schedule";

export type { ExpectedInvoice, ExpectedStatus, SeasonInfo };

export type BillingPoste = "P1" | "P2" | "P3" | "AUTRE";
export const POSTES: BillingPoste[] = ["P1", "P2", "P3", "AUTRE"];
export const POSTE_LABELS: Record<BillingPoste, string> = { P1: "P1", P2: "P2", P3: "P3", AUTRE: "Autre" };

export interface BillingLine {
  id: string;
  label: string;
  poste: BillingPoste | null;
  countPerYear: number;
  months: number[];
  percents: number[];
  toleranceDays: number;
  sortOrder?: number;
}

export interface UnmatchedInvoice {
  id: string;
  reference: string;
  type: string;
  nature: string | null;
  amount: number;
  issueDate: string;
  status: string;
}

export interface BillingScheduleResponse {
  season: SeasonInfo;
  seasons: SeasonInfo[];
  lines: BillingLine[];
  expected: ExpectedInvoice[];
  counts: Record<ExpectedStatus, number>;
  unmatched: UnmatchedInvoice[];
}

export interface SuggestedLine {
  label: string;
  poste: BillingPoste | null;
  countPerYear: number;
  months: number[];
  percents: number[];
  uses: number;
}

export const STATUS_LABELS: Record<ExpectedStatus, string> = {
  RECUE: "Reçue",
  ATTENDUE: "Attendue",
  EN_RETARD: "En retard",
  A_VENIR: "À venir",
};

/** Hachures (motif, pas un dégradé décoratif) pour les attendus en cours. */
export const HATCH = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(15,30,51,0.14) 0 1px, transparent 1px 5px)",
} as const;

/** Classes Tailwind d'un bloc / d'un carré selon le statut. */
export const STATUS_BLOCK: Record<ExpectedStatus, string> = {
  RECUE: "bg-ink text-paper border border-ink",
  ATTENDUE: "border border-ink/40 bg-white text-ink/70",
  EN_RETARD: "bg-red-700 text-white border border-red-700",
  A_VENIR: "border border-dashed border-ink/15 bg-transparent text-ink/30",
};

export const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** Mois en 3 lettres pour les rangées de cases. */
export const MONTHS_TINY = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * Une ligne telle que le cache SWR (localStorage) peut la resservir : forme
 * actuelle, ou forme d'une version précédente sans `months`/`percents`/`label`.
 * On normalise à la lecture pour ne jamais planter sur un cache obsolète.
 */
export function normalizeLine(raw: Partial<BillingLine> & { id: string }): BillingLine {
  const count = Number(raw.countPerYear);
  return {
    id: raw.id,
    label: typeof raw.label === "string" ? raw.label : "",
    poste: raw.poste ?? null,
    countPerYear: Number.isInteger(count) && count >= 1 ? count : 1,
    months: Array.isArray(raw.months) ? raw.months : [],
    percents: Array.isArray(raw.percents) ? raw.percents : [],
    toleranceDays: typeof raw.toleranceDays === "number" ? raw.toleranceDays : 30,
    sortOrder: raw.sortOrder,
  };
}

/** Phrase d'une ligne : « 3 par an · oct · janv · avr · 30 · 30 · 30 % ». */
export function lineSentence(raw: Pick<BillingLine, "countPerYear" | "months" | "percents">): string {
  const months = Array.isArray(raw.months) ? raw.months : [];
  const percents = Array.isArray(raw.percents) ? raw.percents : [];
  const n = raw.countPerYear;
  const parts = [`${n} par an`];
  if (months.length === n && n <= 6) {
    parts.push(months.map((m) => (MONTHS_SHORT[m - 1] ?? "").replace(".", "")).join(" · "));
  }
  if (percents.length === n && n <= 6) {
    parts.push(`${percents.join(" · ")} %`);
  }
  return parts.join("   ");
}

/**
 * Date ISO renvoyée par l'API → minuit local du même jour calendaire.
 */
export function day(iso: string | null | undefined): Date {
  if (!iso) return new Date(NaN);
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}

export function formatEuro(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} €`;
}

/** Montant compact pour l'intérieur d'un bloc : 12,4 k€. */
export function formatEuroCompact(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: n >= 100_000 ? 0 : 1 })} k€`;
  }
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

export function formatDate(iso: string | null | undefined): string {
  const d = day(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** « oct.–déc. 2025 », « nov. 2025–janv. 2026 », « oct. 2025 ». */
export function formatPeriod(startIso: string, endIso: string): string {
  const s = day(startIso);
  const e = day(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "—";
  const sm = MONTHS_SHORT[s.getMonth()];
  const em = MONTHS_SHORT[e.getMonth()];
  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) return `${sm} ${s.getFullYear()}`;
    return `${sm}–${em} ${e.getFullYear()}`;
  }
  return `${sm} ${s.getFullYear()}–${em} ${e.getFullYear()}`;
}

/** Libellé court d'un attendu : « P3 GE 3/4 ». */
export function expectedShortLabel(e: Pick<ExpectedInvoice, "label" | "index" | "count">): string {
  const label = e.label ?? "Facture";
  return e.count > 1 ? `${label} ${e.index}/${e.count}` : label;
}

/** Info-bulle d'un attendu : « P3 GE 3/4 · oct. 2025 · 12 450 € ». */
export function expectedTooltip(e: ExpectedInvoice): string {
  const parts = [expectedShortLabel(e), formatPeriod(e.periodStart, e.periodEnd)];
  if (e.percent != null) parts.push(`${e.percent} %`);
  if (e.status === "RECUE") {
    parts.push(formatEuro(e.amount));
    const refs = (e.invoices ?? []).map((i) => i.reference).filter(Boolean);
    if (refs.length) parts.push(refs.join(", "));
  } else if (e.status === "EN_RETARD") {
    parts.push(`en retard depuis le ${formatDate(e.dueDate)}`);
  } else if (e.status === "ATTENDUE") {
    parts.push(`attendue avant le ${formatDate(e.dueDate)}`);
  } else {
    parts.push("à venir");
  }
  return parts.join(" · ");
}

/** Jours écoulés depuis la date limite (> 0 si dépassée). */
export function daysLate(dueIso: string, today = new Date()): number {
  const due = day(dueIso);
  return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
}

/** Regroupe les attendus du serveur par ligne. */
export function groupByLine(expected: ExpectedInvoice[]): Map<string, ExpectedInvoice[]> {
  const byLine = new Map<string, ExpectedInvoice[]>();
  for (const e of expected) {
    const arr = byLine.get(e.lineId) ?? [];
    arr.push(e);
    byLine.set(e.lineId, arr);
  }
  return byLine;
}

/** Erreur SWR → message du serveur ({ error }) s'il y en a un. */
export function swrErrorMessage(err: unknown): string | null {
  if (!err) return null;
  const info = (err as { info?: { error?: unknown } }).info;
  if (info && typeof info.error === "string") return info.error;
  return err instanceof Error ? err.message : "Erreur de chargement";
}

export function swrErrorStatus(err: unknown): number | undefined {
  return (err as { status?: number } | undefined)?.status;
}
