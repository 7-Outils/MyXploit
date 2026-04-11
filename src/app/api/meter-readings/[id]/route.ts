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

    // Delete the associated Consumption record if it exists
    if (reading.periodStart) {
      const fluidMap: Record<string, { energyType: "GAZ" | "ELECTRICITE" | "EAU" | "RESEAU_CHALEUR" | "FIOUL"; usage: "CHAUFFAGE" | "ECS" }> = {
        GAZ: { energyType: "GAZ", usage: "CHAUFFAGE" },
        ELECTRICITE: { energyType: "ELECTRICITE", usage: "CHAUFFAGE" },
        EAU_CHAUDE: { energyType: "GAZ", usage: "ECS" },
        EAU_FROIDE: { energyType: "EAU", usage: "ECS" },
        CHALEUR: { energyType: "RESEAU_CHALEUR", usage: "CHAUFFAGE" },
        FIOUL: { energyType: "FIOUL", usage: "CHAUFFAGE" },
      };
      const mapping = fluidMap[reading.meter.fluid] || { energyType: "GAZ", usage: "CHAUFFAGE" };
      const period = new Date(reading.periodStart.getFullYear(), reading.periodStart.getMonth(), 1);

      await prisma.consumption.deleteMany({
        where: {
          siteId: reading.meter.siteId,
          energyType: mapping.energyType,
          usage: mapping.usage,
          period,
          source: "EXPLOITANT",
          meterName: reading.meter.name,
        },
      });
    }

    await prisma.meterReading.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reading:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
