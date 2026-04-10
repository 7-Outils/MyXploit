import prisma from "@/lib/prisma";
import {
  getGRDFAccessToken,
  getGRDFConsosInformatives,
  getGRDFDroitsAcces,
  GRDFEnvironment,
} from "@/lib/grdf";

/**
 * Parse le refreshToken stocké en DB pour extraire env + credentials
 * Format: "environment|clientId|clientSecret" (nouveau)
 *      ou "clientId:clientSecret" (ancien, fallback prod)
 */
export function parseCredentials(refreshToken: string): {
  environment: GRDFEnvironment;
  clientId: string;
  clientSecret: string;
} {
  if (refreshToken.includes("|")) {
    const [environment, clientId, ...rest] = refreshToken.split("|");
    return {
      environment: environment as GRDFEnvironment,
      clientId,
      clientSecret: rest.join("|"),
    };
  }
  const [clientId, ...rest] = refreshToken.split(":");
  return {
    environment: "production",
    clientId,
    clientSecret: rest.join(":"),
  };
}

/**
 * Récupère le provider GRDF et un access token frais
 * Retourne null si GRDF n'est pas connecté
 */
export async function getGRDFProviderAndToken(organizationId: string): Promise<{
  provider: { id: string };
  accessToken: string;
  environment: GRDFEnvironment;
  clientId: string;
  clientSecret: string;
} | null> {
  const provider = await prisma.energyProvider.findUnique({
    where: {
      organizationId_provider: {
        organizationId,
        provider: "GRDF",
      },
    },
  });

  if (!provider || !provider.isConnected || !provider.refreshToken) {
    return null;
  }

  const { environment, clientId, clientSecret } = parseCredentials(provider.refreshToken);

  if (!clientId || !clientSecret) {
    return null;
  }

  const tokenResponse = await getGRDFAccessToken({
    clientId,
    clientSecret,
    environment,
  });

  // Update token in DB
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);
  await prisma.energyProvider.update({
    where: { id: provider.id },
    data: {
      accessToken: tokenResponse.access_token,
      tokenExpiresAt: expiresAt,
    },
  });

  return {
    provider: { id: provider.id },
    accessToken: tokenResponse.access_token,
    environment,
    clientId,
    clientSecret,
  };
}

// ─── Sync execution ──────────────────────────────────────────────────────

export interface SyncSiteResult {
  siteId: string;
  siteName: string;
  pce: string;
  success: boolean;
  imported: number;
  error?: string;
}

export interface SyncResult {
  /** True when at least one site was processed (even if some failed) */
  success: boolean;
  /** Human-readable summary message */
  message: string;
  environment?: GRDFEnvironment;
  sites: { total: number; success: number; failed: number };
  results: SyncSiteResult[];
}

