import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/sites/[id]/activity-log - Journal d'activité du site
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: siteId } = await params;

    // Vérifier que le site appartient à l'organisation
    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId: effectiveOrgId },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json({ error: "Site non trouvé" }, { status: 404 });
    }

    // Pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.siteActivityLog.findMany({
        where: { siteId, organizationId: effectiveOrgId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { activityDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.siteActivityLog.count({
        where: { siteId, organizationId: effectiveOrgId },
      }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching activity log:", error);
    return NextResponse.json({ error: "Erreur lors de la récupération du journal" }, { status: 500 });
  }
}

// POST /api/sites/[id]/activity-log - Ajouter une entrée au journal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: siteId } = await params;

    if (user.role === "READER") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Vérifier que le site appartient à l'organisation
    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId: effectiveOrgId },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json({ error: "Site non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const { activityType, title, description, activityDate } = body;

    if (!activityType || !title) {
      return NextResponse.json({ error: "activityType et title sont requis" }, { status: 400 });
    }

    const log = await prisma.siteActivityLog.create({
      data: {
        siteId,
        userId: user.id,
        organizationId: effectiveOrgId,
        activityType,
        title,
        description: description || null,
        activityDate: activityDate ? new Date(activityDate) : new Date(),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Error creating activity log:", error);
    return NextResponse.json({ error: "Erreur lors de la création de l'entrée" }, { status: 500 });
  }
}
