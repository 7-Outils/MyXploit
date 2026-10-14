/** Validation d'une ligne de modalités de facturation (API billing-lines). */
const POSTES = ["P1", "P2", "P3", "AUTRE"] as const;
export type BillingPosteValue = (typeof POSTES)[number];

/** Déduit le poste d'un libellé commençant par P1/P2/P3 (« P3 GE » → P3). */
export function posteFromLabel(label: string): BillingPosteValue | null {
  const m = label.trim().toUpperCase().match(/^P([123])\b/);
  return m ? (`P${m[1]}` as BillingPosteValue) : null;
}

export function parseLine(body: Record<string, unknown>) {
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
  if (!label) return { error: "Le libellé est requis" } as const;

  const count = Number(body.countPerYear);
  if (!Number.isInteger(count) || count < 1 || count > 12) return { error: "Le nombre de factures par an doit être entre 1 et 12" } as const;

  let poste: BillingPosteValue | null = null;
  if (body.poste === null || body.poste === "" || body.poste === undefined) poste = posteFromLabel(label);
  else if (POSTES.includes(body.poste as BillingPosteValue)) poste = body.poste as BillingPosteValue;
  else return { error: "Poste invalide" } as const;

  const ints = (v: unknown): number[] | null => (Array.isArray(v) ? v.map((x) => Number(x)) : null);

  let periods: number[] = [];
  const pr = ints(body.periods);
  if (pr && pr.length > 0) {
    if (pr.length !== count * 2) return { error: `Indiquez ${count} périodes (début et fin) ou aucune` } as const;
    if (pr.some((x) => !Number.isInteger(x) || x < 1 || x > 12)) return { error: "Mois invalide (1-12)" } as const;
    periods = pr;
  }

  let percents: number[] = [];
  const pc = ints(body.percents);
  if (pc && pc.length > 0) {
    if (pc.length !== count) return { error: `Indiquez ${count} parts (une par facture) ou aucune` } as const;
    if (pc.some((x) => !Number.isInteger(x) || x < 0 || x > 100)) return { error: "Part invalide (entiers de 0 à 100)" } as const;
    if (pc.reduce((a, b) => a + b, 0) > 100) return { error: "Le total des parts dépasse 100 %" } as const;
    percents = pc;
  }

  const tol = body.toleranceDays == null || body.toleranceDays === "" ? 30 : Number(body.toleranceDays);
  if (!Number.isInteger(tol) || tol < 0 || tol > 365) return { error: "Tolérance invalide (0-365 jours)" } as const;

  return { data: { label, poste, countPerYear: count, periods, percents, toleranceDays: tol } } as const;
}
