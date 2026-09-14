import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { invoiceCreateSchema } from "@/lib/validations";
import { replaceInvoiceSiteLines, learnBillingAliases } from "@/lib/invoice-site-lines";
import { installmentOf } from "@/lib/invoice-installment";

// Rang d'acompte calculé à la lecture : il dépend de la date anniversaire du
// contrat, qui peut changer — rien à stocker.
// Seul un ACOMPTE a un rang : « 4/4 » n'a aucun sens sur un décompte, un avoir
// ou un intéressement, qui ne s'inscrivent pas dans une série périodique.
function withInstallment<T extends {
  nature: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  contract: { startDate: Date | null } | null;
}>(invoice: T) {
  return {
    ...invoice,
    installment:
      invoice.nature === "ACOMPTE"
        ? installmentOf(invoice.periodStart, invoice.periodEnd, invoice.contract?.startDate)
        : null,
  };
}

// GET /api/invoices - List all invoices
const MAX_PAGE_SIZE = 200;

// Doivent rester alignés sur les enums InvoiceStatus / InvoiceType du schéma.
const INVOICE_STATUSES = ["EN_ATTENTE", "VALIDEE", "REFUSEE"] as const;
const INVOICE_TYPES = ["P1", "P2", "P3", "AUTRE"] as const;
const INVOICE_NATURES = ["ACOMPTE", "DECOMPTE", "AVOIR", "INTERESSEMENT", "AUTRE"] as const;

