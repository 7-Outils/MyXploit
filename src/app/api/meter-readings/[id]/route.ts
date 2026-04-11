import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * PUT /api/meter-readings/[id] - Update a meter reading (index value + date)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    const reading = await prisma.meterReading.findUnique({
      where: { id },
      include: { meter: { include: { site: true } } },
    });

    if (!reading || reading.meter.site.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Relevé non trouvé" }, { status: 404 });
    }

    const body = await request.json();

    const updated = await prisma.meterReading.update({
      where: { id },
      data: {
        readingDate: body.readingDate ? new Date(body.readingDate) : undefined,
        indexValue: body.indexValue !== undefined ? parseFloat(body.indexValue) : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating reading:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/meter-readings/[id] - Delete a meter reading
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    const reading = await prisma.meterReading.findUnique({
      where: { id },
      include: { meter: { include: { site: true } } },
    });

    if (!reading || reading.meter.site.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Relevé non trouvé" }, { status: 404 });
    }

    await prisma.meterReading.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reading:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
