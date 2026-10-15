/**
 * Historique des consommations par année civile : une seule valeur par site,
 * énergie et mois, avec priorité de source (télérelève > exploitant > manuel),
 * jamais d'addition de deux sources. Tout en kWh. Fonctions pures.
 */
export interface RawRow {
  siteId: string;
  energyType: string;
  usage: "CHAUFFAGE" | "ECS" | "MIXTE" | "AUTRE";
  source: "TELERELEVE" | "EXPLOITANT" | "MANUAL";
  period: Date;
  quantity: number;
  unit: string;
}

const PCS_DEFAULT = 11.2;

function toKwh(r: RawRow, coefQ: number): number {
  const u = (r.unit || "").toLowerCase().replace("³", "3");
  if (u === "kwh") return r.quantity;
  if (u === "mwh") return r.quantity * 1000;
  if (u === "m3") return r.usage === "ECS" ? r.quantity * coefQ * 1000 : r.energyType === "GAZ" ? r.quantity * PCS_DEFAULT : r.quantity;
  return r.quantity;
}

/** kWh par site et par année civile, source prioritaire par site × énergie × mois. */
export function kwhBySiteYear(rows: RawRow[], coefQBySite: Map<string, number>): Map<string, Map<string, number>> {
  const groups = new Map<string, RawRow[]>();
  for (const r of rows) {
    const k = `${r.siteId}|${r.energyType}|${r.period.getFullYear()}-${r.period.getMonth()}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const out = new Map<string, Map<string, number>>();
  for (const [k, g] of groups) {
    const [siteId, , ym] = k.split("|");
    const year = ym.split("-")[0];
    const q = coefQBySite.get(siteId) ?? 0.13;
    const tele = g.filter((r) => r.source === "TELERELEVE");
    const expl = g.filter((r) => r.source === "EXPLOITANT");
    const src = tele.length ? tele : expl.length ? expl : g;
    const kwh = src.reduce((s, r) => s + toKwh(r, q), 0);
    const bySite = out.get(siteId) ?? out.set(siteId, new Map()).get(siteId)!;
    bySite.set(year, (bySite.get(year) ?? 0) + kwh);
  }
  return out;
}
