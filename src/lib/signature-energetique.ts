/**
 * Signature énergétique — calibration d'une cible NB par régression linéaire.
 *
 * Méthode :
 *   1. Régression NC = a·DJR + b sur toutes les saisons dispo (min 3)
 *   2. Si R² < 0,85 → on tente de retirer le pire résidu (outlier auto)
 *   3. Si R² reste < 0,6 → signature instable, pas calibrable
 *   4. Sinon : détection de tendance (haussière ou baissière) via Pearson
 *      entre index de saison et résidu. Si |ρ| > 0,6 → refit sur les
 *      3 dernières saisons uniquement (le site a changé de régime)
 *   5. NB_ref = a·DJC + b
 */

export interface SeasonPoint {
  year: number;         // saison (ex 2024 = 2023-2024)
  nc: number;           // conso chauffage en kWh
  djr: number;          // DJU réels cumulés sur la saison
  djc: number;          // DJU contractuels (même pour toutes les saisons du site)
  currentNb: number;    // cible NB actuelle en MWh
  siteName: string;
}

export type Verdict =
  | { kind: "insufficient"; count: number }
  | { kind: "unstable"; r2: number; usedPoints: SeasonPoint[] }
  | {
      kind: "calibrated";
      slope: number;           // a (kWh/DJU)
      intercept: number;       // b (kWh fixe)
      r2: number;
      nbRefMwh: number;        // cible théorique selon signature, en MWh
      deltaMwh: number;        // currentNb - nbRef (positif = cible trop lâche)
      deltaPct: number;        // delta relatif à nbRef
      severity: "OK" | "LACHE" | "SERREE";
      method: string;          // texte résumant la méthode employée
      usedPoints: SeasonPoint[];
      excludedPoints: SeasonPoint[];
    };

// ─── Primitives statistiques ──────────────────────────────────────

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function linearRegression(points: SeasonPoint[]): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  const xs = points.map((p) => p.djr);
  const ys = points.map((p) => p.nc);
  const xMean = mean(xs);
  const yMean = mean(ys);

  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }

  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = yMean - slope * xMean;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);

  return { slope, intercept, r2 };
}

// Pearson correlation entre index de saison (0..n-1) et résidus de la régression
function trendCorrelation(points: SeasonPoint[], slope: number, intercept: number): number {
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const indices = sorted.map((_, i) => i);
  const residuals = sorted.map((p) => p.nc - (slope * p.djr + intercept));

  const iMean = mean(indices);
  const rMean = mean(residuals);
  let num = 0, dI = 0, dR = 0;
  for (let i = 0; i < sorted.length; i++) {
    const dx = indices[i] - iMean;
    const dy = residuals[i] - rMean;
    num += dx * dy;
    dI += dx * dx;
    dR += dy * dy;
  }
  const denom = Math.sqrt(dI * dR);
  return denom === 0 ? 0 : num / denom;
}

// ─── Diagnostic principal ─────────────────────────────────────────

const MIN_SEASONS = 3;
const R2_STABLE = 0.85;
const R2_UNSTABLE = 0.6;
const TREND_THRESHOLD = 0.6;
const TOLERANCE_PCT = 10; // ±10 % avant de flagger

