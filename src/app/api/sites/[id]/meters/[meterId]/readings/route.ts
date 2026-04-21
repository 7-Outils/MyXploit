import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { regenerateConsumptionForSite } from "@/lib/consumption-projector";

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

    // Prevent duplicate: same meter + same date
    const readingDateParsed = new Date(body.readingDate);
    const startOfDay = new Date(readingDateParsed.getFullYear(), readingDateParsed.getMonth(), readingDateParsed.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const existingReading = await prisma.meterReading.findFirst({
      where: {
        meterId,
        readingDate: { gte: startOfDay, lte: endOfDay },
      },
    });

    if (existingReading) {
      return NextResponse.json(
        { error: `Un relevé existe déjà pour ce compteur à la date du ${startOfDay.toLocaleDateString("fr-FR")}` },
        { status: 409 }
      );
    }

    // Calculate converted value if meter has conversion coefficient
    let consumptionConverted: number | null = null;
    let unitConverted: string | null = null;

    if (body.consumption && meter.conversionCoefficient) {
      consumptionConverted = parseFloat(body.consumption) * meter.conversionCoefficient;
      unitConverted = meter.conversionUnit;
    }

    const readingDate = new Date(body.readingDate);
    const indexValue = body.indexValue ? parseFloat(body.indexValue) : null;
    const isReset = body.isReset === true;

    // Calculate consumption from index difference (index N - index N-1)
    let consumption = body.consumption ? parseFloat(body.consumption) : null;
    let periodStart: Date | null = body.periodStart ? new Date(body.periodStart) : null;

    if (indexValue !== null && consumption === null && !isReset) {
      const previousReading = await prisma.meterReading.findFirst({
        where: { meterId, readingDate: { lt: readingDate }, indexValue: { not: null } },
        orderBy: { readingDate: "desc" },
      });

      if (previousReading?.indexValue !== null && previousReading?.indexValue !== undefined) {
        // Refuse decreasing index unless explicitly marked as reset
        if (indexValue < previousReading.indexValue) {
          return NextResponse.json(
            {
              error: `L'index saisi (${indexValue}) est inférieur au précédent (${previousReading.indexValue}). Si le compteur a été remplacé, cochez « Nouveau compteur ».`,
            },
            { status: 400 }
          );
        }
        consumption = indexValue - previousReading.indexValue;
        periodStart = previousReading.readingDate;

        // Anomaly check: compare to average of last 3 consumptions
        if (!body.confirmAnomaly) {
          const recentReadings = await prisma.meterReading.findMany({
            where: {
              meterId,
              readingDate: { lt: readingDate },
              consumption: { not: null, gt: 0 },
            },
            orderBy: { readingDate: "desc" },
            take: 3,
          });
          if (recentReadings.length >= 2) {
            const avg = recentReadings.reduce((s, r) => s + (r.consumption || 0), 0) / recentReadings.length;
            if (avg > 0 && consumption > avg * 3) {
              return NextResponse.json(
                {
                  anomaly: true,
                  consumption,
                  average: Math.round(avg * 10) / 10,
                  message: `Consommation anormalement élevée : ${Math.round(consumption)} vs moyenne ${Math.round(avg)} sur les ${recentReadings.length} derniers relevés. Confirmer ?`,
                },
                { status: 409 }
              );
            }
          }
        }
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
        isReset,
        notes: body.notes || null,
      },
    });

    // Régénérer la projection Consumption (proratisée) pour le site impacté
    await regenerateConsumptionForSite(siteId, site.organizationId);

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
