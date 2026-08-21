import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { parseRenewalPlan } from "@/lib/gemini-renewal-parser";
import { getGeminiApiKey } from "@/lib/gemini-key";
import { rateLimit, getClientIdentifier, rateLimitExceeded } from "@/lib/rate-limit";

const bodySchema = z.object({
  rows: z.array(z.array(z.string().max(500)).max(60)).min(1).max(800),
});

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// POST /api/contracts/[id]/renewal-items/import-ai
// Reçoit le tableau brut (parsé côté client), renvoie des postes proposés
// par Gemini avec rapprochement des sites du contrat. Rien n'est enregistré.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    if (user.role === "READER") {
      return NextResponse.json({ error: "Lecture seule" }, { status: 403 });
    }

    const limit = await rateLimit(
      `import-ai:${getClientIdentifier(request)}`,
      "import"
    );
    if (!limit.success) return rateLimitExceeded(limit.remaining);

    const geminiKey = await getGeminiApiKey(effectiveOrgId);
    if (!geminiKey) {
      return NextResponse.json(
        { error: "Aucune clé API Gemini : ajoutez celle de votre organisation dans Paramètres → Clé API Gemini" },
        { status: 503 }
      );
    }

    const { id: contractId } = await params;
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, organizationId: effectiveOrgId },
      select: {
        id: true,
        contractSites: { select: { site: { select: { id: true, name: true } } } },
      },
    });
    if (!contract) {
      return NextResponse.json({ error: "Contrat non trouvé" }, { status: 404 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides" },
        { status: 400 }
      );
    }

    const items = await parseRenewalPlan(parsed.data.rows, geminiKey);
    if (items === null) {
      return NextResponse.json(
        { error: "L'analyse IA a échoué — réessayez ou saisissez manuellement" },
        { status: 502 }
      );
    }

    // Rapprochement des sites du contrat (inclusion sur libellés normalisés)
    const sites = contract.contractSites.map((cs) => ({
      id: cs.site.id,
      name: cs.site.name,
      norm: normalize(cs.site.name),
    }));

    const proposals = items.map((item) => {
      let matchedSiteId: string | null = null;
      if (item.siteName) {
        const target = normalize(item.siteName);
        const match =
          sites.find((s) => s.norm === target) ||
          sites.find(
            (s) => s.norm.includes(target) || target.includes(s.norm)
          );
        matchedSiteId = match?.id || null;
      }
      return { ...item, siteId: matchedSiteId };
    });

    return NextResponse.json({
      proposals,
      sites: sites.map(({ id, name }) => ({ id, name })),
    });
  } catch (error) {
    console.error("POST renewal-items/import-ai error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
