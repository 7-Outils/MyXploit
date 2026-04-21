import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { regenerateConsumptionForSite } from "@/lib/consumption-projector";

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

    // Régénérer la projection Consumption pour le site impacté
    await regenerateConsumptionForSite(reading.meter.siteId, reading.meter.site.organizationId);

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

    const siteId = reading.meter.siteId;
    const organizationId = reading.meter.site.organizationId;

    await prisma.meterReading.delete({ where: { id } });

    // Régénérer la projection Consumption pour le site impacté
    await regenerateConsumptionForSite(siteId, organizationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reading:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
