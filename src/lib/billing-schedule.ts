/**
 * Échéancier de facturation d'un contrat.
 *
 * Une ligne (ContractBillingLine) = un flux attendu : poste × nature × rythme.
 * À partir des lignes et du type d'année du contrat, on déduit pour une saison
 * la liste des factures attendues (période couverte, date limite), puis on
 * rapproche chaque attendu des factures réellement reçues.
 */
import type { BillingNature, BillingPoste, BillingRhythm, ContractType } from "@/generated/prisma/client";

export type YearType = "CIVIL" | "HEATING_SEASON" | "CONTRACTUAL";

export interface ContractYearInfo {
  startDate: Date | null;
  endDate: Date | null;
  yearType: YearType;
  yearStartMonth: number; // 1-12
  yearStartDay: number;
}

export interface BillingLineInput {
  id: string;
  poste: BillingPoste;
  nature: BillingNature;
  rhythm: BillingRhythm;
  expectedMonth: number | null;
  toleranceDays: number;
  label: string | null;
  splitPercents?: number[]; // vide = parts égales
}

export interface InvoiceLite {
  id: string;
  reference: string;
  type: "P1" | "P2" | "P3" | "TRAVAUX" | "AUTRE";
  nature: "ACOMPTE" | "DECOMPTE" | "AVOIR" | "INTERESSEMENT" | "AUTRE" | null;
  status: "EN_ATTENTE" | "VALIDEE" | "REFUSEE";
  amount: number;
  issueDate: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
}

export type ExpectedStatus = "RECUE" | "A_VENIR" | "ATTENDUE" | "EN_RETARD";

export interface ExpectedInvoice {
  key: string; // `${lineId}:${index}`
  lineId: string;
  poste: BillingPoste;
  nature: BillingNature;
  label: string;
  index: number; // 1..n dans la saison
  count: number; // n attendus pour la ligne sur la saison
  periodStart: string; // ISO
  periodEnd: string; // ISO
  dueDate: string; // ISO : fin de période + tolérance
  percent: number; // part de l'annuel attendue sur cette facture (100 pour une facture unique)
  status: ExpectedStatus;
  invoices: Array<{ id: string; reference: string; amount: number; status: InvoiceLite["status"]; issueDate: string }>;
  amount: number; // somme des factures rapprochées (validées + en attente)
}

export interface SeasonInfo {
  key: string; // "2025-2026" ou "2025"
  label: string;
  start: string;
  end: string;
  isCurrent: boolean;
}

const DAY = 86_400_000;

// ─── Saisons ────────────────────────────────────────────────────────────────

function yearStartFor(year: number, c: ContractYearInfo): Date {
  if (c.yearType === "CIVIL") return new Date(year, 0, 1);
  if (c.yearType === "CONTRACTUAL" && c.startDate) {
    return new Date(year, c.startDate.getMonth(), c.startDate.getDate());
  }
  return new Date(year, (c.yearStartMonth || 7) - 1, c.yearStartDay || 1);
}

function seasonKey(start: Date, end: Date): string {
  const y1 = start.getFullYear();
  const y2 = end.getFullYear();
  return y1 === y2 ? `${y1}` : `${y1}-${y2}`;
}

/** Toutes les saisons couvertes par le contrat (bornées aux dates du contrat). */
export function contractSeasons(c: ContractYearInfo, today = new Date()): SeasonInfo[] {
  if (!c.startDate || !c.endDate) return [];
  const out: SeasonInfo[] = [];
  let start = yearStartFor(c.startDate.getFullYear(), c);
  if (start > c.startDate) start = yearStartFor(c.startDate.getFullYear() - 1, c);
  while (start <= c.endDate) {
    const next = yearStartFor(start.getFullYear() + 1, c);
    const end = new Date(next.getTime() - DAY);
    const key = seasonKey(start, end);
    out.push({
      key,
      label: key.includes("-") ? `Saison ${key.replace("-", "/")}` : `Année ${key}`,
      start: start.toISOString(),
      end: end.toISOString(),
      isCurrent: today >= start && today <= end,
    });
    start = next;
  }
  return out;
}

export function seasonBounds(c: ContractYearInfo, key: string): { start: Date; end: Date } | null {
  const y = parseInt(key.slice(0, 4), 10);
  if (Number.isNaN(y)) return null;
  const start = yearStartFor(y, c);
  const end = new Date(yearStartFor(y + 1, c).getTime() - DAY);
  return { start, end };
}

// ─── Attendus ───────────────────────────────────────────────────────────────

