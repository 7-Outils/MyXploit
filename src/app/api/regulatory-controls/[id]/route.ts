import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * GET /api/regulatory-controls/[id]
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

    const control = await prisma.regulatoryControl.findFirst({
      where: { id, organizationId: effectiveOrgId },
      include: {
        type: true,
        site: { select: { id: true, name: true, city: true, address: true } },
        equipment: {
          select: { id: true, name: true, type: true, brand: true, model: true },
        },
      },
    });

    if (!control) {
      return NextResponse.json(
        { error: "Contrôle non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(control);
  } catch (error) {
    console.error("GET /api/regulatory-controls/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/regulatory-controls/[id]
 * Modifier un contrôle (planifier, enregistrer résultat, etc.)
 */
export async function PATCH(
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

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    const existing = await prisma.regulatoryControl.findFirst({
      where: { id, organizationId: effectiveOrgId },
      include: { type: { select: { frequencyMonths: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Contrôle non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      status,
      dueDate,
      performedDate,
      performer,
      result,
      reportUrl,
      notes,
    } = body;

    // Calculer la prochaine échéance si on marque comme EFFECTUE
    let nextDueDate: Date | null = null;
    if (status === "EFFECTUE" && (performedDate || existing.performedDate)) {
      const baseDate = performedDate
        ? new Date(performedDate)
        : existing.performedDate!;
      nextDueDate = new Date(baseDate);
      nextDueDate.setMonth(
        nextDueDate.getMonth() + existing.type.frequencyMonths
      );
    }

    const control = await prisma.regulatoryControl.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
        ...(performedDate !== undefined && {
          performedDate: performedDate ? new Date(performedDate) : null,
        }),
        ...(performer !== undefined && {
          performer: performer?.trim() || null,
        }),
        ...(result !== undefined && { result }),
        ...(reportUrl !== undefined && { reportUrl }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(nextDueDate && { nextDueDate }),
      },
      include: {
        type: {
          select: { id: true, name: true, category: true, frequency: true },
        },
        site: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(control);
  } catch (error) {
    console.error("PATCH /api/regulatory-controls/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/regulatory-controls/[id]
 */
export async function DELETE(
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

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    const existing = await prisma.regulatoryControl.findFirst({
      where: { id, organizationId: effectiveOrgId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Contrôle non trouvé" },
        { status: 404 }
      );
    }

    await prisma.regulatoryControl.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/regulatory-controls/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
