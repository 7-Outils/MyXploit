import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/contracts/[id]/visits - Visites annuelles du contrat (plus récentes d'abord)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!contract) {
      return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
    }

    const visits = await prisma.siteVisit.findMany({
      where: { contractId },
      orderBy: { date: "desc" },
      include: {
        entries: { select: { id: true, siteId: true, done: true } },
        _count: { select: { entries: true } },
      },
    });

    return NextResponse.json({ visits });
  } catch (error) {
    console.error("Error fetching site visits:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des visites" },
      { status: 500 }
    );
  }
}

// POST /api/contracts/[id]/visits - Créer une visite et ses passages par site
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer une visite" },
        { status: 403 }
      );
    }

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (!contract) {
      return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
    }

    const body = await request.json();

    const date = body.date ? new Date(body.date) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    }

    const siteIds: string[] = Array.isArray(body.siteIds)
      ? Array.from(new Set(body.siteIds.filter((s: unknown) => typeof s === "string" && s)))
      : [];
    if (siteIds.length === 0) {
      return NextResponse.json(
        { error: "Sélectionnez au moins un site" },
        { status: 400 }
      );
    }

    // Les sites doivent appartenir à l'organisation (et non à une autre orga)
    const validSites = await prisma.site.findMany({
      where: { id: { in: siteIds }, organizationId: effectiveOrgId },
      select: { id: true },
    });
    if (validSites.length !== siteIds.length) {
      return NextResponse.json(
        { error: "Un ou plusieurs sites sont introuvables" },
        { status: 400 }
      );
    }

    const participants =
      typeof body.participants === "string" && body.participants.trim()
        ? body.participants.trim()
        : null;
    const notes =
      typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

    const visit = await prisma.siteVisit.create({
      data: {
        contractId,
        date,
        participants,
        notes,
        createdById: user.id,
        entries: { create: validSites.map((s) => ({ siteId: s.id })) },
      },
      include: {
        entries: { select: { id: true, siteId: true, done: true } },
        _count: { select: { entries: true } },
      },
    });

    return NextResponse.json(visit, { status: 201 });
  } catch (error) {
    console.error("Error creating site visit:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la visite" },
      { status: 500 }
    );
  }
}
