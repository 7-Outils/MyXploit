import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/missions/[id] - Detail d'une mission
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const mission = await prisma.mission.findFirst({
      where: { id, organizationId: effectiveOrgId },
      include: {
        client: true,
        missionType: { select: { id: true, name: true } },
        deliverables: {
          orderBy: { dueDate: "asc" },
        },
        engineers: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        sites: {
          include: {
            site: { select: { id: true, name: true, city: true, type: true } },
          },
        },
        contracts: {
          include: {
            contract: { select: { id: true, reference: true, title: true, provider: true, status: true } },
          },
        },
      },
    });

    if (!mission) {
      return NextResponse.json(
        { error: "Mission introuvable" },
        { status: 404 }
      );
    }

    // EDITOR doit etre assigne
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (!isAdmin) {
      const isAssigned = mission.engineers.some((e) => e.userId === user.id);
      if (!isAssigned) {
        return NextResponse.json(
          { error: "Vous n'etes pas affecte a cette mission" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(mission);
  } catch (error) {
    console.error("Error fetching mission:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation de la mission" },
      { status: 500 }
    );
  }
}

// PUT /api/missions/[id] - Modifier une mission
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le dirigeant peut modifier les missions" },
        { status: 403 }
      );
    }

    const existing = await prisma.mission.findFirst({
      where: { id, organizationId: effectiveOrgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Mission introuvable" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      status,
      missionTypeId,
      clientId,
      startDate,
      endDate,
      amountHT,
      billingModality,
      engineerIds,
      siteIds,
      contractIds,
    } = body;

    // Mise a jour des champs simples
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (missionTypeId !== undefined) data.missionTypeId = missionTypeId;
    if (clientId !== undefined) data.clientId = clientId;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (amountHT !== undefined) data.amountHT = amountHT ? parseFloat(amountHT) : null;
    if (billingModality !== undefined) data.billingModality = billingModality || null;

    const updated = await prisma.mission.update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, name: true } },
        missionType: { select: { id: true, name: true } },
      },
    });

    // Mettre a jour les ingenieurs si fournis
    if (engineerIds !== undefined) {
      await prisma.userMissionAssignment.deleteMany({ where: { missionId: id } });
      if (engineerIds.length > 0) {
        await prisma.userMissionAssignment.createMany({
          data: engineerIds.map((userId: string) => ({ userId, missionId: id })),
        });
      }
    }

    // Mettre a jour les sites si fournis
    if (siteIds !== undefined) {
      await prisma.missionSite.deleteMany({ where: { missionId: id } });
      if (siteIds.length > 0) {
        await prisma.missionSite.createMany({
          data: siteIds.map((siteId: string) => ({ missionId: id, siteId })),
        });
      }
    }

    // Mettre a jour les contrats si fournis
    if (contractIds !== undefined) {
      await prisma.missionContract.deleteMany({ where: { missionId: id } });
      if (contractIds.length > 0) {
        await prisma.missionContract.createMany({
          data: contractIds.map((contractId: string) => ({ missionId: id, contractId })),
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating mission:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification de la mission" },
      { status: 500 }
    );
  }
}

// DELETE /api/missions/[id] - Supprimer une mission
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le dirigeant peut supprimer les missions" },
        { status: 403 }
      );
    }

    const existing = await prisma.mission.findFirst({
      where: { id, organizationId: effectiveOrgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Mission introuvable" },
        { status: 404 }
      );
    }

    await prisma.mission.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting mission:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la mission" },
      { status: 500 }
    );
  }
}