/**
 * GET /api/invoices - Liste les factures.
 *
 * Comme /api/quotes : sans `page`, renvoie le tableau complet (comportement
 * historique) ; avec `page`, renvoie { data, total, page, pageSize } et
 * applique les filtres en SQL.
 *
 * Filtres : contractId, siteId, status, type, dateStart, dateEnd (bornes
 * inclusives sur issueDate). Tri : sort + dir, liste blanche.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("contractId");
    const siteId = searchParams.get("siteId");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const nature = searchParams.get("nature");
    const dateStart = searchParams.get("dateStart");
    const dateEnd = searchParams.get("dateEnd");
    const pageParam = searchParams.get("page");

    if (status && !INVOICE_STATUSES.includes(status as (typeof INVOICE_STATUSES)[number])) {
      return NextResponse.json(
        { error: `Statut inconnu. Valeurs acceptées : ${INVOICE_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    if (type && !INVOICE_TYPES.includes(type as (typeof INVOICE_TYPES)[number])) {
      return NextResponse.json(
        { error: `Type de facture inconnu. Valeurs acceptées : ${INVOICE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (nature && !INVOICE_NATURES.includes(nature as (typeof INVOICE_NATURES)[number])) {
      return NextResponse.json(
        { error: `Nature de facture inconnue. Valeurs acceptées : ${INVOICE_NATURES.join(", ")}` },
        { status: 400 }
      );
    }

    // Tri piloté par l'en-tête du tableau. Liste blanche : une colonne
    // inconnue retombe sur le tri par défaut, jamais sur une erreur.
    const SORTABLE = {
      issueDate: "issueDate",
      reference: "reference",
      type: "type",
      amount: "amount",
      status: "status",
      site: "site",
    } as const;
    const sortParam = searchParams.get("sort") as keyof typeof SORTABLE | null;
    const dir: "asc" | "desc" = searchParams.get("dir") === "asc" ? "asc" : "desc";
    const orderBy =
      sortParam && sortParam in SORTABLE
        ? sortParam === "site"
          ? [{ site: { name: dir } }, { createdAt: "desc" as const }]
          : [{ [SORTABLE[sortParam]]: dir }, { createdAt: "desc" as const }]
        : [{ issueDate: "desc" as const }, { createdAt: "desc" as const }];

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
      ...(contractId ? { contractId } : {}),
      // Filtre site : une facture répartie porte le site dans ses LIGNES, pas
      // dans son champ siteId (qui reste vide). Ignorer les lignes ferait
      // disparaître du filtre les factures multi-sites, les plus nombreuses.
      ...(siteId ? { OR: [{ siteId }, { siteLines: { some: { siteId } } }] } : {}),
      ...(status ? { status: status as never } : {}),
      ...(type ? { type: type as never } : {}),
      ...(nature ? { nature: nature as never } : {}),
      ...(issueDate.gte || issueDate.lte ? { issueDate } : {}),
    };

    const include = {
      site: { select: { id: true, name: true, city: true } },
      contract: { select: { id: true, reference: true, provider: true, startDate: true } },
      acceptedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      refusedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      // Le seul siteId suffit à la liste : elle en déduit le nombre de lignes
      // et combien restent non rattachées, sans requête de comptage séparée.
      siteLines: { select: { siteId: true } },
    };

    // Mode historique : tableau nu, sans pagination.
    if (pageParam === null) {
      const invoices = await prisma.invoice.findMany({
        where,
        include,
        orderBy,
      });
      return NextResponse.json(invoices.map(withInstallment));
    }

    const parsedPage = Number.parseInt(pageParam, 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const parsedSize = Number.parseInt(searchParams.get("pageSize") ?? "", 10);
    const pageSize =
      Number.isFinite(parsedSize) && parsedSize > 0 ? Math.min(parsedSize, MAX_PAGE_SIZE) : 30;

    const [data, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({ data: data.map(withInstallment), total, page, pageSize });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des factures" },
      { status: 500 }
    );
  }
}

// POST /api/invoices - Create a new invoice
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer une facture" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const parsedBody = invoiceCreateSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Données invalides" },
        { status: 400 }
      );
    }
    const input = parsedBody.data;

    const lines = input.lines ?? [];

    // Garde-fou doublon : même référence sur le même contrat (ou, sans
    // contrat, dans l'organisation). Comparaison insensible à la casse.
    const duplicate = await prisma.invoice.findFirst({
      where: {
        organizationId: effectiveOrgId,
        reference: { equals: input.reference.trim(), mode: "insensitive" },
        ...(input.contractId ? { contractId: input.contractId } : {}),
      },
      select: { id: true, reference: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `La facture ${duplicate.reference} existe déjà sur ce contrat`, existingInvoiceId: duplicate.id },
        { status: 409 }
      );
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          reference: input.reference,
          type: input.type,
          nature: input.nature ?? null,
          status: "EN_ATTENTE",
          amount: input.amount,
          taxAmount: input.taxAmount ?? null,
          issueDate: new Date(input.issueDate),
          dueDate: input.dueDate ? new Date(input.dueDate) : new Date(input.issueDate),
          periodStart: input.periodStart ? new Date(input.periodStart) : null,
          periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
          description: input.description ?? null,
          p1SubType: input.type === "P1" ? (input.p1SubType || null) : null,
          // PDF déjà archivé dans R2 par la route d'import : on ne conserve que
          // l'URL renvoyée, jamais une URL arbitraire venue du navigateur.
          documentUrl: input.documentUrl ?? null,
          // Facture répartie : le site global n'a pas de sens, la répartition
          // porte l'information. Les deux à la fois compteraient double.
          siteId: lines.length > 0 ? null : (input.siteId ?? null),
          contractId: input.contractId ?? null,
          organizationId: effectiveOrgId,
        },
      });

      const resolvedLines = await replaceInvoiceSiteLines(tx, {
        invoiceId: created.id,
        contractId: input.contractId ?? null,
        organizationId: effectiveOrgId,
        lines,
      });

      const full = await tx.invoice.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          site: { select: { id: true, name: true, city: true } },
          contract: { select: { id: true, reference: true, provider: true, startDate: true } },
          siteLines: {
            select: {
              id: true,
              label: true,
              amountHT: true,
              sortOrder: true,
              siteId: true,
              site: { select: { id: true, name: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
      return { full, resolvedLines };
    // 66 lignes + lecture finale : au-delà des 5 s par défaut de Prisma sur Neon.
    }, { timeout: 20_000 });

    // Hors transaction : la mémoire des rapprochements n'a pas à pouvoir faire
    // échouer une facture déjà écrite.
    await learnBillingAliases(prisma, {
      contractId: input.contractId ?? null,
      organizationId: effectiveOrgId,
      lines: invoice.resolvedLines,
    });

    return NextResponse.json(invoice.full, { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      // La cause remonte à l'écran : un « erreur » nu oblige à aller lire les
      // logs Vercel pour savoir si c'est le schéma, un délai ou une validation.
      {
        error: `Erreur lors de la création de la facture : ${
          error instanceof Error ? error.message.split("\n")[0].slice(0, 200) : "cause inconnue"
        }`,
      },
      { status: 500 }
    );
  }
}
