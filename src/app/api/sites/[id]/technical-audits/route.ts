import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { rateLimit, getClientIdentifier, rateLimitExceeded } from "@/lib/rate-limit";
import { calculateGlobalResult, SavedChecklistItem } from "@/lib/audit/technical-checklists";
import { z } from "zod";

// Validation schema for technical audit
const checklistItemSchema = z.object({
  equipmentType: z.string(),
  itemId: z.string(),
  label: z.string(),
  category: z.string(),
  result: z.enum(["CONFORME", "NON_CONFORME", "NA", "NON_VERIFIE"]),
  notes: z.string().optional(),
  // Nouveaux champs pour les textes de rapport
  conformeText: z.string().optional(),
  nonConformeText: z.string().optional(),
  regulatoryReference: z.string().optional(),
});

// Validation schema for recommendations
const recommendationSchema = z.object({
  templateId: z.string().optional(),
  checklistItemKey: z.string().optional(),
  title: z.string().min(1),
  description: z.string(),
  estimatedCostMin: z.number().optional(),
  estimatedCostMax: z.number().optional(),
  priority: z.number().int().min(1).max(4).default(3),
  auditorNotes: z.string().optional(),
});

const technicalAuditSchema = z.object({
  auditDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  auditor: z.string().max(500).optional(),
  checklistItems: z.array(checklistItemSchema).min(1),
  globalResult: z.enum(["NON_VERIFIE", "CONFORME", "NON_CONFORME", "PARTIEL"]).optional(),
  generalNotes: z.string().max(5000).optional(),
  photos: z.array(z.string().url()).optional(),
  recommendations: z.array(recommendationSchema).optional(),
});

// GET /api/sites/[id]/technical-audits - Get all technical audits for a site
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
    const { id: siteId } = await params;

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

    const audits = await prisma.technicalAudit.findMany({
      where: { siteId },
      orderBy: { auditDate: "desc" },
    });

    return NextResponse.json(audits);
  } catch (error) {
    console.error("Error fetching technical audits:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des audits techniques" },
      { status: 500 }
    );
  }
}

// POST /api/sites/[id]/technical-audits - Create a new technical audit for a site
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
    const { id: siteId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour creer un audit technique" },
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

    const body = await request.json();

    // Validate input
    const validation = technicalAuditSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      const path = firstError.path.join(".");
      const message = firstError.message;
      return NextResponse.json(
        { error: path ? `${path}: ${message}` : message },
        { status: 400 }
      );
    }

    // Calculate global result from checklist items
    const checklistItems = body.checklistItems as SavedChecklistItem[];
    const globalResult = body.globalResult || calculateGlobalResult(checklistItems);

    // Create audit with recommendations in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the audit
      const audit = await tx.technicalAudit.create({
        data: {
          siteId,
          auditDate: body.auditDate ? new Date(body.auditDate) : new Date(),
          auditor: body.auditor || null,
          checklistItems: checklistItems as unknown as object[],
          globalResult,
          generalNotes: body.generalNotes || null,
          photos: body.photos || [],
        },
      });

      // Create recommendations if provided
      const recommendations = body.recommendations || [];
      if (recommendations.length > 0) {
        await tx.auditRecommendation.createMany({
          data: recommendations.map((rec: z.infer<typeof recommendationSchema>) => ({
            technicalAuditId: audit.id,
            templateId: rec.templateId || null,
            checklistItemKey: rec.checklistItemKey || null,
            title: rec.title,
            description: rec.description,
            estimatedCostMin: rec.estimatedCostMin || null,
            estimatedCostMax: rec.estimatedCostMax || null,
            priority: rec.priority || 3,
            auditorNotes: rec.auditorNotes || null,
          })),
        });
      }

      // Fetch the complete audit with recommendations
      return tx.technicalAudit.findUnique({
        where: { id: audit.id },
        include: { recommendations: true },
      });
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating technical audit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la creation de l'audit technique" },
      { status: 500 }
    );
  }
}
