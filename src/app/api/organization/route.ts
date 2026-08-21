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
      select: { id: true, name: true, stampUrl: true, aiProvider: true, aiApiKey: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
    }

    // La clé ne sort jamais : on n'expose que son statut et ses 4 derniers caractères
    let aiKeyLast4: string | null = null;
    if (organization.aiApiKey) {
      try {
        const key = decryptSecret(organization.aiApiKey);
        aiKeyLast4 = key ? key.slice(-4) : null;
      } catch {
        aiKeyLast4 = null;
      }
    }

    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      stampUrl: organization.stampUrl,
      aiProvider: organization.aiProvider ?? "GEMINI",
      aiKeySet: !!organization.aiApiKey,
      aiKeyLast4,
      // Une clé Gemini plateforme sert encore de secours si l'orga n'en a pas
      aiFallback: !organization.aiApiKey && !!process.env.GEMINI_API_KEY,
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
    const data: { stampUrl?: string | null; aiProvider?: string; aiApiKey?: string | null } = {};
    if (body.stampUrl !== undefined) data.stampUrl = body.stampUrl || null;
    if (body.aiProvider !== undefined) {
      if (!["GEMINI", "OPENAI", "ANTHROPIC"].includes(body.aiProvider)) {
        return NextResponse.json({ error: "Fournisseur IA inconnu" }, { status: 400 });
      }
      data.aiProvider = body.aiProvider;
    }
    if (body.aiApiKey !== undefined) {
      const key = typeof body.aiApiKey === "string" ? body.aiApiKey.trim() : "";
      if (key) {
        if (key.length < 20) {
          return NextResponse.json({ error: "Clé API invalide (trop courte)" }, { status: 400 });
        }
        data.aiApiKey = encryptSecret(key);
      } else {
        data.aiApiKey = null;
      }
    }

    const organization = await prisma.organization.update({
      where: { id: effectiveOrgId },
      data,
      select: { id: true, name: true, stampUrl: true, aiProvider: true, aiApiKey: true },
    });

    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      stampUrl: organization.stampUrl,
      aiProvider: organization.aiProvider ?? "GEMINI",
      aiKeySet: !!organization.aiApiKey,
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'organisation" },
      { status: 500 }
    );
  }
}
