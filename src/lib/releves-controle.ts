/**
 * Contrôle des relevés : confronte, relevé par relevé, la consommation
 * transmise par l'exploitant à la télérelève (GRDF / Enedis) sur exactement
 * les mêmes dates, et qualifie l'écart.
 *
 * Fonctions pures, sans accès base, pour être testables et réutilisées
 * (page outil, alertes plus tard).
 */

export type Diagnostic =
  | "ok" // écart dans la tolérance
  | "a_verifier" // écart au-delà du seuil, relevé isolé
  | "compteur_recule" // consommation exploitant négative : compteur remplacé ou remis à zéro
  | "compteur_remplace" // un remplacement de compteur est enregistré sur la période
  | "unite" // rapport ≈ 10-11 : confusion m³ / kWh ou PCS appliqué deux fois
  | "releve_manquant" // exploitant à zéro alors que la télérelève consomme
  | "telereleve_incomplete" // la télérelève ne couvre pas assez la période du relevé
  | "coefficient"; // écart faible mais toujours du même signe : coefficient / PCS différent

export const DIAGNOSTIC_LABELS: Record<Diagnostic, string> = {
  ok: "Conforme",
  a_verifier: "À vérifier",
  compteur_recule: "Compteur recule",
  compteur_remplace: "Compteur remplacé",
  unite: "Unité ou PCS",
  releve_manquant: "Relevé manquant",
  telereleve_incomplete: "Télérelève incomplète",
  coefficient: "Coefficient",
};

export interface ExploitantReading {
  start: Date;
  end: Date; // inclus
  quantity: number;
  unit: string;
}

export interface TelereleveRow {
  start: Date;
  end: Date; // inclus
  quantity: number;
}

export interface ControlRow {
  start: string;
  end: string;
  days: number;
  exploitant: number;
  telereleve: number;
  coverage: number; // part des jours du relevé couverts par la télérelève (0-1)
  ecart: number; // exploitant − télérelève
  ecartPct: number | null; // relatif à la télérelève
  diagnostic: Diagnostic;
}

export interface ControlSummary {
  readings: number;
  compared: number; // relevés avec télérelève suffisante
  anomalies: number;
  totalExploitant: number;
  totalTelereleve: number;
  totalEcartPct: number | null;
}

const DAY = 86_400_000;
export const ECART_SEUIL_PCT = 5;
export const COUVERTURE_MIN = 0.9;

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a: Date, b: Date) => Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / DAY) + 1;

/** Part d'une ligne de télérelève qui tombe dans [start, end], au prorata des jours. */
function overlapShare(row: TelereleveRow, start: Date, end: Date): { share: number; days: number } {
  const s = Math.max(dayStart(row.start).getTime(), dayStart(start).getTime());
  const e = Math.min(dayStart(row.end).getTime(), dayStart(end).getTime());
  if (e < s) return { share: 0, days: 0 };
  const days = Math.round((e - s) / DAY) + 1;
  const rowDays = daysBetween(row.start, row.end);
  return { share: rowDays > 0 ? days / rowDays : 0, days };
}

export function diagnose(exploitant: number, telereleve: number, coverage: number, resetInPeriod: boolean): Diagnostic {
  if (resetInPeriod) return "compteur_remplace";
  if (exploitant < 0) return "compteur_recule";
  if (coverage < COUVERTURE_MIN) return "telereleve_incomplete";
  if (telereleve <= 0) return exploitant > 0 ? "telereleve_incomplete" : "ok";
  if (exploitant === 0) return "releve_manquant";
  const r = exploitant / telereleve;
  if ((r >= 9 && r <= 13) || (r >= 1 / 13 && r <= 1 / 9)) return "unite";
  const pct = Math.abs((exploitant - telereleve) / telereleve) * 100;
  return pct > ECART_SEUIL_PCT ? "a_verifier" : "ok";
}

/**
 * Pour chaque relevé exploitant, somme la télérelève sur ses dates exactes.
 * `resets` : dates de remplacement de compteur connues (relevés marqués isReset).
 */
export function controlReadings(readings: ExploitantReading[], telereleve: TelereleveRow[], resets: Date[] = []): ControlRow[] {
  const sorted = [...readings].sort((a, b) => a.start.getTime() - b.start.getTime());
  const rows: ControlRow[] = sorted.map((r) => {
    let sum = 0;
    let covered = 0;
    for (const t of telereleve) {
      const { share, days } = overlapShare(t, r.start, r.end);
      if (share > 0) {
        sum += t.quantity * share;
        covered += days;
      }
    }
    const days = daysBetween(r.start, r.end);
    const coverage = days > 0 ? Math.min(1, covered / days) : 0;
    const resetInPeriod = resets.some((d) => dayStart(d) >= dayStart(r.start) && dayStart(d) <= dayStart(r.end));
    const telereleveQ = Math.round(sum);
    const ecart = Math.round(r.quantity - telereleveQ);
    const ecartPct = telereleveQ > 0 ? Math.round(((r.quantity - telereleveQ) / telereleveQ) * 1000) / 10 : null;
    return {
      start: r.start.toISOString(),
      end: r.end.toISOString(),
      days,
      exploitant: Math.round(r.quantity),
      telereleve: telereleveQ,
      coverage: Math.round(coverage * 100) / 100,
      ecart,
      ecartPct,
      diagnostic: diagnose(r.quantity, telereleveQ, coverage, resetInPeriod),
    };
  });

  // Dérive systématique : au moins 3 relevés comparables, écarts tous du même signe, faibles mais réels
  const comparable = rows.filter((x) => x.ecartPct !== null && (x.diagnostic === "ok" || x.diagnostic === "a_verifier"));
  if (comparable.length >= 3) {
    const pcts = comparable.map((x) => x.ecartPct as number);
    const sameSign = pcts.every((p) => p > 0) || pcts.every((p) => p < 0);
    const mean = pcts.reduce((a, b) => a + Math.abs(b), 0) / pcts.length;
    if (sameSign && mean >= 1 && mean <= 15) {
      for (const x of comparable) if (x.diagnostic === "ok") x.diagnostic = "coefficient";
    }
  }
  return rows;
}

export function summarize(rows: ControlRow[]): ControlSummary {
  const compared = rows.filter((r) => r.coverage >= COUVERTURE_MIN && r.diagnostic !== "telereleve_incomplete");
  const totalExploitant = compared.reduce((s, r) => s + r.exploitant, 0);
  const totalTelereleve = compared.reduce((s, r) => s + r.telereleve, 0);
  return {
    readings: rows.length,
    compared: compared.length,
    anomalies: rows.filter((r) => r.diagnostic !== "ok").length,
    totalExploitant,
    totalTelereleve,
    totalEcartPct: totalTelereleve > 0 ? Math.round(((totalExploitant - totalTelereleve) / totalTelereleve) * 1000) / 10 : null,
  };
}