export interface SyncGrdfOptions {
  /** Restrict the sync to a single client (Client.id) */
  clientId?: string;
  /** Restrict the sync to a single contract (Contract.id) */
  contractId?: string;
  /** Override the start date (YYYY-MM-DD). Defaults to 3 years ago. */
  startDate?: string;
  /** Override the end date (YYYY-MM-DD). Defaults to today. */
  endDate?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a GRDF sync for one organization.
 *
 * Pulls daily readings from /donnees_consos_informatives for every site
 * of the org that has a PCE, deletes existing GAZ records on the matching
 * date range, and inserts the fresh data.
 *
 * Designed to be called from BOTH the manual /api/energy/grdf/sync endpoint
 * (with user-supplied filters) and the nightly /api/cron/grdf-sync endpoint
 * (without filters, looping over every connected org).
 */
export async function syncGrdfForOrg(
  organizationId: string,
  options: SyncGrdfOptions = {}
): Promise<SyncResult> {
  const grdf = await getGRDFProviderAndToken(organizationId);
  if (!grdf) {
    return {
      success: false,
      message: "GRDF non connecté pour cette organisation",
      sites: { total: 0, success: 0, failed: 0 },
      results: [],
    };
  }

  const { accessToken, environment } = grdf;

  // Build site filter — restrict to a client or contract if specified
  const siteWhere: {
    organizationId: string;
    pce: { not: null };
    clientId?: string;
    contractSites?: { some: { contractId: string } };
  } = {
    organizationId,
    pce: { not: null },
  };
  if (options.clientId) siteWhere.clientId = options.clientId;
  if (options.contractId) {
    siteWhere.contractSites = { some: { contractId: options.contractId } };
  }

  const sites = await prisma.site.findMany({
    where: siteWhere,
    select: { id: true, name: true, pce: true },
  });

  if (sites.length === 0) {
    return {
      success: false,
      message: "Aucun site avec un PCE configuré",
      environment,
      sites: { total: 0, success: 0, failed: 0 },
      results: [],
    };
  }

  // Default date range — 3 years rolling up to today
  const defaultDateFin = new Date().toISOString().split("T")[0];
  const defaultDateDebut = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 3);
    return d.toISOString().split("T")[0];
  })();
  const dateFin = options.endDate || defaultDateFin;
  const dateDebut = options.startDate || defaultDateDebut;

  // Single call to /droits_acces — extract both the active PCE list AND
  // the per-PCE date range in one pass to avoid duplicate API requests.
  const droitsAcces: string[] = [];
  const droitsMap = new Map<string, { debut: string; fin: string }>();
  try {
    const allDroits = await getGRDFDroitsAcces(accessToken, environment);
    for (const d of allDroits) {
      if (d.etat_droit_acces !== "Active") continue;
      droitsAcces.push(d.id_pce);
      if (d.perim_donnees_conso_debut && d.perim_donnees_conso_fin) {
        droitsMap.set(d.id_pce, {
          debut: d.perim_donnees_conso_debut,
          fin: d.perim_donnees_conso_fin,
        });
      }
    }
  } catch {
    // Continue without verification (PCEs will all be queried)
  }

  // Helper: call informatives with retry on 429 (rate limit).
  const fetchConsosWithRetry = async (
    pce: string,
    debut: string,
    fin: string
  ) => {
    const backoffs = [5000, 15000, 30000];
    let lastError: unknown;
    for (let attempt = 0; attempt <= backoffs.length; attempt++) {
      try {
        return await getGRDFConsosInformatives(
          pce,
          accessToken,
          { dateDebut: debut, dateFin: fin },
          environment
        );
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : "";
        if (!msg.includes("429")) throw err;
        if (attempt < backoffs.length) await sleep(backoffs[attempt]);
      }
    }
    throw lastError;
  };

  const results: SyncSiteResult[] = [];

  let pceCallCount = 0;
  for (const site of sites) {
    const pce = site.pce!;

    if (droitsAcces.length > 0 && !droitsAcces.includes(pce)) {
      results.push({
        siteId: site.id,
        siteName: site.name,
        pce,
        success: false,
        imported: 0,
        error: "Pas de droit d'accès actif pour ce PCE",
      });
      continue;
    }

    // Throttle: 5s between PCE calls (skip on first call)
    if (pceCallCount > 0) await sleep(5000);
    pceCallCount++;

    try {
      const droitDates = droitsMap.get(pce);
      const effectiveDateDebut = droitDates?.debut || dateDebut;
      // GRDF rejects date_fin > today (code 1000016). Clamp to today.
      const today = new Date().toISOString().split("T")[0];
      const rawDateFin = droitDates?.fin || dateFin;
      const effectiveDateFin = rawDateFin > today ? today : rawDateFin;

      const consumptions = await fetchConsosWithRetry(
        pce,
        effectiveDateDebut,
        effectiveDateFin
      );

      // Cleanup existing GAZ records for this site within the synced range
      await prisma.consumption.deleteMany({
        where: {
          siteId: site.id,
          energyType: "GAZ",
          period: {
            gte: new Date(effectiveDateDebut),
            lte: new Date(effectiveDateFin),
          },
        },
      });

      let imported = 0;

      for (const conso of consumptions) {
        const consoData = conso.consommation;
        if (!consoData?.date_debut_consommation) continue;

        const period = new Date(consoData.date_debut_consommation);
        const coeffConversion = consoData.coeff_calcul?.coeff_conversion || 11.2;
        const quantityKwh =
          consoData.energie || (consoData.volume_brut || 0) * coeffConversion;

        await prisma.consumption.upsert({
          where: {
            siteId_energyType_usage_period_source: {
              siteId: site.id,
              energyType: "GAZ",
              usage: "CHAUFFAGE",
              period,
              source: "TELERELEVE",
            },
          },
          update: {
            quantity: quantityKwh,
            unit: "kWh",
            updatedAt: new Date(),
          },
          create: {
            siteId: site.id,
            organizationId,
            energyType: "GAZ",
            usage: "CHAUFFAGE",
            period,
            quantity: quantityKwh,
            unit: "kWh",
            source: "TELERELEVE",
          },
        });

        imported++;
      }

      results.push({
        siteId: site.id,
        siteName: site.name,
        pce,
        success: true,
        imported,
      });
    } catch (error) {
      results.push({
        siteId: site.id,
        siteName: site.name,
        pce,
        success: false,
        imported: 0,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      });
    }
  }

  // Update provider last sync state
  await prisma.energyProvider.update({
    where: { id: grdf.provider.id },
    data: {
      lastSyncAt: new Date(),
      lastError: results.some((r) => !r.success)
        ? `Erreurs sur ${results.filter((r) => !r.success).length} site(s)`
        : null,
    },
  });

  const totalImported = results.reduce((s, r) => s + r.imported, 0);
  const successCount = results.filter((r) => r.success).length;

  return {
    success: true,
    message: `Synchronisation terminée: ${totalImported} relevés importés`,
    environment,
    sites: {
      total: sites.length,
      success: successCount,
      failed: sites.length - successCount,
    },
    results,
  };
}
