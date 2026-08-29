import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// Affecter 200 équipements à un local ne doit pas coûter 200 requêtes : la
// barre d'affectation en masse (et le glisser-déposer) passe par ici.
const MAX_IDS = 500;

// PATCH /api/equipments/bulk - Rattache/détache en masse à un local ou un circuit
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier ces équipements" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
    }

    const ids: unknown = (body as { ids?: unknown }).ids;
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > MAX_IDS ||
      !ids.every((id) => typeof id === "string" && id.length > 0)
    ) {
      return NextResponse.json(
        { error: `Liste d'équipements invalide (1 à ${MAX_IDS} identifiants)` },
        { status: 400 }
      );
    }

    // Exactement un champ de rattachement par appel : mélanger local et circuit
    // dans la même écriture rendrait le bornage par site ambigu.
    const hasRoom = Object.prototype.hasOwnProperty.call(body, "roomId");
    const hasCircuit = Object.prototype.hasOwnProperty.call(body, "circuitId");
    if (hasRoom === hasCircuit) {
      return NextResponse.json(
        { error: "Indiquez exactement un rattachement : roomId ou circuitId" },
        { status: 400 }
      );
    }

    const field = hasRoom ? "roomId" : "circuitId";
    const rawValue = (body as Record<string, unknown>)[field];
    if (rawValue !== null && typeof rawValue !== "string") {
      return NextResponse.json(
        { error: "Rattachement invalide" },
        { status: 400 }
      );
    }
    const value: string | null = rawValue === null || rawValue === "" ? null : rawValue;

    // Le bornage : sans site cible (détachement), l'organisation suffit ;
    // avec une cible, on ajoute le site du local/circuit pour qu'un équipement
    // d'un autre site ne puisse pas être rattaché à une topologie étrangère.
    let siteId: string | undefined;
    if (value !== null) {
      const target =
        field === "roomId"
          ? await prisma.technicalRoom.findFirst({
              where: { id: value, site: { organizationId: effectiveOrgId } },
              select: { siteId: true },
            })
          : await prisma.circuit.findFirst({
              where: { id: value, site: { organizationId: effectiveOrgId } },
              select: { siteId: true },
            });

      if (!target) {
        return NextResponse.json(
          { error: field === "roomId" ? "Local non trouvé" : "Circuit non trouvé" },
          { status: 404 }
        );
      }
      siteId = target.siteId;
    }

    // Les équipements hors périmètre sont ignorés en silence : le count renvoyé
    // dit à l'appelant combien ont réellement bougé.
    const { count } = await prisma.equipment.updateMany({
      where: {
        id: { in: ids as string[] },
        organizationId: effectiveOrgId,
        ...(siteId ? { siteId } : {}),
      },
      // Signature : une affectation en masse reste une modification
      data:
        field === "roomId"
          ? { roomId: value, updatedById: user.id }
          : { circuitId: value, updatedById: user.id },
    });

    return NextResponse.json({ updated: count });
  } catch (error) {
    console.error("Error bulk-updating equipments:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'affectation des équipements" },
      { status: 500 }
    );
  }
}
