import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/** Retourne la visite si elle appartient bien à l'organisation courante. */
async function findScopedVisit(visitId: string, organizationId: string) {
  return prisma.siteVisit.findFirst({
    where: { id: visitId, contract: { organizationId } },
    select: { id: true, contractId: true },
  });
}

// GET /api/visits/[id] - Visite complète (passages + sites)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const visit = await prisma.siteVisit.findFirst({
      where: { id, contract: { organizationId: effectiveOrgId } },
      include: {
        entries: {
          include: { site: { select: { id: true, name: true, city: true } } },
        },
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!visit) {
      return NextResponse.json({ error: "Visite non trouvée" }, { status: 404 });
    }

    // Ordre stable dans la colonne de gauche : par nom de site
    visit.entries.sort((a, b) => a.site.name.localeCompare(b.site.name, "fr"));

    return NextResponse.json(visit);
  } catch (error) {
    console.error("Error fetching site visit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la visite" },
      { status: 500 }
    );
  }
}

// PATCH /api/visits/[id] - En-tête de la visite (date, participants, notes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier une visite" },
        { status: 403 }
      );
    }

    const existing = await findScopedVisit(id, effectiveOrgId);
    if (!existing) {
      return NextResponse.json({ error: "Visite non trouvée" }, { status: 404 });
    }

    const body = await request.json();
    const data: {
      date?: Date;
      participants?: string | null;
      notes?: string | null;
    } = {};

    if (body.date !== undefined) {
      const date = new Date(body.date);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "Date invalide" }, { status: 400 });
      }
      data.date = date;
    }
    if (body.participants !== undefined) {
      data.participants =
        typeof body.participants === "string" && body.participants.trim()
          ? body.participants.trim()
          : null;
    }
    if (body.notes !== undefined) {
      data.notes =
        typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    }

    const visit = await prisma.siteVisit.update({ where: { id }, data });
    return NextResponse.json(visit);
  } catch (error) {
    console.error("Error updating site visit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la visite" },
      { status: 500 }
    );
  }
}

// DELETE /api/visits/[id] - Supprime la visite et ses passages (cascade)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer une visite" },
        { status: 403 }
      );
    }

    const existing = await findScopedVisit(id, effectiveOrgId);
    if (!existing) {
      return NextResponse.json({ error: "Visite non trouvée" }, { status: 404 });
    }

    await prisma.siteVisit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting site visit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la visite" },
      { status: 500 }
    );
  }
}
