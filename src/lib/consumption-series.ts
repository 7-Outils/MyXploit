/**
 * Série mensuelle de consommation : une seule série par site × énergie × mois,
 * avec une priorité de source (télérelève > exploitant > manuel) pour ne jamais
 * additionner deux sources. Fonctions pures, sans accès base.
 *
 * Toutes les quantités sont ramenées en kWh :
 *  - gaz en m³ → × PCS (11,2 par défaut) ; ECS en m³ → × Q (MWh/m³) × 1000.
 */

export interface RawRow {
  siteId: string;
  energyType: string;
  usage: "CHAUFFAGE" | "ECS" | "MIXTE" | "AUTRE";
  source: "TELERELEVE" | "EXPLOITANT" | "MANUAL";
  period: Date;
  quantity: number;
  unit: string;
  cost: number | null;
  quantityEcs: number | null;
  quantityChauffage: number | null;
}

export interface MonthPoint {
  month: string; // YYYY-MM
  total: number; // kWh
  chauffage: number;
  ecs: number;
  cost: number;
}

const PCS_DEFAULT = 11.2;

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function toKwh(r: RawRow, coefQ: number): number {
  const u = (r.unit || "").toLowerCase().replace("³", "3");
  if (u === "kwh") return r.quantity;
  if (u === "mwh") return r.quantity * 1000;
  if (u === "m3") return r.usage === "ECS" ? r.quantity * coefQ * 1000 : r.energyType === "GAZ" ? r.quantity * PCS_DEFAULT : r.quantity;
  return r.quantity;
}

/**
 * Agrège des lignes brutes en points mensuels pour un ensemble de sites.
 * `coefQBySite` : coefficient Q (MWh/m³) par site pour convertir l'ECS en m³.
 */
export function aggregateMonths(rows: RawRow[], coefQBySite: Map<string, number>): MonthPoint[] {
  // 1. regrouper par site × énergie × mois
  const groups = new Map<string, RawRow[]>();
  for (const r of rows) {
    const k = `${r.siteId}|${r.energyType}|${monthKey(r.period)}`;
    const g = groups.get(k) ?? [];
    g.push(r);
    groups.set(k, g);
  }
  const out = new Map<string, MonthPoint>();
  const bump = (m: string, total: number, chauffage: number, ecs: number, cost: number) => {
    const p = out.get(m) ?? { month: m, total: 0, chauffage: 0, ecs: 0, cost: 0 };
    p.total += total;
    p.chauffage += chauffage;
    p.ecs += ecs;
    p.cost += cost;
    out.set(m, p);
  };

  for (const [k, g] of groups) {
    const [siteId, , m] = k.split("|");
    const q = coefQBySite.get(siteId) ?? 0.13;
    const kwh = (r: RawRow) => toKwh(r, q);
    const tele = g.filter((r) => r.source === "TELERELEVE");
    const expl = g.filter((r) => r.source === "EXPLOITANT");
    const manual = g.filter((r) => r.source === "MANUAL");
    const cost = g.reduce((s, r) => s + (r.cost ?? 0), 0);

    if (tele.length > 0) {
      // Télérelève = total de l'énergie ; l'ECS vient des relevés exploitant/manuels s'ils existent
      const total = tele.reduce((s, r) => s + kwh(r), 0);
      const ecsRows = [...expl, ...manual].filter((r) => r.usage === "ECS");
      const ecs = Math.min(total, ecsRows.reduce((s, r) => s + kwh(r), 0));
      bump(m, total, total - ecs, ecs, cost);
      continue;
    }
    const src = expl.length > 0 ? expl : manual;
    let total = 0, chauffage = 0, ecs = 0;
    for (const r of src) {
      const v = kwh(r);
      total += v;
      if (r.usage === "ECS") ecs += v;
      else if (r.usage === "CHAUFFAGE") chauffage += v;
      else if (r.usage === "MIXTE") {
        const e = r.quantityEcs ?? 0;
        const c = r.quantityChauffage ?? (v - e);
        ecs += e;
        chauffage += c;
      } else chauffage += v; // AUTRE : compté hors ECS
    }
    bump(m, total, chauffage, ecs, cost);
  }
  return Array.from(out.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/** Liste des mois YYYY-MM de `from` à `to` inclus (bornes au mois). */
export function monthsBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (d <= end) {
    out.push(monthKey(d));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

export function sumPoints(points: MonthPoint[]): Omit<MonthPoint, "month"> {
  return points.reduce(
    (s, p) => ({ total: s.total + p.total, chauffage: s.chauffage + p.chauffage, ecs: s.ecs + p.ecs, cost: s.cost + p.cost }),
    { total: 0, chauffage: 0, ecs: 0, cost: 0 }
  );
}
