import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { MeterFluid } from "@/generated/prisma/client";
import { regenerateConsumptionForSite } from "@/lib/consumption-projector";

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

// Allumage : ouvre une période de chauffe (endDate=null) à la date donnée.
// Idempotent : ne recrée pas si une période démarre déjà exactement à cette date.
// NON destructif : ne touche jamais une période existante.
async function openHeatingPeriod(siteId: string, date: Date): Promise<boolean> {
  const existing = await prisma.heatingPeriod.findFirst({
    where: { siteId, startDate: date },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.heatingPeriod.create({
    data: { siteId, startDate: date, endDate: null, notes: "Allumage (import exploitant)" },
  });
  return true;
}

// Arrêt : clôture la période ouverte la plus récente (endDate=null) du site.
async function closeHeatingPeriod(siteId: string, date: Date): Promise<boolean> {
  const open = await prisma.heatingPeriod.findFirst({
    where: { siteId, endDate: null },
    orderBy: { startDate: "desc" },
    select: { id: true, startDate: true },
  });
  if (open && open.startDate <= date) {
    await prisma.heatingPeriod.update({ where: { id: open.id }, data: { endDate: date } });
    return true;
  }
  return false;
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
    // Type d'import (comme l'ancien) : par défaut RELEVE_MENSUEL = ne touche pas aux dates.
    const importType: string = ["ALLUMAGE", "ARRET", "RELEVE_MENSUEL"].includes(body.importType)
      ? body.importType
      : "RELEVE_MENSUEL";
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

    // Écritures BATCHÉES (sinon ~2 requêtes/relevé en série → timeout sur gros fichiers).
    // Compteurs : 1 fetch groupé → createMany des manquants → refetch des ids.
    let metersCreated = 0;
    const existingMeters = await prisma.meter.findMany({
      where: { siteId: { in: Array.from(siteIds) } },
      select: { id: true, siteId: true, name: true, conversionCoefficient: true },
    });
    const meterByKey = new Map<string, { id: string; conversionCoefficient: number | null }>();
    for (const em of existingMeters) meterByKey.set(`${em.siteId}|${em.name}`, em);

    const metersToCreate: Array<Record<string, unknown>> = [];
    const coefBackfill: Array<{ id: string; coefficient: number; convUnit: string | null }> = [];
    for (const m of uniqueMeters.values()) {
      const key = `${m.siteId}|${m.meter}`;
      const { coefficient, convUnit } = computeMeterConversion(
        m.fluid,
        m.unit,
        sitePcs.get(m.siteId) ?? DEFAULT_PCS,
        siteQ.get(m.siteId) ?? DEFAULT_Q
      );
      const ex = meterByKey.get(key);
      if (ex) {
        meterIdByKey.set(key, ex.id);
        if (coefficient != null && ex.conversionCoefficient == null) {
          coefBackfill.push({ id: ex.id, coefficient, convUnit });
        }
      } else {
        metersToCreate.push({
          siteId: m.siteId,
          name: m.meter,
          fluid: m.fluid,
          type: "DIVISIONNAIRE",
          dataSource: "MANUEL",
          unit: m.unit,
          conversionCoefficient: coefficient,
          conversionUnit: convUnit,
          isActive: true,
        });
      }
    }
    if (metersToCreate.length > 0) {
      await prisma.meter.createMany({ data: metersToCreate as never });
      metersCreated = metersToCreate.length;
      const refetched = await prisma.meter.findMany({
        where: { siteId: { in: Array.from(siteIds) } },
        select: { id: true, siteId: true, name: true },
      });
      for (const em of refetched) meterIdByKey.set(`${em.siteId}|${em.name}`, em.id);
    }
    await Promise.all(
      coefBackfill.map((b) =>
        prisma.meter.update({
          where: { id: b.id },
          data: { conversionCoefficient: b.coefficient, conversionUnit: b.convUnit },
        })
      )
    );

    // 3) MeterReading : 1 fetch groupé → createMany (nouveaux) → update (modifiés seulement)
    const impactedSites = new Set<string>();
    const allMeterIds = Array.from(new Set(Array.from(meterIdByKey.values())));
    const existingReadings = await prisma.meterReading.findMany({
      where: { meterId: { in: allMeterIds } },
      select: { id: true, meterId: true, readingDate: true, indexValue: true, isReset: true },
    });
    const readingByKey = new Map<string, { id: string; indexValue: number | null; isReset: boolean }>();
    for (const er of existingReadings) {
      readingByKey.set(`${er.meterId}|${er.readingDate.getTime()}`, er);
    }

    const readingsToCreate: Array<Record<string, unknown>> = [];
    const readingsToUpdate: Array<{ id: string; index: number | null; isReset: boolean; unit: string }> = [];
    for (const row of resolved) {
      const meterId = meterIdByKey.get(`${row.siteId}|${row.meter}`);
      if (!meterId) {
        skipped++;
        continue;
      }
      impactedSites.add(row.siteId);
      const isReset = row.isReset ?? false;
      const ex = readingByKey.get(`${meterId}|${row.readingDate.getTime()}`);
      if (ex) {
        if (ex.indexValue !== row.index || ex.isReset !== isReset) {
          readingsToUpdate.push({ id: ex.id, index: row.index, isReset, unit: row.unit });
        }
      } else {
        readingsToCreate.push({
          meterId,
          readingDate: row.readingDate,
          indexValue: row.index,
          unit: row.unit,
          isReset,
          source: "MANUEL",
          notes: "Import exploitant (universel)",
        });
      }
    }
    if (readingsToCreate.length > 0) {
      await prisma.meterReading.createMany({ data: readingsToCreate as never });
    }
    const CHUNK = 25;
    for (let i = 0; i < readingsToUpdate.length; i += CHUNK) {
      await Promise.all(
        readingsToUpdate.slice(i, i + CHUNK).map((u) =>
          prisma.meterReading.update({
            where: { id: u.id },
            data: { indexValue: u.index, isReset: u.isReset, unit: u.unit, notes: "Import exploitant (universel)" },
          })
        )
      );
    }
    const imported = readingsToCreate.length;
    const updated = readingsToUpdate.length;

    // 4) Régénération des consommations (le moteur applique le PCS/Q par site).
    //    Parallélisée par petits lots pour ne pas saturer le pool de connexions.
    {
      const siteList = Array.from(impactedSites);
      const RCHUNK = 4;
      for (let i = 0; i < siteList.length; i += RCHUNK) {
        await Promise.all(
          siteList.slice(i, i + RCHUNK).map((siteId) =>
            regenerateConsumptionForSite(siteId, effectiveOrgId).catch((err) =>
              console.error(`[import-universal] regen conso site ${siteId}:`, err)
            )
          )
        );
      }
    }

    // 4b) Dates de saison selon le TYPE d'import (comme l'ancien import) :
    //     - RELEVE_MENSUEL (défaut) : ne touche JAMAIS aux dates (conso seulement).
    //     - ALLUMAGE : ouvre une période de chauffe à la date du 1er relevé du site.
    //     - ARRET    : clôture la période ouverte à la date du dernier relevé du site.
    //     C'est la période de chauffe (HeatingPeriod) qui fait sortir le DJR du Synthèse.
    //     Les compteurs ECS/eau sont exclus du calcul des bornes.
    let heatingPeriods = 0;
    if (importType === "ALLUMAGE" || importType === "ARRET") {
      const rangeBySite = new Map<string, { start: Date; end: Date }>();
      for (const row of resolved) {
        if (row.fluid === "EAU_CHAUDE" || row.fluid === "EAU_FROIDE") continue;
        const ex = rangeBySite.get(row.siteId);
        if (!ex) rangeBySite.set(row.siteId, { start: row.readingDate, end: row.readingDate });
        else {
          if (row.readingDate < ex.start) ex.start = row.readingDate;
          if (row.readingDate > ex.end) ex.end = row.readingDate;
        }
      }
      for (const [siteId, r] of rangeBySite) {
        try {
          const done =
            importType === "ALLUMAGE"
              ? await openHeatingPeriod(siteId, r.start)
              : await closeHeatingPeriod(siteId, r.end);
          if (done) heatingPeriods++;
        } catch (err) {
          console.error(`[import-universal] heating period site ${siteId}:`, err);
        }
      }
    }

    // Pas de synchro DJU ici : le DJR du tableau de perf est recalculé en direct
    // depuis la météo sur les périodes de chauffe. Consumption.djuReel (vues
    // secondaires : profil thermique / conso mensuelle) se remplit à la demande
    // via la synchro DJU manuelle si besoin.

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped,
      metersCreated,
      sitesImpacted: impactedSites.size,
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
