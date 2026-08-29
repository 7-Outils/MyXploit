import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { controlDueDate } from "@/lib/equipment-controls";

/**
 * Contrôles réglementaires d'un équipement : les règles applicables à son type,
 * le dernier contrôle enregistré pour chacune et l'échéance qui en découle.
 */

function authorName(
  user:
    | { firstName: string | null; lastName: string | null; email: string }
    | null
    | undefined
): string | null {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email;
}

// GET /api/equipments/[id]/controls
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id: equipmentId } = await params;

    const equipment = await prisma.equipment.findFirst({
      where: { id: equipmentId, organizationId: effectiveOrgId },
      select: { id: true, type: true },
    });
    if (!equipment) {
      return NextResponse.json(
        { error: "Équipement non trouvé" },
        { status: 404 }
      );
    }

    const rules = await prisma.equipmentControlRule.findMany({
      where: { organizationId: effectiveOrgId, equipmentType: equipment.type },
      orderBy: { name: "asc" },
    });

    if (rules.length === 0) return NextResponse.json([]);

    const records = await prisma.equipmentControlRecord.findMany({
      where: { equipmentId, ruleId: { in: rules.map((r) => r.id) } },
      orderBy: [{ doneDate: "desc" }, { createdAt: "desc" }],
      select: {
        ruleId: true,
        doneDate: true,
        notes: true,
        createdBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    // Les records sont triés du plus récent au plus ancien : le premier vu
    // pour une règle est son dernier contrôle.
    const lastByRule = new Map<string, (typeof records)[number]>();
    for (const record of records) {
      if (!lastByRule.has(record.ruleId)) lastByRule.set(record.ruleId, record);
    }

    return NextResponse.json(
      rules.map((rule) => {
        const last = lastByRule.get(rule.id);
        return {
          ruleId: rule.id,
          name: rule.name,
          frequencyMonths: rule.frequencyMonths,
          lastDoneDate: last?.doneDate ?? null,
          lastNotes: last?.notes ?? null,
          lastAuthor: authorName(last?.createdBy),
          dueDate: controlDueDate(last?.doneDate, rule.frequencyMonths),
        };
      })
    );
  } catch (error) {
    console.error("GET /api/equipments/[id]/controls error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/equipments/[id]/controls — enregistrer un contrôle réalisé
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id: equipmentId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour enregistrer un contrôle" },
        { status: 403 }
      );
    }

    const equipment = await prisma.equipment.findFirst({
      where: { id: equipmentId, organizationId: effectiveOrgId },
      select: { id: true, type: true },
    });
    if (!equipment) {
      return NextResponse.json(
        { error: "Équipement non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const ruleId = typeof body.ruleId === "string" ? body.ruleId : "";
    if (!ruleId) {
      return NextResponse.json({ error: "Règle manquante" }, { status: 400 });
    }

    // La règle doit appartenir à l'orga ET viser le type de cet équipement.
    const rule = await prisma.equipmentControlRule.findFirst({
      where: {
        id: ruleId,
        organizationId: effectiveOrgId,
        equipmentType: equipment.type,
      },
      select: { id: true },
    });
    if (!rule) {
      return NextResponse.json(
        { error: "Cette règle ne s'applique pas à cet équipement" },
        { status: 400 }
      );
    }

    const doneDate = body.doneDate ? new Date(body.doneDate) : null;
    if (!doneDate || Number.isNaN(doneDate.getTime())) {
      return NextResponse.json(
        { error: "Date de contrôle invalide" },
        { status: 400 }
      );
    }

    const record = await prisma.equipmentControlRecord.create({
      data: {
        equipmentId,
        ruleId,
        doneDate,
        notes:
          typeof body.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : null,
        createdById: user.id,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("POST /api/equipments/[id]/controls error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
