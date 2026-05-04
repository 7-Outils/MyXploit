import { NextRequest, NextResponse } from "next/server";
import { syncDailyDjuCache } from "@/lib/dju-sync";

// Endpoint dédié au seed/refresh du cache DailyDju.
// Plus court que /api/cron/dju-sync (qui fait aussi syncDjuForOrg pour
// chaque org) → moins risqué de timeout pour un déclenchement manuel.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const result = await syncDailyDjuCache();
  const finishedAt = new Date();

  return NextResponse.json({
    success: result.errors.length === 0,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    ...result,
  });
}
