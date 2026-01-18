import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// Type pour un constat/finding
const findingSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  isConform: z.boolean(),
  recommendationId: z.string().nullable().optional(),
  reportText: z.string().optional(),
});

// Type pour un champ de valeur
const valueFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  unit: z.string().optional(),
  type: z.enum(["number", "date", "text"]),
  thresholdMin: z.number().optional(),
  thresholdMax: z.number().optional(),
  interpretation: z.object({
    belowMin: z.string().optional(),
    withinRange: z.string().optional(),
    aboveMax: z.string().optional(),
  }).optional(),
});

// Validation schema
const createCheckPointSchema = z.object({
  label: z.string().min(1, "Le libellé est requis").max(200),
  category: z.enum(["REGLEMENTAIRE", "CONFORMITE", "SECURITE", "PERIODIQUE"]),
  description: z.string().nullable().optional(),
  responseType: z.enum(["YES_NO", "MULTI_CHOICE", "YES_NO_DATE", "YES_NO_VALUES"]).default("MULTI_CHOICE"),
  findings: z.array(findingSchema).default([]),
  valueFields: z.array(valueFieldSchema).nullable().optional(),
  regulatoryRef: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

// GET /api/admin/audit-checkpoints - Liste tous les points de contrôle
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const checkpoints = await prisma.auditCheckPoint.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        ...(category && { category }),
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });

    return NextResponse.json(checkpoints);
  } catch (error) {
    console.error("Error fetching checkpoints:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des points de contrôle" },
      { status: 500 }
    );
  }
}

// POST /api/admin/audit-checkpoints - Créer un nouveau point de contrôle
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createCheckPointSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const checkpoint = await prisma.auditCheckPoint.create({
      data: {
        ...validation.data,
        findings: validation.data.findings,
        valueFields: validation.data.valueFields
          ? validation.data.valueFields
          : Prisma.JsonNull,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json(checkpoint, { status: 201 });
  } catch (error) {
    console.error("Error creating checkpoint:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du point de contrôle" },
      { status: 500 }
    );
  }
}
