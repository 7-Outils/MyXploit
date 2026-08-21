import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/organization - Infos de l'organisation courante (dont tampon)
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const organization = await prisma.organization.findUnique({
      where: { id: effectiveOrgId },
      select: { id: true, name: true, stampUrl: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'organisation" },
      { status: 500 }
    );
  }
}

// PATCH /api/organization - Mise à jour du tampon (ADMIN uniquement)
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier l'organisation" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data: { stampUrl?: string | null } = {};
    if (body.stampUrl !== undefined) data.stampUrl = body.stampUrl || null;

    const organization = await prisma.organization.update({
      where: { id: effectiveOrgId },
      data,
      select: { id: true, name: true, stampUrl: true },
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'organisation" },
      { status: 500 }
    );
  }
}
