import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncGrdfForOrg, type SyncResult } from "@/lib/grdf-helpers";

/**
 * Nightly Vercel Cron — synchronizes GRDF consumption data for every
 * organization with a connected EnergyProvider GRDF.
 *
 * Triggered by Vercel Cron (configured in vercel.json) and protected by
 * a shared secret. Vercel automatically adds the header
 *   Authorization: Bearer ${CRON_SECRET}
 * when invoking the URL configured in vercel.json.crons.
 *
 * Schedule: every day at 03:00 UTC. GRDF ADICT publishes new daily
 * readings once per day, so syncing more often is wasted budget.
 */

// Allow up to 5 minutes — many orgs × many PCEs × rate limits.
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  // ─── Auth: must come from Vercel Cron with the shared secret ──────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  console.log(`[cron grdf-sync] start ${startedAt.toISOString()}`);

  // ─── List every org with a connected GRDF provider ────────────────
  const providers = await prisma.energyProvider.findMany({
    where: { provider: "GRDF", isConnected: true },
    select: { organizationId: true },
  });

  console.log(`[cron grdf-sync] ${providers.length} org(s) to sync`);

  const summary: {
    orgId: string;
    success: boolean;
    message: string;
    sites: SyncResult["sites"];
    totalImported: number;
  }[] = [];

  for (let i = 0; i < providers.length; i++) {
    const { organizationId } = providers[i];

    // Pause between orgs to avoid stacking rate-limit pressure on GRDF
    // when multiple orgs share the same client_id (single tenant ADICT app).
    if (i > 0) await sleep(5000);

    try {
      console.log(`[cron grdf-sync] org ${organizationId}…`);
      const result = await syncGrdfForOrg(organizationId);
      const totalImported = result.results.reduce(
        (s, r) => s + r.imported,
        0
      );
      summary.push({
        orgId: organizationId,
        success: result.success,
        message: result.message,
        sites: result.sites,
        totalImported,
      });
      console.log(
        `[cron grdf-sync] org ${organizationId}: ${totalImported} imported (${result.sites.success}/${result.sites.total} sites)`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      console.error(`[cron grdf-sync] org ${organizationId} failed:`, err);
      summary.push({
        orgId: organizationId,
        success: false,
        message,
        sites: { total: 0, success: 0, failed: 0 },
        totalImported: 0,
      });
    }
  }

  const finishedAt = new Date();
  const totalImported = summary.reduce((s, r) => s + r.totalImported, 0);
  const successOrgs = summary.filter((r) => r.success).length;

  console.log(
    `[cron grdf-sync] done in ${finishedAt.getTime() - startedAt.getTime()}ms — ${successOrgs}/${providers.length} orgs OK, ${totalImported} records imported`
  );

  return NextResponse.json({
    success: true,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    orgs: { total: providers.length, success: successOrgs, failed: providers.length - successOrgs },
    totalImported,
    summary,
  });
}
