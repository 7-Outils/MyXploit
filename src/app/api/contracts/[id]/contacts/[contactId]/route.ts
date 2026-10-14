import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

import { parseContact } from "../route";

// Le contact doit appartenir à un contrat de l'organisation courante.
async function findScopedContact(
  contactId: string,
  contractId: string,
  organizationId: string
) {
  return prisma.contractContact.findFirst({
    where: { id: contactId, contractId, contract: { organizationId } },
    select: { id: true },
  });
}

// PUT /api/contracts/[id]/contacts/[contactId] - Modifier un contact
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id, contactId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier les contacts" },
        { status: 403 }
      );
    }

    if (!(await findScopedContact(contactId, id, effectiveOrgId))) {
      return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const existing = await prisma.contractContact.findUnique({ where: { id: contactId } });
    const parsed = parseContact({ ...existing, ...body });
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const data = parsed.data;

    const contact = await prisma.contractContact.update({
      where: { id: contactId },
      data,
    });
    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error updating contract contact:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du contact" },
      { status: 500 }
    );
  }
}

// DELETE /api/contracts/[id]/contacts/[contactId] - Supprimer un contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id, contactId } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier les contacts" },
        { status: 403 }
      );
    }

    if (!(await findScopedContact(contactId, id, effectiveOrgId))) {
      return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });
    }

    await prisma.contractContact.delete({ where: { id: contactId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contract contact:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du contact" },
      { status: 500 }
    );
  }
}
