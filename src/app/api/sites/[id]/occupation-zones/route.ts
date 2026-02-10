import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * GET /api/sites/[id]/occupation-zones
 * Liste les zones d'occupation d'un site
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id } = await params;

    // Vérifier accès au site
    const site = await prisma.site.findFirst({
      where: { id, organizationId: effectiveOrgId },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    const zones = await prisma.occupationZone.findMany({
      where: { siteId: id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(zones);
  } catch (error) {
    console.error("GET /api/sites/[id]/occupation-zones error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sites/[id]/occupation-zones
 * Créer une zone d'occupation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id } = await params;

    // Vérifier accès au site
    const site = await prisma.site.findFirst({
      where: { id, organizationId: effectiveOrgId },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, surface, tempConsigne, tempReduit, weeklySchedule } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Le nom de la zone est requis" },
        { status: 400 }
      );
    }

    const zone = await prisma.occupationZone.create({
      data: {
        siteId: id,
        name: name.trim(),
        surface: surface ? parseFloat(surface) : null,
        tempConsigne: tempConsigne ? parseFloat(tempConsigne) : 19,
        tempReduit: tempReduit ? parseFloat(tempReduit) : 16,
        weeklySchedule: weeklySchedule || null,
      },
    });

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    console.error("POST /api/sites/[id]/occupation-zones error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
