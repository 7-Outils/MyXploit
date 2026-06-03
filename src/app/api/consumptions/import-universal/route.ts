import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { MeterFluid } from "@/generated/prisma/client";
import { regenerateConsumptionForSite } from "@/lib/consumption-projector";
import { syncDjuForSites } from "@/lib/dju-sync";

/**
 * Import RELEVÉS exploitant — moteur universel (v2).
 * ---------------------------------------------------
 * Reçoit des lignes DÉJÀ normalisées par le mapper côté navigateur (peu importe
 * la trame d'origine : Idex, Veolia, ...). Aucun parsing de fichier ici.
 *
 * Pipeline : match site (scopé au contrat) → create/find Meter → upsert
 * MeterReading (source de vérité) → regenerateConsumptionForSite (le moteur
 * existant applique le PCS/Q de CHAQUE site depuis son contrat).
 *
 * Body: { contractId, rows: [{ site, date, meter, fluid, index, unit }] }
 */

type IncomingRow = {
  site: string;
  date: string; // ISO
  meter: string;
  fluid: MeterFluid;
  index: number | null;
  unit: string;
};

const DEFAULT_PCS = 10.5; // kWh/m³ (gaz, 20 mbar)
const DEFAULT_Q = 0.12; // MWh/m³ (ECS volumétrique)

function normalizeSiteName(name: string): string {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Similarité (Levenshtein normalisé 0..1) pour suggérer un site aux non-reconnus.
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const m: number[][] = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] =
        b[i - 1] === a[j - 1]
          ? m[i - 1][j - 1]
          : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return 1 - m[b.length][a.length] / maxLen;
}

