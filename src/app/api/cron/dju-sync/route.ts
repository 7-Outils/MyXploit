import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncDjuForOrg, type DjuSyncResult } from "@/lib/dju-sync";

/**
 * Nightly Vercel Cron — refreshes the DJU réels (degree-days) on every
 * Consumption record of every organization that has at least one such row.
 *
 * Runs at 04:00 UTC, one hour after /api/cron/grdf-sync, so that any
 * consumption rows created during the GRDF nightly import already have
 * their djuReel computed before users open the app in the morning.
 *
 * Triggered by Vercel Cron (configured in vercel.json) and protected by
 * the same shared secret used by /api/cron/grdf-sync. Vercel automatically
 * adds the header
 *   Authorization: Bearer ${CRON_SECRET}
 * when invoking the URL.
 */

// Allow up to 5 minutes — many orgs × many sites × Open-Meteo round-trips.
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
  console.log(`[cron dju-sync] start ${startedAt.toISOString()}`);

  // ─── List every org that has at least one consumption record ──────
  // No need to scope on EnergyProvider — DJU is computed from postal codes
  // and applies to manual imports too, not just GRDF/Enedis sync data.
  const orgsRaw = await prisma.consumption.findMany({
    distinct: ["organizationId"],
    select: { organizationId: true },
  });

  const orgIds = orgsRaw.map((o) => o.organizationId);
  console.log(`[cron dju-sync] ${orgIds.length} org(s) with consumption data`);

  const summary: {
    orgId: string;
    success: boolean;
    message: string;
    result: DjuSyncResult;
  }[] = [];

  for (let i = 0; i < orgIds.length; i++) {
    const orgId = orgIds[i];

    // Pause between orgs — Open-Meteo doesn't enforce a strict rate limit
    // but we stay polite (their archive endpoint is free and shared).
    if (i > 0) await sleep(2000);

    try {
      console.log(`[cron dju-sync] org ${orgId}…`);
      const result = await syncDjuForOrg(orgId);
      summary.push({
        orgId,
        success: result.errors.length === 0,
        message: `${result.updated}/${result.total} consos updated`,
        result,
      });
      console.log(
        `[cron dju-sync] org ${orgId}: ${result.updated}/${result.total} updated, ${result.errors.length} error(s)`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      console.error(`[cron dju-sync] org ${orgId} failed:`, err);
      summary.push({
        orgId,
        success: false,
        message,
        result: { updated: 0, total: 0, errors: [message] },
      });
    }
  }

  const finishedAt = new Date();
  const totalUpdated = summary.reduce((s, r) => s + r.result.updated, 0);
  const successOrgs = summary.filter((r) => r.success).length;

  console.log(
    `[cron dju-sync] done in ${finishedAt.getTime() - startedAt.getTime()}ms — ${successOrgs}/${orgIds.length} orgs OK, ${totalUpdated} consos updated`
  );

  return NextResponse.json({
    success: true,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    orgs: {
      total: orgIds.length,
      success: successOrgs,
      failed: orgIds.length - successOrgs,
    },
    totalUpdated,
    summary,
  });
}
