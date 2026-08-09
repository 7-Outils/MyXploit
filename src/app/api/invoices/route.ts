import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/invoices - List all invoices
const MAX_PAGE_SIZE = 200;

// Doivent rester alignés sur les enums InvoiceStatus / InvoiceType du schéma.
const INVOICE_STATUSES = ["EN_ATTENTE", "VALIDEE", "REFUSEE"] as const;
const INVOICE_TYPES = ["P1", "P2", "P3", "TRAVAUX", "AUTRE"] as const;

/**
 * GET /api/invoices - Liste les factures.
 *
 * Comme /api/quotes : sans `page`, renvoie le tableau complet (comportement
 * historique) ; avec `page`, renvoie { data, total, page, pageSize } et
 * applique les filtres en SQL.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("contractId");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
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

    const where = {
      organizationId: effectiveOrgId,
      ...(contractId ? { contractId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(type ? { type: type as never } : {}),
    };

    const include = {
      site: { select: { id: true, name: true } },
      contract: { select: { id: true, reference: true, provider: true } },
      acceptedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      refusedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    };

    // Mode historique : tableau nu, sans pagination.
    if (pageParam === null) {
      const invoices = await prisma.invoice.findMany({
        where,
        include,
        orderBy: { issueDate: "desc" },
      });
      return NextResponse.json(invoices);
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
        orderBy: { issueDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
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

    const invoice = await prisma.invoice.create({
      data: {
        reference: body.reference,
        type: body.type,
        status: "EN_ATTENTE",
        amount: parseFloat(body.amount),
        taxAmount: body.taxAmount ? parseFloat(body.taxAmount) : null,
        issueDate: new Date(body.issueDate),
        dueDate: body.dueDate ? new Date(body.dueDate) : new Date(body.issueDate),
        description: body.description,
        p1SubType: body.type === "P1" ? (body.p1SubType || null) : null,
        siteId: body.siteId,
        contractId: body.contractId,
        organizationId: effectiveOrgId,
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la facture" },
      { status: 500 }
    );
  }
}
