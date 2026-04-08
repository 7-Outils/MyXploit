import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { syncGrdfForOrg } from "@/lib/grdf-helpers";

// Allow this route to run up to 5 minutes — GRDF rate limiting + retries
// can take a while when syncing several PCEs at once.
export const maxDuration = 300;

// POST /api/energy/grdf/sync - Manually trigger a GRDF sync for the
// authenticated user's organization, optionally scoped to a client/contract.
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour synchroniser GRDF" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const result = await syncGrdfForOrg(effectiveOrgId, {
      clientId: body.clientId,
      contractId: body.contractId,
      startDate: body.startDate,
      endDate: body.endDate,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error syncing GRDF:", error);
    return NextResponse.json(
      { error: "Erreur lors de la synchronisation GRDF" },
      { status: 500 }
    );
  }
}