const PERIODS: Record<BillingRhythm, number> = { MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1 };

export const POSTE_LABELS: Record<BillingPoste, string> = {
  P1: "P1 · Énergie",
  P2: "P2 · Conduite & maintenance",
  P3: "P3 · Garantie totale",
  INTERESSEMENT: "Intéressement",
  AUTRE: "Autre",
};

export const NATURE_LABELS: Record<BillingNature, string> = {
  ACOMPTE_FORFAIT: "Acompte forfaitaire",
  REEL: "Au réel",
  DECOMPTE: "Décompte",
};

export const RHYTHM_LABELS: Record<BillingRhythm, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

function lineLabel(l: BillingLineInput): string {
  return l.label || `${POSTE_LABELS[l.poste]} — ${NATURE_LABELS[l.nature]}`;
}

/** Les factures attendues d'une ligne sur une saison [start, end]. */
export function expectedForLine(line: BillingLineInput, start: Date, end: Date): Omit<ExpectedInvoice, "status" | "invoices" | "amount">[] {
  const n = PERIODS[line.rhythm];
  const months = 12 / n;
  const split = line.splitPercents && line.splitPercents.length === n ? line.splitPercents : null;
  const out: Omit<ExpectedInvoice, "status" | "invoices" | "amount">[] = [];
  for (let i = 0; i < n; i++) {
    const pStart = addMonths(start, i * months);
    const pEnd = i === n - 1 ? end : new Date(addMonths(start, (i + 1) * months).getTime() - DAY);
    // Ligne annuelle avec mois attendu : la date limite est la fin de ce mois (dans la saison)
    let due = new Date(pEnd.getTime() + line.toleranceDays * DAY);
    if (line.rhythm === "ANNUEL" && line.expectedMonth) {
      const m = line.expectedMonth - 1;
      let y = start.getFullYear();
      if (new Date(y, m, 1) < start) y += 1;
      const monthEnd = new Date(y, m + 1, 0);
      due = new Date(monthEnd.getTime() + line.toleranceDays * DAY);
    }
    out.push({
      key: `${line.id}:${i + 1}`,
      lineId: line.id,
      poste: line.poste,
      nature: line.nature,
      label: lineLabel(line),
      index: i + 1,
      count: n,
      periodStart: pStart.toISOString(),
      periodEnd: pEnd.toISOString(),
      dueDate: due.toISOString(),
      percent: split ? split[i] : Math.round((100 / n) * 100) / 100,
    });
  }
  return out;
}

// ─── Rapprochement ──────────────────────────────────────────────────────────

