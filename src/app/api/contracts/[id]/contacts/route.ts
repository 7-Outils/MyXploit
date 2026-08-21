import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIDES = ["EXPLOITANT", "CLIENT"] as const;

async function requireContract(id: string, organizationId: string) {
  return prisma.contract.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
}

// GET /api/contracts/[id]/contacts - Carnet de contacts du contrat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (!(await requireContract(id, effectiveOrgId))) {
      return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
    }

    const contacts = await prisma.contractContact.findMany({
      where: { contractId: id },
      orderBy: [{ side: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(contacts);
  } catch (error) {
    console.error("Error fetching contract contacts:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des contacts" },
      { status: 500 }
    );
  }
}

// POST /api/contracts/[id]/contacts - Ajouter un contact
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier les contacts" },
        { status: 403 }
      );
    }

    if (!(await requireContract(id, effectiveOrgId))) {
      return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    const side = body.side;

    if (!name) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
    }
    if (!SIDES.includes(side)) {
      return NextResponse.json(
        { error: "Côté invalide (EXPLOITANT ou CLIENT)" },
        { status: 400 }
      );
    }

    const contact = await prisma.contractContact.create({
      data: { contractId: id, name, email, role: role || null, side },
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error creating contract contact:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du contact" },
      { status: 500 }
    );
  }
}
