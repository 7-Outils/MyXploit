import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { calculateGlobalResult, SavedChecklistItem } from "@/lib/audit/technical-checklists";

// GET /api/sites/[id]/technical-audits/[auditId] - Get a specific technical audit
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auditId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: siteId, auditId } = await params;

    // Verify site belongs to organization
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId: user.organizationId,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouve" },
        { status: 404 }
      );
    }

    const audit = await prisma.technicalAudit.findFirst({
      where: {
        id: auditId,
        siteId,
      },
    });

    if (!audit) {
      return NextResponse.json(
        { error: "Audit technique non trouve" },
        { status: 404 }
      );
    }

    return NextResponse.json(audit);
  } catch (error) {
    console.error("Error fetching technical audit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation de l'audit technique" },
      { status: 500 }
    );
  }
}

// PUT /api/sites/[id]/technical-audits/[auditId] - Update a technical audit
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auditId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: siteId, auditId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier un audit technique" },
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
        { error: "Site non trouve" },
        { status: 404 }
      );
    }

    // Verify audit exists
    const existingAudit = await prisma.technicalAudit.findFirst({
      where: {
        id: auditId,
        siteId,
      },
    });

    if (!existingAudit) {
      return NextResponse.json(
        { error: "Audit technique non trouve" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Calculate global result if checklist items changed
    let globalResult = body.globalResult;
    if (body.checklistItems && !body.globalResult) {
      globalResult = calculateGlobalResult(body.checklistItems as SavedChecklistItem[]);
    }

    const audit = await prisma.technicalAudit.update({
      where: { id: auditId },
      data: {
        auditDate: body.auditDate ? new Date(body.auditDate) : undefined,
        auditor: body.auditor !== undefined ? body.auditor : undefined,
        checklistItems: body.checklistItems !== undefined ? body.checklistItems : undefined,
        globalResult: globalResult !== undefined ? globalResult : undefined,
        generalNotes: body.generalNotes !== undefined ? body.generalNotes : undefined,
        photos: body.photos !== undefined ? body.photos : undefined,
      },
    });

    return NextResponse.json(audit);
  } catch (error) {
    console.error("Error updating technical audit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification de l'audit technique" },
      { status: 500 }
    );
  }
}

// DELETE /api/sites/[id]/technical-audits/[auditId] - Delete a technical audit
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auditId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: siteId, auditId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer un audit technique" },
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
        { error: "Site non trouve" },
        { status: 404 }
      );
    }

    // Verify audit exists
    const existingAudit = await prisma.technicalAudit.findFirst({
      where: {
        id: auditId,
        siteId,
      },
    });

    if (!existingAudit) {
      return NextResponse.json(
        { error: "Audit technique non trouve" },
        { status: 404 }
      );
    }

    await prisma.technicalAudit.delete({
      where: { id: auditId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting technical audit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'audit technique" },
      { status: 500 }
    );
  }
}
