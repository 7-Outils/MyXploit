import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { buildRevisionTimeline } from "@/lib/revision-timeline";

/**
 * Chronologie de révision du contrat : pour chaque formule paramétrée
 * (firstRevisionDate + periodicity), les échéances de la première jusqu'à la
 * première échéance future incluse, avec statut, K et détail par composante.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id: contractId } = await params;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!contract) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    const timeline = await buildRevisionTimeline(contractId);
    return NextResponse.json(timeline);
  } catch (error) {
    console.error("Error building revision timeline:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
