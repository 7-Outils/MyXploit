/** Validation d'une ligne d'échéancier de facturation (API billing-lines). */
const POSTES = ["P1", "P2", "P3", "INTERESSEMENT", "AUTRE"] as const;
const NATURES = ["ACOMPTE_FORFAIT", "REEL", "DECOMPTE"] as const;
const RHYTHMS = ["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"] as const;

export function parseLine(body: Record<string, unknown>) {
  const poste = body.poste as (typeof POSTES)[number];
  const nature = body.nature as (typeof NATURES)[number];
  const rhythm = body.rhythm as (typeof RHYTHMS)[number];
  if (!POSTES.includes(poste)) return { error: "Poste invalide" };
  if (!NATURES.includes(nature)) return { error: "Nature invalide" };
  if (!RHYTHMS.includes(rhythm)) return { error: "Rythme invalide" };
  const em = body.expectedMonth == null || body.expectedMonth === "" ? null : Number(body.expectedMonth);
  if (em !== null && (!Number.isInteger(em) || em < 1 || em > 12)) return { error: "Mois attendu invalide (1-12)" };
  const tol = body.toleranceDays == null || body.toleranceDays === "" ? 30 : Number(body.toleranceDays);
  if (!Number.isInteger(tol) || tol < 0 || tol > 365) return { error: "Tolérance invalide (0-365 jours)" };
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 120) : null;
  const periods = { MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1 }[rhythm];
  let splitPercents: number[] = [];
  if (Array.isArray(body.splitPercents) && body.splitPercents.length > 0) {
    splitPercents = body.splitPercents.map((v) => Number(v));
    if (splitPercents.length !== periods) return { error: `La répartition doit avoir ${periods} valeurs` };
    if (splitPercents.some((v) => !Number.isInteger(v) || v < 0 || v > 100)) return { error: "Répartition invalide (entiers de 0 à 100)" };
    if (splitPercents.reduce((a, b) => a + b, 0) !== 100) return { error: "La répartition doit totaliser 100 %" };
    if (splitPercents.every((v) => v === splitPercents[0])) splitPercents = []; // parts égales = pas besoin de stocker
  }
  return { data: { poste, nature, rhythm, expectedMonth: rhythm === "ANNUEL" ? em : null, toleranceDays: tol, label, splitPercents } };
}
