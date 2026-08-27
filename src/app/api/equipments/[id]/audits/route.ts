import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { rateLimit, getClientIdentifier, rateLimitExceeded } from "@/lib/rate-limit";
import { auditCreateSchema, validateInput } from "@/lib/validations";

// GET /api/equipments/[id]/audits - Get all audits for an equipment
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
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: equipmentId } = await params;

    // Verify equipment belongs to organization
    const equipment = await prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        organizationId: effectiveOrgId,
      },
    });

    if (!equipment) {
      return NextResponse.json(
        { error: "Équipement non trouvé" },
        { status: 404 }
      );
    }

    const audits = await prisma.equipmentAudit.findMany({
      where: { equipmentId },
      orderBy: { auditDate: "desc" },
    });

    return NextResponse.json(audits);
  } catch (error) {
    console.error("Error fetching equipment audits:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des audits" },
      { status: 500 }
    );
  }
}

// POST /api/equipments/[id]/audits - Create a new audit for an equipment
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
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: equipmentId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un audit" },
        { status: 403 }
      );
    }

    // Verify equipment belongs to organization
    const equipment = await prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        organizationId: effectiveOrgId,
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
    const validation = validateInput(auditCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const audit = await prisma.equipmentAudit.create({
      data: {
        equipmentId,
        auditDate: body.auditDate ? new Date(body.auditDate) : new Date(),
        auditor: body.auditor || null,
        auditedById: user.id,
        // Ratings
        visualState: body.visualState || "NON_EVALUE",
        performance: body.performance || "NON_EVALUE",
        security: body.security || "NON_EVALUE",
        accessibility: body.accessibility || "NON_EVALUE",
        compliance: body.compliance || "NON_EVALUE",
        // Notes
        visualNotes: body.visualNotes || null,
        performanceNotes: body.performanceNotes || null,
        securityNotes: body.securityNotes || null,
        accessibilityNotes: body.accessibilityNotes || null,
        complianceNotes: body.complianceNotes || null,
        generalNotes: body.generalNotes || null,
        // Photos
        photos: body.photos || [],
      },
    });

    return NextResponse.json(audit, { status: 201 });
  } catch (error) {
    console.error("Error creating equipment audit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'audit" },
      { status: 500 }
    );
  }
}
