import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { GEMINI_MODEL, isAiConfigured } from "@/lib/ai-client";

// GET /api/organization - Infos de l'organisation courante (dont tampon)
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const organization = await prisma.organization.findUnique({
      where: { id: effectiveOrgId },
      select: {
        id: true,
        name: true,
        stampUrl: true,
        aiMonthlyBudgetUsd: true,
      },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      stampUrl: organization.stampUrl,
      // Une seule clé IA, celle de la plateforme : rien à configurer côté orga.
      aiConfigured: isAiConfigured(),
      aiModel: GEMINI_MODEL,
      aiMonthlyBudgetUsd: organization.aiMonthlyBudgetUsd,
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'organisation" },
      { status: 500 }
    );
  }
}

// PATCH /api/organization - Mise à jour du tampon (ADMIN uniquement)
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier l'organisation" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data: {
      stampUrl?: string | null;
      aiMonthlyBudgetUsd?: number;
    } = {};
    if (body.stampUrl !== undefined) data.stampUrl = body.stampUrl || null;
    // Le plafond IA engage la facture de la plateforme : réservé aux admins.
    if (body.aiMonthlyBudgetUsd !== undefined) {
      if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Seul un administrateur peut modifier le plafond IA" },
          { status: 403 }
        );
      }
      const budget = Number(body.aiMonthlyBudgetUsd);
      if (!Number.isFinite(budget) || budget < 0 || budget > 10000) {
        return NextResponse.json(
          { error: "Plafond IA invalide (entre 0 et 10000 $)" },
          { status: 400 }
        );
      }
      data.aiMonthlyBudgetUsd = budget;
    }

    const organization = await prisma.organization.update({
      where: { id: effectiveOrgId },
      data,
      select: {
        id: true,
        name: true,
        stampUrl: true,
        aiMonthlyBudgetUsd: true,
      },
    });

    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      stampUrl: organization.stampUrl,
      aiConfigured: isAiConfigured(),
      aiModel: GEMINI_MODEL,
      aiMonthlyBudgetUsd: organization.aiMonthlyBudgetUsd,
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'organisation" },
      { status: 500 }
    );
  }
}
