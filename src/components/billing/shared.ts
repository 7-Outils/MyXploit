/**
 * Types et helpers d'affichage de l'échéancier de facturation, partagés par
 * l'onglet Contrat › Facturation et le bandeau de suivi de Finances.
 * Les formes suivent les routes /api/contracts/[id]/billing-*.
 */
import type { ExpectedInvoice, ExpectedStatus, SeasonInfo } from "@/lib/billing-schedule";

export type { ExpectedInvoice, ExpectedStatus, SeasonInfo };
export { POSTE_LABELS, NATURE_LABELS, RHYTHM_LABELS } from "@/lib/billing-schedule";

export type BillingPoste = "P1" | "P2" | "P3" | "INTERESSEMENT" | "AUTRE";
export type BillingNature = "ACOMPTE_FORFAIT" | "REEL" | "DECOMPTE";
export type BillingRhythm = "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";

export const POSTES: BillingPoste[] = ["P1", "P2", "P3", "INTERESSEMENT", "AUTRE"];
export const NATURES: BillingNature[] = ["ACOMPTE_FORFAIT", "REEL", "DECOMPTE"];
export const RHYTHMS: BillingRhythm[] = ["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"];

export interface BillingLine {
  id: string;
  poste: BillingPoste;
  nature: BillingNature;
  rhythm: BillingRhythm;
  expectedMonth: number | null;
  toleranceDays: number;
  label: string | null;
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
  poste: BillingPoste;
  nature: BillingNature;
  rhythm: BillingRhythm;
  expectedMonth: number | null;
  reason: string;
}

/** Libellé court du poste (colonne étroite). */
export const POSTE_SHORT: Record<BillingPoste, string> = {
  P1: "P1",
  P2: "P2",
  P3: "P3",
  INTERESSEMENT: "Int.",
  AUTRE: "Autre",
};

export const NATURE_SHORT: Record<BillingNature, string> = {
  ACOMPTE_FORFAIT: "Acompte",
  REEL: "Réel",
  DECOMPTE: "Décompte",
};

export const PERIODS_PER_SEASON: Record<BillingRhythm, number> = {
  MENSUEL: 12,
  TRIMESTRIEL: 4,
  SEMESTRIEL: 2,
  ANNUEL: 1,
};

export const STATUS_LABELS: Record<ExpectedStatus, string> = {
  RECUE: "Reçue",
  ATTENDUE: "Attendue",
  EN_RETARD: "En retard",
  A_VENIR: "À venir",
};

/** Ordre d'affichage des compteurs. */
export const STATUS_ORDER: ExpectedStatus[] = ["RECUE", "ATTENDUE", "EN_RETARD", "A_VENIR"];

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

/**
 * Date ISO renvoyée par l'API → minuit local du même jour calendaire.
 * Les bornes sont calculées côté serveur à minuit (UTC sur Vercel) : on ne
 * garde que la partie date pour ne pas glisser d'un jour selon le fuseau.
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

/** Libellé court d'un attendu : « P2 · Acompte 3/4 ». */
export function expectedShortLabel(e: Pick<ExpectedInvoice, "poste" | "nature" | "index" | "count">): string {
  const poste = POSTE_SHORT[e.poste as BillingPoste] ?? e.poste;
  const nature = NATURE_SHORT[e.nature as BillingNature] ?? e.nature;
  return e.count > 1 ? `${poste} · ${nature} ${e.index}/${e.count}` : `${poste} · ${nature}`;
}

/** Info-bulle d'un attendu : « P2 · Acompte 3/4 · oct.–déc. 2025 · 12 450 € ». */
export function expectedTooltip(e: ExpectedInvoice): string {
  const parts = [expectedShortLabel(e), formatPeriod(e.periodStart, e.periodEnd)];
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
