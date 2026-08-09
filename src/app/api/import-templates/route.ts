import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * Gabarits d'import exploitant — mapping colonne → notion mémorisé en base,
 * partagé par toute l'organisation (remplace le localStorage du banc de test).
 * Un gabarit = une trame, identifiée par la signature de ses en-têtes.
 */

// GET /api/import-templates?signature=... → le gabarit de cette trame (ou null).
// Sans signature → liste des gabarits de l'organisation.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);
    const signature = searchParams.get("signature");

    if (signature) {
      const template = await prisma.importTemplate.findUnique({
        where: { organizationId_signature: { organizationId: effectiveOrgId, signature } },
        select: { id: true, name: true, mapping: true, updatedAt: true },
      });
      return NextResponse.json({ template });
    }

    const templates = await prisma.importTemplate.findMany({
      where: { organizationId: effectiveOrgId },
      select: { id: true, name: true, signature: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("[import-templates] GET:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des gabarits" },
      { status: 500 }
    );
  }
}

// POST /api/import-templates - Upsert du gabarit d'une trame.
// Body: { signature, mapping: { notion: "libellé de colonne" }, name? }
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    const body = await request.json();
    const signature: string | undefined = body.signature;
    const mapping = body.mapping;
    const name: string | null = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;

    if (!signature || typeof signature !== "string") {
      return NextResponse.json({ error: "Signature de trame manquante" }, { status: 400 });
    }
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
      return NextResponse.json({ error: "Mapping invalide" }, { status: 400 });
    }

    const template = await prisma.importTemplate.upsert({
      where: { organizationId_signature: { organizationId: effectiveOrgId, signature } },
      update: { mapping, ...(name ? { name } : {}) },
      create: { organizationId: effectiveOrgId, signature, mapping, name },
      select: { id: true, name: true, mapping: true, updatedAt: true },
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error("[import-templates] POST:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement du gabarit" },
      { status: 500 }
    );
  }
}

// DELETE /api/import-templates?id=... — supprime un gabarit (re-mappage repart de l'auto-détection).
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Veuillez spécifier un id" }, { status: 400 });
    }

    await prisma.importTemplate.deleteMany({ where: { id, organizationId: effectiveOrgId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[import-templates] DELETE:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du gabarit" },
      { status: 500 }
    );
  }
}
