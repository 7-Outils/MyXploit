import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/sites/[id]/meters/[meterId]/readings - List readings for a meter
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meterId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: siteId, meterId } = await params;

    // Verify site belongs to organization
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId: user.organizationId,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    const meter = await prisma.meter.findFirst({
      where: {
        id: meterId,
        siteId,
      },
    });

    if (!meter) {
      return NextResponse.json(
        { error: "Compteur non trouvé" },
        { status: 404 }
      );
    }

    // Get query params for pagination/filtering
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const year = searchParams.get("year");

    const whereClause: Record<string, unknown> = { meterId };

    if (year) {
      const startOfYear = new Date(`${year}-01-01`);
      const endOfYear = new Date(`${year}-12-31T23:59:59`);
      whereClause.readingDate = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    const readings = await prisma.meterReading.findMany({
      where: whereClause,
      orderBy: { readingDate: "desc" },
      take: limit,
    });

    return NextResponse.json(readings);
  } catch (error) {
    console.error("Error fetching readings:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des relevés" },
      { status: 500 }
    );
  }
}

// POST /api/sites/[id]/meters/[meterId]/readings - Add a new reading
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meterId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: siteId, meterId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour ajouter un relevé" },
        { status: 403 }
      );
    }

    // Verify site belongs to organization
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId: user.organizationId,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    const meter = await prisma.meter.findFirst({
      where: {
        id: meterId,
        siteId,
      },
    });

    if (!meter) {
      return NextResponse.json(
        { error: "Compteur non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Calculate converted value if meter has conversion coefficient
    let consumptionConverted: number | null = null;
    let unitConverted: string | null = null;

    if (body.consumption && meter.conversionCoefficient) {
      consumptionConverted = parseFloat(body.consumption) * meter.conversionCoefficient;
      unitConverted = meter.conversionUnit;
    }

    const readingDate = new Date(body.readingDate);
    const indexValue = body.indexValue ? parseFloat(body.indexValue) : null;

    // Calculate consumption from index difference (index N - index N-1)
    let consumption = body.consumption ? parseFloat(body.consumption) : null;
    let periodStart: Date | null = body.periodStart ? new Date(body.periodStart) : null;

    if (indexValue !== null && consumption === null) {
      const previousReading = await prisma.meterReading.findFirst({
        where: { meterId, readingDate: { lt: readingDate }, indexValue: { not: null } },
        orderBy: { readingDate: "desc" },
      });

      if (previousReading?.indexValue !== null && previousReading?.indexValue !== undefined) {
        consumption = indexValue - previousReading.indexValue;
        periodStart = previousReading.readingDate;
      }
    }

    // Recalculate conversion with computed consumption
    if (consumption !== null && meter.conversionCoefficient) {
      consumptionConverted = consumption * meter.conversionCoefficient;
      unitConverted = meter.conversionUnit;
    }

    const reading = await prisma.meterReading.create({
      data: {
        meterId,
        readingDate,
        periodStart,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : readingDate,
        indexValue,
        consumption,
        unit: body.unit || meter.unit,
        consumptionConverted,
        unitConverted,
        source: body.source || "MANUEL",
        isValidated: false,
        notes: body.notes || null,
      },
    });

    // Sync to Consumption table so analytics/ECS/Relevés tabs see the data
    if (consumption !== null && consumption > 0 && periodStart) {
      // Map meter fluid to energyType + usage
      const fluidMap: Record<string, { energyType: string; usage: string }> = {
        GAZ: { energyType: "GAZ", usage: "CHAUFFAGE" },
        ELECTRICITE: { energyType: "ELECTRICITE", usage: "CHAUFFAGE" },
        EAU_CHAUDE: { energyType: "GAZ", usage: "ECS" },
        EAU_FROIDE: { energyType: "EAU", usage: "ECS" },
        CHALEUR: { energyType: "RESEAU_CHALEUR", usage: "CHAUFFAGE" },
        FIOUL: { energyType: "FIOUL", usage: "CHAUFFAGE" },
      };

      const mapping = fluidMap[meter.fluid] || { energyType: "GAZ", usage: "CHAUFFAGE" };

      // Use the converted value (kWh/MWh) if available, otherwise raw
      const qty = consumptionConverted ?? consumption;
      const qtyUnit = unitConverted ?? meter.unit;

      // Period = first day of the month of periodStart
      const period = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);

      await prisma.consumption.upsert({
        where: {
          siteId_energyType_usage_period_source: {
            siteId,
            energyType: mapping.energyType,
            usage: mapping.usage,
            period,
            source: "EXPLOITANT",
          },
        },
        update: {
          quantity: qty,
          unit: qtyUnit,
          periodEnd: readingDate,
          meterName: meter.name,
        },
        create: {
          siteId,
          organizationId: site.organizationId,
          energyType: mapping.energyType,
          usage: mapping.usage,
          source: "EXPLOITANT",
          period,
          periodEnd: readingDate,
          quantity: qty,
          unit: qtyUnit,
          meterName: meter.name,
        },
      });
    }

    return NextResponse.json(reading, { status: 201 });
  } catch (error) {
    console.error("Error creating reading:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du relevé" },
      { status: 500 }
    );
  }
}

// PUT - Bulk import readings (for API sync or batch import)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meterId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: siteId, meterId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour importer des relevés" },
        { status: 403 }
      );
    }

    // Verify site belongs to organization
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId: user.organizationId,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    const meter = await prisma.meter.findFirst({
      where: {
        id: meterId,
        siteId,
      },
    });

    if (!meter) {
      return NextResponse.json(
        { error: "Compteur non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { readings, source = "MANUEL" } = body;

    if (!Array.isArray(readings) || readings.length === 0) {
      return NextResponse.json(
        { error: "Liste de relevés invalide" },
        { status: 400 }
      );
    }

    const created: unknown[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < readings.length; i++) {
      const r = readings[i];
      try {
        // Calculate converted value if meter has conversion coefficient
        let consumptionConverted: number | null = null;
        let unitConverted: string | null = null;

        if (r.consumption && meter.conversionCoefficient) {
          consumptionConverted = parseFloat(r.consumption) * meter.conversionCoefficient;
          unitConverted = meter.conversionUnit;
        }

        const reading = await prisma.meterReading.create({
          data: {
            meterId,
            readingDate: new Date(r.readingDate || r.date),
            periodStart: r.periodStart ? new Date(r.periodStart) : null,
            periodEnd: r.periodEnd ? new Date(r.periodEnd) : null,
            indexValue: r.indexValue ? parseFloat(r.indexValue) : null,
            consumption: r.consumption ? parseFloat(r.consumption) : null,
            unit: r.unit || meter.unit,
            consumptionConverted,
            unitConverted,
            source: r.source || source,
            isValidated: false,
            notes: r.notes || null,
          },
        });
        created.push(reading);
      } catch (err) {
        errors.push({ index: i, error: String(err) });
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error importing readings:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import des relevés" },
      { status: 500 }
    );
  }
}
