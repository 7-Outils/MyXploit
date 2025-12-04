import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/equipments/[id]/audits/[auditId] - Get a specific audit
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auditId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: equipmentId, auditId } = await params;

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

    const audit = await prisma.equipmentAudit.findFirst({
      where: {
        id: auditId,
        equipmentId,
      },
    });

    if (!audit) {
      return NextResponse.json(
        { error: "Audit non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(audit);
  } catch (error) {
    console.error("Error fetching audit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'audit" },
      { status: 500 }
    );
  }
}

// PUT /api/equipments/[id]/audits/[auditId] - Update an audit
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auditId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: equipmentId, auditId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier un audit" },
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

    // Verify audit exists
    const existingAudit = await prisma.equipmentAudit.findFirst({
      where: {
        id: auditId,
        equipmentId,
      },
    });

    if (!existingAudit) {
      return NextResponse.json(
        { error: "Audit non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const audit = await prisma.equipmentAudit.update({
      where: { id: auditId },
      data: {
        auditDate: body.auditDate ? new Date(body.auditDate) : undefined,
        auditor: body.auditor !== undefined ? body.auditor : undefined,
        visualState: body.visualState || undefined,
        performance: body.performance || undefined,
        security: body.security || undefined,
        accessibility: body.accessibility || undefined,
        compliance: body.compliance || undefined,
        visualNotes: body.visualNotes !== undefined ? body.visualNotes : undefined,
        performanceNotes: body.performanceNotes !== undefined ? body.performanceNotes : undefined,
        securityNotes: body.securityNotes !== undefined ? body.securityNotes : undefined,
        accessibilityNotes: body.accessibilityNotes !== undefined ? body.accessibilityNotes : undefined,
        complianceNotes: body.complianceNotes !== undefined ? body.complianceNotes : undefined,
        generalNotes: body.generalNotes !== undefined ? body.generalNotes : undefined,
        photos: body.photos !== undefined ? body.photos : undefined,
      },
    });

    return NextResponse.json(audit);
  } catch (error) {
    console.error("Error updating audit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification de l'audit" },
      { status: 500 }
    );
  }
}

// DELETE /api/equipments/[id]/audits/[auditId] - Delete an audit
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auditId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: equipmentId, auditId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer un audit" },
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

    // Verify audit exists
    const existingAudit = await prisma.equipmentAudit.findFirst({
      where: {
        id: auditId,
        equipmentId,
      },
    });

    if (!existingAudit) {
      return NextResponse.json(
        { error: "Audit non trouvé" },
        { status: 404 }
      );
    }

    await prisma.equipmentAudit.delete({
      where: { id: auditId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting audit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'audit" },
      { status: 500 }
    );
  }
}