function bestSuggestion(
  excelName: string,
  sites: { siteId: string; site: { name: string } }[]
): string | null {
  const n = normalizeSiteName(excelName);
  let best: string | null = null;
  let bestScore = 0;
  for (const cs of sites) {
    const s = similarity(n, normalizeSiteName(cs.site.name));
    if (s > bestScore) {
      bestScore = s;
      best = cs.siteId;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

// Coefficient de conversion (affichage du compteur). Le projector recalcule de
// toute façon avec le PCS/Q du site ; on le renseigne pour cohérence d'affichage.
function computeMeterConversion(
  fluid: MeterFluid,
  unit: string,
  sitePcs: number,
  siteQ: number
): { coefficient: number | null; convUnit: string | null } {
  const u = unit.toLowerCase().replace(/\s/g, "");
  const isM3 = u === "m3" || u === "m³";
  if (fluid === "GAZ" && isM3) return { coefficient: sitePcs, convUnit: "kWh" };
  if (fluid === "EAU_CHAUDE" && isM3) return { coefficient: siteQ * 1000, convUnit: "kWh" };
  if (fluid === "FIOUL" && u === "l") return { coefficient: 10, convUnit: "kWh" };
  if (fluid === "ELECTRICITE" && u === "mwh") return { coefficient: 1000, convUnit: "kWh" };
  if (fluid === "CHALEUR" && u === "mwh") return { coefficient: 1000, convUnit: "kWh" };
  return { coefficient: null, convUnit: null };
}

// Crée/Met à jour la période de chauffe (allumage→arrêt) d'un site pour une saison.
// Idempotent : retrouve la période existante dont l'allumage tombe dans la fenêtre
// de saison (juillet→juin) et l'ajuste, sinon en crée une.
async function upsertHeatingPeriod(siteId: string, start: Date, end: Date) {
  const y = start.getMonth() >= 6 ? start.getFullYear() : start.getFullYear() - 1;
  const seasonStart = new Date(Date.UTC(y, 6, 1)); // 1er juillet
  const seasonEnd = new Date(Date.UTC(y + 1, 5, 30)); // 30 juin
  const existing = await prisma.heatingPeriod.findFirst({
    where: { siteId, startDate: { gte: seasonStart, lte: seasonEnd } },
    orderBy: { startDate: "asc" },
    select: { id: true },
  });
  if (existing) {
    await prisma.heatingPeriod.update({
      where: { id: existing.id },
      data: { startDate: start, endDate: end },
    });
  } else {
    await prisma.heatingPeriod.create({
      data: { siteId, startDate: start, endDate: end, notes: "Déduit de l'import exploitant (1er → dernier relevé)" },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    const body = await request.json();
    const contractId: string | undefined = body.contractId;
    const rows: IncomingRow[] = Array.isArray(body.rows) ? body.rows : [];
    // Correspondances manuelles fournies par l'UI : { nomDansFichier: siteId }
    const siteMappings: Record<string, string> =
      body.siteMappings && typeof body.siteMappings === "object" ? body.siteMappings : {};

    if (!contractId) {
      return NextResponse.json({ error: "Contrat cible manquant" }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: "Aucune ligne à importer" }, { status: 400 });
    }

    // Sites du contrat (matching scopé au contrat → évite toute confusion entre clients)
    const contractSites = await prisma.contractSite.findMany({
      where: { contractId },
      select: {
        siteId: true,
        coefficientPCS: true,
        coefficientQ: true,
        site: { select: { id: true, name: true } },
      },
    });

    if (contractSites.length === 0) {
      return NextResponse.json(
        { error: "Ce contrat n'a aucun site. Importez d'abord l'AE." },
        { status: 400 }
      );
    }

    const sitePcs = new Map<string, number>();
    const siteQ = new Map<string, number>();
    const siteIdByName = new Map<string, string>();
    const siteIds = new Set<string>();
    for (const cs of contractSites) {
      sitePcs.set(cs.siteId, cs.coefficientPCS || DEFAULT_PCS);
      siteQ.set(cs.siteId, cs.coefficientQ || DEFAULT_Q);
      siteIdByName.set(normalizeSiteName(cs.site.name), cs.siteId);
      siteIds.add(cs.siteId);
    }

    // Alias persistés (corrections manuelles mémorisées), limités aux sites du contrat
    const aliasRows = await prisma.siteAlias.findMany({
      where: { organizationId: effectiveOrgId, siteId: { in: Array.from(siteIds) } },
      select: { alias: true, siteId: true },
    });
    const aliasMap = new Map<string, string>();
    for (const a of aliasRows) aliasMap.set(normalizeSiteName(a.alias), a.siteId);

    // Correspondances manuelles de cet import (priorité absolue)
    const manualMap = new Map<string, string>();
    for (const [excelName, sid] of Object.entries(siteMappings)) {
      if (siteIds.has(sid)) manualMap.set(normalizeSiteName(excelName), sid);
    }

    // 1) Résolution site + collecte des lignes valides
    type ResolvedRow = {
      siteId: string;
      meter: string;
      fluid: MeterFluid;
      readingDate: Date;
      index: number | null;
      unit: string;
      isReset?: boolean; // index qui repart à zéro = changement de compteur
    };
    const resolved: ResolvedRow[] = [];
    const unmatchedSites = new Map<string, number>(); // nom → nb lignes
    let skipped = 0;

    for (const r of rows) {
      const nk = normalizeSiteName(r.site);
      const siteId = manualMap.get(nk) ?? aliasMap.get(nk) ?? siteIdByName.get(nk);
      if (!siteId) {
        unmatchedSites.set(r.site, (unmatchedSites.get(r.site) ?? 0) + 1);
        continue;
      }
      const d = new Date(r.date);
      if (!r.meter || isNaN(d.getTime()) || r.index == null) {
        skipped++;
        continue;
      }
      resolved.push({
        siteId,
        meter: String(r.meter).trim(),
        fluid: r.fluid,
        readingDate: d,
        index: r.index,
        unit: r.unit || "m³",
      });
    }

    // 1b) Détection des changements de compteur : si l'index BAISSE entre deux
    //     relevés successifs d'un même compteur, le nouveau relevé est une
    //     nouvelle baseline → isReset=true (le moteur ne calculera pas le delta
    //     négatif aberrant avec l'ancien index). Sinon : conso fantôme énorme.
    let resetsDetected = 0;
    {
      const byMeter = new Map<string, ResolvedRow[]>();
      for (const row of resolved) {
        const k = `${row.siteId}|${row.meter}`;
        if (!byMeter.has(k)) byMeter.set(k, []);
        byMeter.get(k)!.push(row);
      }
      for (const list of byMeter.values()) {
        list.sort((a, b) => a.readingDate.getTime() - b.readingDate.getTime());
        let prevIndex: number | null = null;
        for (const r of list) {
          if (r.index != null && prevIndex != null && r.index < prevIndex) {
            r.isReset = true;
            resetsDetected++;
          }
          if (r.index != null) prevIndex = r.index;
        }
      }
    }

    // 2) Création / récupération des compteurs (clé siteId|meter)
    const meterIdByKey = new Map<string, string>();
    const uniqueMeters = new Map<string, ResolvedRow>();
    for (const row of resolved) {
      const key = `${row.siteId}|${row.meter}`;
      if (!uniqueMeters.has(key)) uniqueMeters.set(key, row);
    }

    let metersCreated = 0;
    for (const m of uniqueMeters.values()) {
      const existing = await prisma.meter.findFirst({
        where: { siteId: m.siteId, name: m.meter },
        select: { id: true, conversionCoefficient: true },
      });
      const { coefficient, convUnit } = computeMeterConversion(
        m.fluid,
        m.unit,
        sitePcs.get(m.siteId) ?? DEFAULT_PCS,
        siteQ.get(m.siteId) ?? DEFAULT_Q
      );
      if (existing) {
        meterIdByKey.set(`${m.siteId}|${m.meter}`, existing.id);
        if (coefficient != null && existing.conversionCoefficient == null) {
          await prisma.meter.update({
            where: { id: existing.id },
            data: { conversionCoefficient: coefficient, conversionUnit: convUnit },
          });
        }
      } else {
        const created = await prisma.meter.create({
          data: {
            siteId: m.siteId,
            name: m.meter,
            fluid: m.fluid,
            type: "DIVISIONNAIRE",
            dataSource: "MANUEL",
            unit: m.unit,
            conversionCoefficient: coefficient,
            conversionUnit: convUnit,
            isActive: true,
          },
          select: { id: true },
        });
        meterIdByKey.set(`${m.siteId}|${m.meter}`, created.id);
        metersCreated++;
      }
    }

    // 3) Upsert MeterReading (source de vérité) + sites impactés
    const impactedSites = new Set<string>();
    let imported = 0;
    let updated = 0;
    for (const row of resolved) {
      const meterId = meterIdByKey.get(`${row.siteId}|${row.meter}`);
      if (!meterId) {
        skipped++;
        continue;
      }
      const existing = await prisma.meterReading.findFirst({
        where: { meterId, readingDate: row.readingDate },
        select: { id: true },
      });
      if (existing) {
        await prisma.meterReading.update({
          where: { id: existing.id },
          data: { indexValue: row.index, unit: row.unit, isReset: row.isReset ?? false, notes: "Import exploitant (universel)" },
        });
        updated++;
      } else {
        await prisma.meterReading.create({
          data: {
            meterId,
            readingDate: row.readingDate,
            indexValue: row.index,
            unit: row.unit,
            isReset: row.isReset ?? false,
            source: "MANUEL",
            notes: "Import exploitant (universel)",
          },
        });
        imported++;
      }
      impactedSites.add(row.siteId);
    }

    // 4) Régénération des consommations (le moteur applique le PCS/Q par site)
    for (const siteId of impactedSites) {
      try {
        await regenerateConsumptionForSite(siteId, effectiveOrgId);
      } catch (err) {
        console.error(`[import-universal] regen conso site ${siteId}:`, err);
      }
    }

    // 4b) Période de chauffe (allumage → arrêt) déduite des relevés, par site et
    //     par saison (juillet→juin). C'EST elle qui fait sortir le DJR : l'analytics
    //     somme les DJU météo uniquement sur les jours de chauffe (HeatingPeriod).
    //     Hypothèse : le fichier couvre la saison → allumage = 1er relevé de chauffage,
    //     arrêt = dernier. (Les compteurs ECS/eau sont exclus de ce calcul.)
    let heatingPeriods = 0;
    const seasonRanges = new Map<string, { siteId: string; start: Date; end: Date }>();
    for (const row of resolved) {
      if (row.fluid === "EAU_CHAUDE" || row.fluid === "EAU_FROIDE") continue; // pas l'ECS/eau
      const y = row.readingDate.getMonth() >= 6 ? row.readingDate.getFullYear() : row.readingDate.getFullYear() - 1;
      const key = `${row.siteId}|${y}`;
      const ex = seasonRanges.get(key);
      if (!ex) {
        seasonRanges.set(key, { siteId: row.siteId, start: row.readingDate, end: row.readingDate });
      } else {
        if (row.readingDate < ex.start) ex.start = row.readingDate;
        if (row.readingDate > ex.end) ex.end = row.readingDate;
      }
    }
    for (const r of seasonRanges.values()) {
      if (r.end > r.start) {
        try {
          await upsertHeatingPeriod(r.siteId, r.start, r.end);
          heatingPeriods++;
        } catch (err) {
          console.error(`[import-universal] heating period site ${r.siteId}:`, err);
        }
      }
    }

    // 5) Synchro DJU : écrit Consumption.djuReel (utilisé par la fiche site / profil
    //    thermique / conso mensuelle). NB : ce n'est PAS ce qui alimente le DJR du
    //    tableau de perf (lui le recalcule depuis la météo sur les périodes de chauffe).
    let djuUpdated = 0;
    if (impactedSites.size > 0) {
      try {
        const r = await syncDjuForSites(Array.from(impactedSites), effectiveOrgId, false);
        djuUpdated = r.updated;
      } catch (err) {
        console.error("[import-universal] DJU sync:", err);
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped,
      metersCreated,
      sitesImpacted: impactedSites.size,
      djuUpdated,
      resetsDetected,
      heatingPeriods,
      unmatchedSites: Array.from(unmatchedSites.entries()).map(([name, count]) => ({
        name,
        count,
        suggestionId: bestSuggestion(name, contractSites),
      })),
      // Sites du contrat — pour alimenter les menus de correspondance manuelle côté UI
      contractSites: contractSites.map((cs) => ({ id: cs.siteId, name: cs.site.name })),
    });
  } catch (error) {
    console.error("[import-universal] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur import" },
      { status: 500 }
    );
  }
}
