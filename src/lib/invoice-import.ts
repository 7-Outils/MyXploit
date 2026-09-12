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
export const INVOICE_TYPES = ["P1", "P2", "P3", "TRAVAUX", "AUTRE"] as const;
export type InvoiceTypeValue = (typeof INVOICE_TYPES)[number];

/**
 * Sous-types P1 : liste unique de référence, partagée entre le formulaire de
 * saisie (InvoiceModal) et la consigne IA. Voir
 * src/components/financier/constants.ts qui la réexporte côté écran.
 */
export const P1_SUBTYPES = [
  "Combustible",
  "ECS",
  "Location compteur",
  "Abonnement",
  "Décompte",
  "Intéressement",
  "Autre",
] as const;
export type P1SubType = (typeof P1_SUBTYPES)[number];

export interface ParsedInvoice {
  reference: string | null;
  siteName: string | null;
  siteCity: string | null;
  objet: string | null;
  amountHT: number | null;
  issueDate: string | null; // ISO "YYYY-MM-DD"
  invoiceType: InvoiceTypeValue | null;
  /** Renseigné uniquement quand invoiceType vaut P1. */
  p1SubType: P1SubType | null;
}

export function emptyParsedInvoice(): ParsedInvoice {
  return {
    reference: null,
    siteName: null,
    siteCity: null,
    objet: null,
    amountHT: null,
    issueDate: null,
    invoiceType: null,
    p1SubType: null,
  };
}