function invoiceMatchesLine(inv: InvoiceLite, line: BillingLineInput): boolean {
  if (inv.status === "REFUSEE") return false;
  if (inv.nature === "AVOIR") return false;
  if (line.poste === "INTERESSEMENT") return inv.nature === "INTERESSEMENT";
  if (line.poste === "AUTRE") return inv.type === "AUTRE" && inv.nature !== "INTERESSEMENT";
  if (inv.type !== line.poste) return false;
  if (line.nature === "DECOMPTE") return inv.nature === "DECOMPTE";
  // acompte / réel : tout sauf décompte et intéressement
  return inv.nature !== "DECOMPTE" && inv.nature !== "INTERESSEMENT";
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Rapproche les factures avec les attendus d'une saison. Une facture va à
 * l'attendu dont la période recoupe le plus sa période de facturation (ou,
 * sans période renseignée, celui dans lequel tombe sa date d'émission).
 */
export function buildSchedule(
  lines: BillingLineInput[],
  invoices: InvoiceLite[],
  start: Date,
  end: Date,
  today = new Date()
): ExpectedInvoice[] {
  const result: ExpectedInvoice[] = [];
  const used = new Set<string>();

  for (const line of lines) {
    const expected = expectedForLine(line, start, end);
    const candidates = invoices.filter((inv) => !used.has(inv.id) && invoiceMatchesLine(inv, line));
    const buckets: InvoiceLite[][] = expected.map(() => []);

    for (const inv of candidates) {
      let best = -1;
      let bestScore = 0;
      for (let i = 0; i < expected.length; i++) {
        const pS = new Date(expected[i].periodStart);
        const pE = new Date(expected[i].periodEnd);
        let score = 0;
        if (inv.periodStart && inv.periodEnd) {
          if (overlaps(inv.periodStart, inv.periodEnd, pS, pE)) {
            const o = Math.min(inv.periodEnd.getTime(), pE.getTime()) - Math.max(inv.periodStart.getTime(), pS.getTime());
            score = o / DAY + 1;
          }
        } else if (line.nature === "DECOMPTE" || line.rhythm === "ANNUEL") {
          // Un décompte s'émet après la période : on l'accepte jusqu'à la date limite
          const due = new Date(expected[i].dueDate);
          if (inv.issueDate >= pS && inv.issueDate <= due) score = 1;
        } else if (inv.issueDate >= pS && inv.issueDate <= new Date(pE.getTime() + line.toleranceDays * DAY)) {
          // Émise pendant la période ou juste après
          score = 1;
        }
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best >= 0) {
        buckets[best].push(inv);
        used.add(inv.id);
      }
    }

    expected.forEach((e, i) => {
      const got = buckets[i];
      const pS = new Date(e.periodStart);
      const due = new Date(e.dueDate);
      let status: ExpectedStatus;
      if (got.length > 0) status = "RECUE";
      else if (today < pS) status = "A_VENIR";
      else if (today <= due) status = "ATTENDUE";
      else status = "EN_RETARD";
      result.push({
        ...e,
        status,
        invoices: got.map((g) => ({ id: g.id, reference: g.reference, amount: g.amount, status: g.status, issueDate: g.issueDate.toISOString() })),
        amount: got.reduce((s, g) => s + g.amount, 0),
      });
    });
  }
  return result;
}

// ─── Suggestions d'après les types de marché des sites ─────────────────────

export interface SuggestedLine {
  poste: BillingPoste;
  nature: BillingNature;
  rhythm: BillingRhythm;
  expectedMonth: number | null;
  reason: string;
}

const REEL_TYPES: ContractType[] = ["MC", "MCI", "CP", "CPI"];
const FORFAIT_TYPES: ContractType[] = ["MT", "MTI", "MF", "PF", "PFI"];
const INTERESSEMENT_TYPES: ContractType[] = ["MTI", "MCI", "PFI", "CPI"];

export function suggestLines(
  sites: Array<{ contractType: ContractType; hasP1: boolean; hasP2: boolean; hasP3: boolean }>,
  yearStartMonth = 7
): SuggestedLine[] {
  const out: SuggestedLine[] = [];
  const types = new Set(sites.map((s) => s.contractType));
  const hasP1 = sites.some((s) => s.hasP1);
  const hasP2 = sites.some((s) => s.hasP2);
  const hasP3 = sites.some((s) => s.hasP3);
  // Mois de fin de saison (décomptes) : le mois précédant le début d'année contractuelle
  const endMonth = ((yearStartMonth + 10) % 12) + 1;
  const list = (arr: ContractType[]) => arr.filter((t) => types.has(t)).join(", ");

  if (hasP1) {
    if (REEL_TYPES.some((t) => types.has(t))) {
      out.push({ poste: "P1", nature: "REEL", rhythm: "MENSUEL", expectedMonth: null, reason: `Marché au réel (${list(REEL_TYPES)}) : facture de consommation mensuelle` });
    }
    if (FORFAIT_TYPES.some((t) => types.has(t))) {
      out.push({ poste: "P1", nature: "ACOMPTE_FORFAIT", rhythm: "TRIMESTRIEL", expectedMonth: null, reason: `Marché forfaitaire (${list(FORFAIT_TYPES)}) : acomptes P1` });
      out.push({ poste: "P1", nature: "DECOMPTE", rhythm: "ANNUEL", expectedMonth: endMonth + 2 > 12 ? endMonth + 2 - 12 : endMonth + 2, reason: "Décompte P1 de fin de saison (DJU, NB)" });
    }
  }
  if (hasP2) out.push({ poste: "P2", nature: "ACOMPTE_FORFAIT", rhythm: "TRIMESTRIEL", expectedMonth: null, reason: "Forfait P2 : acomptes trimestriels" });
  if (hasP3) out.push({ poste: "P3", nature: "ACOMPTE_FORFAIT", rhythm: "TRIMESTRIEL", expectedMonth: null, reason: "Forfait P3 : acomptes trimestriels" });
  if (INTERESSEMENT_TYPES.some((t) => types.has(t))) {
    out.push({ poste: "INTERESSEMENT", nature: "DECOMPTE", rhythm: "ANNUEL", expectedMonth: endMonth + 3 > 12 ? endMonth + 3 - 12 : endMonth + 3, reason: `Clause d'intéressement (${list(INTERESSEMENT_TYPES)}) : décompte annuel` });
  }
  return out;
}
