import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorizeContract } from "@/lib/heating-status";

// DELETE /api/contracts/[id]/heating-requests/[requestId]
// Annule une demande en cours : retire les dates provisoires posées sur les
// sites. Pas d'email envoyé.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id: contractId, requestId } = await params;
    const auth = await authorizeContract(contractId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (auth.user.role === "READER") {
      return NextResponse.json({ error: "Vous n'avez pas les droits pour annuler une demande" }, { status: 403 });
    }

    const req = await prisma.heatingSwitchRequest.findFirst({
      where: { id: requestId, contractId, closedAt: null, cancelledAt: null },
    });
    if (!req) return NextResponse.json({ error: "Demande introuvable ou déjà close" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      if (req.type === "ALLUMAGE") {
        // Les sites déjà confirmés gardent leur période, on ne retire que le provisoire.
        await tx.heatingPeriod.deleteMany({ where: { startRequestId: req.id, startProvisional: true } });
      } else {
        await tx.heatingPeriod.updateMany({
          where: { endRequestId: req.id, endProvisional: true },
          data: { endDate: null, endProvisional: false, endRequestId: null },
        });
      }
      await tx.heatingSwitchRequest.update({ where: { id: req.id }, data: { cancelledAt: new Date() } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling heating request:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
