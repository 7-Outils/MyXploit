import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { withDerivedStatus } from "@/lib/contract-status";
import { getUserAssignedContractIds } from "@/lib/portfolio";

// GET /api/contracts - List all contracts
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    // Filtrage portefeuille : EDITOR/READER avec assignations ne voient que leurs contrats
    const assignedContractIds = await getUserAssignedContractIds(user.id, user.role, effectiveOrgId);

    const where: Record<string, unknown> = { organizationId: effectiveOrgId };
    if (assignedContractIds !== null) {
      where.id = { in: assignedContractIds };
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        client: {
          select: { id: true, name: true },
        },
        contractSites: {
          include: {
            site: {
              select: { id: true, name: true, type: true, energyType: true },
            },
          },
        },
        _count: {
          select: { contractSites: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contracts.map(withDerivedStatus));
  } catch (error) {
    console.error("Error fetching contracts:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des contrats" },
      { status: 500 }
    );
  }
}

// Chaîne vide / espaces → null ; une date invalide → null.
function optionalText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}
function optionalDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// POST /api/contracts - Create a new contract
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un contrat" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const contract = await prisma.contract.create({
      data: {
        reference: optionalText(body.reference),
        provider: optionalText(body.provider),
        startDate: optionalDate(body.startDate),
        endDate: optionalDate(body.endDate),
        status: "ACTIF",
        organizationId: effectiveOrgId,
        yearType: body.yearType || "HEATING_SEASON",
        isPublic: body.isPublic === true,
        clientId: body.clientId || null,
      },
      include: {
        contractSites: {
          include: {
            site: {
              select: { id: true, name: true, type: true, energyType: true },
            },
          },
        },
      },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    console.error("Error creating contract:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du contrat" },
      { status: 500 }
    );
  }
}
