/**
 * Import de facture — forme des champs lus par l'IA.
 *
 * Volontairement distinct du devis : une facture d'exploitant se classe sur
 * l'enum InvoiceType (qui connaît le P2, absent des devis), et la consigne
 * IA doit refléter ce vocabulaire. Classer « Prestations de conduite et
 * entretien courant » en P1 fausse le solde P3 autant que le suivi énergie.
 *
 * Comme pour les devis, pas de parser de secours : lecture IA ratée =
 * formulaire vide avec la cause affichée.
 */

/** Types de facture — doit rester aligné sur l'enum InvoiceType du schéma. */
// Pas de « TRAVAUX » : une facture d'exploitant est P1, P2 ou P3 — les travaux
// hors contrat passent par un devis. AUTRE reste le filet de sécurité.
export const INVOICE_TYPES = ["P1", "P2", "P3", "AUTRE"] as const;
export type InvoiceTypeValue = (typeof INVOICE_TYPES)[number];

/**
 * Nature de la facture — doit rester alignée sur l'enum InvoiceNature du
 * schéma. Orthogonale au type : une facture P1 peut être un acompte, un
 * décompte, un avoir ou un intéressement.
 */
export const INVOICE_NATURES = [
  "ACOMPTE",
  "DECOMPTE",
  "AVOIR",
  "INTERESSEMENT",
  "AUTRE",
] as const;
export type InvoiceNatureValue = (typeof INVOICE_NATURES)[number];

/**
 * Sous-types P1 : liste unique de référence, partagée entre le formulaire de
 * saisie (InvoiceModal) et la consigne IA. Voir
 * src/components/financier/constants.ts qui la réexporte côté écran.
 *
 * « Décompte » et « Intéressement » en ont été retirés : ce sont des NATURES
 * de facture, pas des postes P1. Les factures antérieures qui portent encore
 * ces valeurs les gardent telles quelles — rien n'est migré.
 */
export const P1_SUBTYPES = [
  "Combustible",
  "ECS",
  "Location compteur",
  "Abonnement",
  "Autre",
] as const;
export type P1SubType = (typeof P1_SUBTYPES)[number];

/** Une ligne de répartition lue sur la facture : un site, un montant HT. */
export interface ParsedInvoiceLine {
  /** Libellé tel qu'écrit, numéro d'ordre « 13 - » retiré. */
  label: string;
  amountHT: number;
}

export interface ParsedInvoice {
  reference: string | null;
  siteName: string | null;
  siteCity: string | null;
  objet: string | null;
  amountHT: number | null;
  issueDate: string | null; // ISO "YYYY-MM-DD"
  /** Période de prestation facturée, ISO "YYYY-MM-DD". */
  periodStart: string | null;
  periodEnd: string | null;
  invoiceType: InvoiceTypeValue | null;
  /** Nature du document : acompte, décompte, avoir, intéressement. */
  nature: InvoiceNatureValue | null;
  /** Renseigné uniquement quand invoiceType vaut P1. */
  p1SubType: P1SubType | null;
  /** Répartition site par site ; vide quand la facture ne détaille pas. */
  lines: ParsedInvoiceLine[];
}

export function emptyParsedInvoice(): ParsedInvoice {
  return {
    reference: null,
    siteName: null,
    siteCity: null,
    objet: null,
    amountHT: null,
    issueDate: null,
    periodStart: null,
    periodEnd: null,
    invoiceType: null,
    nature: null,
    p1SubType: null,
    lines: [],
  };
}

/**
 * Retire le numéro d'ordre qui préfixe les blocs de la facture (« 13 - Mairie »
 * → « Mairie »). Le numéro change d'une facture à l'autre : le garder ferait
 * rater tous les rapprochements par alias.
 */
export function stripLineOrderPrefix(label: string): string {
  return label.replace(/^\d+\s*[-–]\s*/, "").trim();
}

/**
 * Forme normalisée d'un libellé de facturation, utilisée comme clé d'alias.
 * Doit rester identique entre l'écriture (création/édition d'une facture) et
 * la lecture (rapprochement à l'import), sinon les alias ne servent à rien.
 */
export function normalizeBillingAlias(label: string): string {
  return stripLineOrderPrefix(label)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Écart toléré entre la somme des lignes et le total de la facture. */
export const LINES_TOTAL_TOLERANCE = 0.05;

/** Vrai si la somme des lignes retombe sur le total (ou s'il n'y a pas de ligne). */
export function areLinesConsistent(
  lines: Array<{ amountHT: number }>,
  amountHT: number | null
): boolean {
  if (lines.length === 0) return true;
  if (amountHT === null || !Number.isFinite(amountHT)) return false;
  const sum = lines.reduce((acc, l) => acc + l.amountHT, 0);
  return Math.abs(sum - amountHT) <= LINES_TOTAL_TOLERANCE;
}
