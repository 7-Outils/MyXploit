import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

const MAX_PAGE_SIZE = 200;

// Doit rester aligné sur l'enum QuoteType du schéma Prisma. Sans cette
// validation, un quoteType inconnu fait lever Prisma et renvoie un 500.
const QUOTE_TYPES = ["P3", "P5"] as const;

/**
 * GET /api/quotes - Liste les devis.
 *
 * Deux modes, pour ne pas casser les appelants existants :
 *   - sans `page` : renvoie le tableau complet, comme avant.
 *   - avec `page` : renvoie { data, total, page, pageSize } et applique les
 *     filtres côté SQL. C'est le mode à privilégier, il évite de charger
 *     toute la table pour n'en afficher que 30 lignes.
 *
 * Filtres disponibles dans les deux modes : contractId, siteId, quoteType,
 * dateStart, dateEnd (bornes inclusives sur issueDate).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("contractId");
    const siteId = searchParams.get("siteId");
    const quoteType = searchParams.get("quoteType");
    const dateStart = searchParams.get("dateStart");
    const dateEnd = searchParams.get("dateEnd");
    const pageParam = searchParams.get("page");

    if (quoteType && !QUOTE_TYPES.includes(quoteType as (typeof QUOTE_TYPES)[number])) {
      return NextResponse.json(
        { error: `Type de devis inconnu. Valeurs acceptées : ${QUOTE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const issueDate: { gte?: Date; lte?: Date } = {};
    if (dateStart) {
      const d = new Date(dateStart);
      if (!Number.isNaN(d.getTime())) issueDate.gte = d;
    }
    if (dateEnd) {
      const d = new Date(dateEnd);
      // Borne de fin inclusive : l'utilisateur saisit un jour, pas un instant.
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        issueDate.lte = d;
      }
    }

    const where = {
      organizationId: effectiveOrgId,
      ...(contractId && { contractId }),
      ...(siteId && { siteId }),
      ...(quoteType && { quoteType: quoteType as never }),
      ...(issueDate.gte || issueDate.lte ? { issueDate } : {}),
    };

    const include = {
      site: { select: { id: true, name: true, city: true } },
      contract: { select: { id: true, reference: true, provider: true } },
      items: true,
      acceptedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      refusedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    };

    // Mode historique : tableau nu, sans pagination.
    if (pageParam === null) {
      const quotes = await prisma.quote.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(quotes);
    }

    const parsedPage = Number.parseInt(pageParam, 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const parsedSize = Number.parseInt(searchParams.get("pageSize") ?? "", 10);
    const pageSize =
      Number.isFinite(parsedSize) && parsedSize > 0 ? Math.min(parsedSize, MAX_PAGE_SIZE) : 30;

    const [data, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.quote.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des devis" },
      { status: 500 }
    );
  }
}

// POST /api/quotes - Create a new quote
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un devis" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Récupérer le fournisseur du contrat si non fourni
    let provider = body.provider;
    if (!provider && body.contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: body.contractId },
        select: { provider: true },
      });
      provider = contract?.provider || "Fournisseur";
    }

    const quote = await prisma.quote.create({
      data: {
        reference: body.reference || "DEV-" + Date.now(),
        title: body.title || "Devis importé",
        provider: provider || "Fournisseur",
        client: body.client || null,
        quoteType: body.quoteType || null,
        amountHT: parseFloat(body.amountHT || body.amount || 0),
        amountTVA: body.amountTVA ? parseFloat(body.amountTVA) : null,
        amountTTC: parseFloat(body.amountTTC || body.amount || 0),
        status: body.status || "BROUILLON",
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        description: body.description || null,
        documentUrl: body.documentUrl || null,
        siteId: body.siteId || null,
        contractId: body.contractId || null,
        organizationId: effectiveOrgId,
      },
      include: {
        site: { select: { id: true, name: true } },
        contract: { select: { id: true, reference: true } },
      },
    });

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error("Error creating quote:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du devis" },
      { status: 500 }
    );
  }
}
