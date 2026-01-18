import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { rateLimit, getClientIdentifier, rateLimitExceeded } from "@/lib/rate-limit";
import { technicalAuditCreateSchema, validateInput } from "@/lib/validations";
import { calculateGlobalResult, SavedChecklistItem } from "@/lib/audit/technical-checklists";

// GET /api/equipments/[id]/technical-audits - Get all technical audits for an equipment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const { success } = await rateLimit(clientId);
    if (!success) return rateLimitExceeded();

    const user = await requireAuth();
    const { id: equipmentId } = await params;

    // Verify equipment belongs to organization
    const equipment = await prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        organizationId: user.organizationId,
      },
    });

    if (!equipment) {
      return NextResponse.json(
        { error: "Équipement non trouvé" },
        { status: 404 }
      );
    }

    const audits = await prisma.technicalAudit.findMany({
      where: { equipmentId },
      orderBy: { auditDate: "desc" },
    });

    return NextResponse.json(audits);
  } catch (error) {
    console.error("Error fetching technical audits:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des audits techniques" },
      { status: 500 }
    );
  }
}

// POST /api/equipments/[id]/technical-audits - Create a new technical audit for an equipment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const { success } = await rateLimit(clientId);
    if (!success) return rateLimitExceeded();

    const user = await requireAuth();
    const { id: equipmentId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un audit technique" },
        { status: 403 }
      );
    }

    // Verify equipment belongs to organization
    const equipment = await prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        organizationId: user.organizationId,
      },
    });

    if (!equipment) {
      return NextResponse.json(
        { error: "Équipement non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = validateInput(technicalAuditCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Calculate global result from checklist items
    const checklistItems = body.checklistItems as SavedChecklistItem[];
    const globalResult = body.globalResult || calculateGlobalResult(checklistItems);

    const audit = await prisma.technicalAudit.create({
      data: {
        equipmentId,
        auditDate: body.auditDate ? new Date(body.auditDate) : new Date(),
        auditor: body.auditor || null,
        checklistItems: checklistItems as unknown as object[],
        globalResult,
        generalNotes: body.generalNotes || null,
        photos: body.photos || [],
      },
    });

    return NextResponse.json(audit, { status: 201 });
  } catch (error) {
    console.error("Error creating technical audit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'audit technique" },
      { status: 500 }
    );
  }
}