export function diagnose(points: SeasonPoint[]): Verdict {
  if (points.length < MIN_SEASONS) {
    return { kind: "insufficient", count: points.length };
  }

  // Step 1 : régression globale (baseline + source des résidus)
  const globalFit = linearRegression(points);

  // Step 2 : détection de tendance AVANT exclusion d'outlier.
  // Sinon un site en tendance baissière voit sa saison la plus récente virée
  // comme "aberrante" alors que c'est la plus représentative de la perf actuelle.
  const rhoGlobal = trendCorrelation(points, globalFit.slope, globalFit.intercept);
  if (Math.abs(rhoGlobal) > TREND_THRESHOLD && points.length > 3) {
    const sorted = [...points].sort((a, b) => a.year - b.year);
    const recent = sorted.slice(-3);
    const recentFit = linearRegression(recent);
    if (recentFit.r2 >= R2_UNSTABLE) {
      const skipped = sorted.slice(0, -3);
      const label = rhoGlobal > 0 ? "haussière" : "baissière";
      return buildCalibrated(
        points,
        recent,
        skipped,
        recentFit,
        `Tendance ${label} détectée (ρ=${rhoGlobal.toFixed(2)}) → régression sur les 3 dernières saisons`
      );
    }
  }

  // Step 3 : pas de tendance claire. Si R² global faible, tenter l'outlier.
  let fit = globalFit;
  let excluded: SeasonPoint[] = [];
  let used = [...points];
  let method = `Régression linéaire sur ${points.length} saisons`;

  if (fit.r2 < R2_STABLE && points.length >= MIN_SEASONS + 1) {
    const residuals = points.map((p) => ({
      p,
      residual: Math.abs(p.nc - (fit.slope * p.djr + fit.intercept)),
    }));
    residuals.sort((a, b) => b.residual - a.residual);
    const worst = residuals[0].p;
    const filtered = points.filter((p) => p !== worst);
    const refit = linearRegression(filtered);
    if (refit.r2 > fit.r2 + 0.1 && refit.r2 >= R2_UNSTABLE) {
      fit = refit;
      used = filtered;
      excluded = [worst];
      method = `Régression après exclusion de la saison ${worst.year - 1}-${worst.year} (aberrante)`;
    }
  }

  if (fit.r2 < R2_UNSTABLE) {
    return { kind: "unstable", r2: fit.r2, usedPoints: used };
  }

  return buildCalibrated(points, used, excluded, fit, method);
}

// Construit un verdict calibrated à partir d'un jeu de points retenus et d'un fit.
// Partagé entre le mode auto (diagnose) et le mode manuel (diagnoseManual).
export function buildCalibrated(
  allPoints: SeasonPoint[],
  used: SeasonPoint[],
  excluded: SeasonPoint[],
  fit: { slope: number; intercept: number; r2: number },
  method: string
): Verdict {
  const djc = allPoints[0].djc;
  const nbRefKwh = fit.slope * djc + fit.intercept;
  const nbRefMwh = nbRefKwh / 1000;
  const currentNbMwh = allPoints[0].currentNb;
  const deltaMwh = currentNbMwh - nbRefMwh;
  const deltaPct = nbRefMwh > 0 ? (deltaMwh / nbRefMwh) * 100 : 0;

  let severity: "OK" | "LACHE" | "SERREE";
  if (deltaPct > TOLERANCE_PCT) severity = "LACHE";
  else if (deltaPct < -TOLERANCE_PCT) severity = "SERREE";
  else severity = "OK";

  return {
    kind: "calibrated",
    slope: fit.slope,
    intercept: fit.intercept,
    r2: fit.r2,
    nbRefMwh,
    deltaMwh,
    deltaPct,
    severity,
    method: `${method} — R²=${fit.r2.toFixed(2)}`,
    usedPoints: used,
    excludedPoints: excluded,
  };
}

// Mode custom : l'utilisateur sélectionne manuellement les saisons à inclure.
export function diagnoseManual(allPoints: SeasonPoint[], used: SeasonPoint[]): Verdict {
  if (used.length < MIN_SEASONS) {
    return { kind: "insufficient", count: used.length };
  }
  const fit = linearRegression(used);
  if (fit.r2 < R2_UNSTABLE) {
    return { kind: "unstable", r2: fit.r2, usedPoints: used };
  }
  const excluded = allPoints.filter((p) => !used.includes(p));
  return buildCalibrated(
    allPoints, used, excluded, fit,
    `Sélection manuelle — ${used.length} saison${used.length > 1 ? "s" : ""} retenue${used.length > 1 ? "s" : ""}`
  );
}
