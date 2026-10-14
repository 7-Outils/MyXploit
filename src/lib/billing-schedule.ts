/**
 * Modalités de facturation d'un contrat → factures attendues d'une saison.
 *
 * Une ligne (ContractBillingLine) = « une facture, N fois par an », avec
 * éventuellement les mois de chaque facture et leur part en %. À partir des
 * lignes et du type d'année du contrat, on déduit pour une saison la liste
 * des factures attendues, puis on rapproche chaque attendu des factures reçues.
 */
import type { BillingPoste } from "@/generated/prisma/client";

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
  label: string;
  poste: BillingPoste | null;
  countPerYear: number;
  months: number[];
  percents: number[];
  toleranceDays: number;
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
  label: string;
  poste: BillingPoste | null;
  index: number; // 1..n dans la saison
  count: number; // n attendus pour la ligne sur la saison
  periodStart: string; // ISO
  periodEnd: string; // ISO
  dueDate: string; // ISO : fin de période + tolérance
  percent: number | null; // part de l'annuel attendue sur cette facture, si précisée
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

/** Toutes les saisons couvertes par le contrat. */
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

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

/** Premier jour du mois `m` (1-12) tel qu'il tombe dans la saison [start, end]. */
function monthInSeason(m: number, start: Date, end: Date): Date {
  let y = start.getFullYear();
  if (new Date(y, m - 1, 1) < new Date(start.getFullYear(), start.getMonth(), 1)) y += 1;
  const d = new Date(y, m - 1, 1);
  return d > end ? new Date(y - 1, m - 1, 1) : d;
}

/** Les factures attendues d'une ligne sur une saison [start, end]. */
export function expectedForLine(line: BillingLineInput, start: Date, end: Date): Omit<ExpectedInvoice, "status" | "invoices" | "amount">[] {
  const n = Math.max(1, Math.min(12, line.countPerYear || 1));
  const out: Omit<ExpectedInvoice, "status" | "invoices" | "amount">[] = [];
  const useMonths = line.months.length === n;
  const items: Array<{ pStart: Date; pEnd: Date }> = [];
  if (useMonths) {
    const sorted = [...line.months].sort((a, b) => {
      return monthInSeason(a, start, end).getTime() - monthInSeason(b, start, end).getTime();
    });
    for (const m of sorted) {
      const pStart = monthInSeason(m, start, end);
      const pEnd = new Date(pStart.getFullYear(), pStart.getMonth() + 1, 0);
      items.push({ pStart, pEnd });
    }
  } else {
    const months = 12 / n;
    for (let i = 0; i < n; i++) {
      const pStart = addMonths(start, i * months);
      const pEnd = i === n - 1 ? end : new Date(addMonths(start, (i + 1) * months).getTime() - DAY);
      items.push({ pStart, pEnd });
    }
  }
  // Les parts suivent l'ordre de saisie des mois ; on les réaligne sur l'ordre chronologique
  const order = useMonths
    ? [...line.months.keys()].sort((a, b) => monthInSeason(line.months[a], start, end).getTime() - monthInSeason(line.months[b], start, end).getTime())
    : [...Array(n).keys()];
  items.forEach(({ pStart, pEnd }, i) => {
    const srcIndex = order[i] ?? i;
    out.push({
      key: `${line.id}:${i + 1}`,
      lineId: line.id,
      label: line.label,
      poste: line.poste,
      index: i + 1,
      count: n,
      periodStart: pStart.toISOString(),
      periodEnd: pEnd.toISOString(),
      dueDate: new Date(pEnd.getTime() + line.toleranceDays * DAY).toISOString(),
      percent: line.percents.length === n ? line.percents[srcIndex] : null,
    });
  });
  return out;
}

// ─── Rapprochement ──────────────────────────────────────────────────────────

function invoiceMatchesLine(inv: InvoiceLite, line: BillingLineInput): boolean {
  if (inv.status === "REFUSEE" || inv.nature === "AVOIR") return false;
  const poste = line.poste ?? "AUTRE";
  if (poste === "AUTRE") return inv.type === "AUTRE" || inv.type === "TRAVAUX";
  return inv.type === poste;
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
        const due = new Date(expected[i].dueDate);
        let score = 0;
        if (inv.periodStart && inv.periodEnd) {
          if (overlaps(inv.periodStart, inv.periodEnd, pS, pE)) {
            const o = Math.min(inv.periodEnd.getTime(), pE.getTime()) - Math.max(inv.periodStart.getTime(), pS.getTime());
            score = o / DAY + 1;
          }
        } else if (inv.issueDate >= pS && inv.issueDate <= due) {
          score = 1;
        }
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best >= 0 && buckets[best].length === 0) {
        buckets[best].push(inv);
        used.add(inv.id);
      } else if (best >= 0) {
        // L'attendu a déjà sa facture : on cumule (avoir partiel, complément)
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
