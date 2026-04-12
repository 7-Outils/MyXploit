import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// PUT /api/heating-periods/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.heatingPeriod.findUnique({
      where: { id },
      include: { site: { select: { organizationId: true } } },
    });

    if (!existing || existing.site.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    }

    const updated = await prisma.heatingPeriod.update({
      where: { id },
      data: {
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate === null ? null : body.endDate ? new Date(body.endDate) : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating heating period:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/heating-periods/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const existing = await prisma.heatingPeriod.findUnique({
      where: { id },
      include: { site: { select: { organizationId: true } } },
    });

    if (!existing || existing.site.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    }

    await prisma.heatingPeriod.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting heating period:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
