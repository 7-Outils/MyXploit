import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { VisitCheckVerdict } from "@/generated/prisma/enums";

const VERDICTS = ["NON_VERIFIE", "OK", "PARTIEL", "NON"] as const;

function parseVerdict(value: unknown): VisitCheckVerdict | undefined {
  if (typeof value !== "string") return undefined;
  return (VERDICTS as readonly string[]).includes(value)
    ? (value as VisitCheckVerdict)
    : undefined;
}

function parseText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Champs texte libres de l'entry, dans l'ordre des blocs de l'écran. */
const TEXT_FIELDS = [
  "logbookFrequency",
  "logbookNotes",
  "maintenanceLastDate",
  "maintenanceFrequency",
  "maintenanceNotes",
  "proofsNotes",
  "remarks",
] as const;

/** Champs verdict de l'entry. */
const VERDICT_FIELDS = ["logbookPresent", "maintenanceDone", "proofsPresent"] as const;

// PATCH /api/visits/[id]/entries/[entryId] - Constats relevés sur un site
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: visitId, entryId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier une visite" },
        { status: 403 }
      );
    }

    const existing = await prisma.siteVisitEntry.findFirst({
      where: {
        id: entryId,
        visitId,
        visit: { contract: { organizationId: effectiveOrgId } },
      },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Passage non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.done !== undefined) {
      if (typeof body.done !== "boolean") {
        return NextResponse.json({ error: "Champ « done » invalide" }, { status: 400 });
      }
      data.done = body.done;
    }

    for (const field of VERDICT_FIELDS) {
      if (body[field] === undefined) continue;
      const verdict = parseVerdict(body[field]);
      if (!verdict) {
        return NextResponse.json(
          { error: `Valeur invalide pour « ${field} »` },
          { status: 400 }
        );
      }
      data[field] = verdict;
    }

    for (const field of TEXT_FIELDS) {
      if (body[field] === undefined) continue;
      data[field] = parseText(body[field]);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
    }

    const entry = await prisma.siteVisitEntry.update({
      where: { id: entryId },
      data,
      include: { site: { select: { id: true, name: true, city: true } } },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Error updating site visit entry:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du passage" },
      { status: 500 }
    );
  }
}
