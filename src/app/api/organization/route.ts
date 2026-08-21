import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

// GET /api/organization - Infos de l'organisation courante (dont tampon)
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const organization = await prisma.organization.findUnique({
      where: { id: effectiveOrgId },
      select: { id: true, name: true, stampUrl: true, geminiApiKey: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
    }

    // La clé ne sort jamais : on n'expose que son statut et ses 4 derniers caractères
    let geminiKeyLast4: string | null = null;
    if (organization.geminiApiKey) {
      try {
        const key = decryptSecret(organization.geminiApiKey);
        geminiKeyLast4 = key ? key.slice(-4) : null;
      } catch {
        geminiKeyLast4 = null;
      }
    }

    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      stampUrl: organization.stampUrl,
      geminiKeySet: !!organization.geminiApiKey,
      geminiKeyLast4,
      // Une clé plateforme sert encore de secours si l'orga n'en a pas
      geminiFallback: !organization.geminiApiKey && !!process.env.GEMINI_API_KEY,
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
    const data: { stampUrl?: string | null; geminiApiKey?: string | null } = {};
    if (body.stampUrl !== undefined) data.stampUrl = body.stampUrl || null;
    if (body.geminiApiKey !== undefined) {
      const key = typeof body.geminiApiKey === "string" ? body.geminiApiKey.trim() : "";
      if (key) {
        if (key.length < 20) {
          return NextResponse.json({ error: "Clé API invalide (trop courte)" }, { status: 400 });
        }
        data.geminiApiKey = encryptSecret(key);
      } else {
        data.geminiApiKey = null;
      }
    }

    const organization = await prisma.organization.update({
      where: { id: effectiveOrgId },
      data,
      select: { id: true, name: true, stampUrl: true, geminiApiKey: true },
    });

    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      stampUrl: organization.stampUrl,
      geminiKeySet: !!organization.geminiApiKey,
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'organisation" },
      { status: 500 }
    );
  }
}
