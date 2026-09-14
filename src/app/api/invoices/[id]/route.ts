import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { invoiceUpdateSchema } from "@/lib/validations";
import { replaceInvoiceSiteLines, learnBillingAliases } from "@/lib/invoice-site-lines";

/** Lignes de répartition renvoyées telles quelles aux écrans d'édition. */
const siteLinesInclude = {
  select: {
    id: true,
    label: true,
    amountHT: true,
    sortOrder: true,
    siteId: true,
    site: { select: { id: true, name: true } },
  },
  orderBy: { sortOrder: "asc" as const },
};

// GET /api/invoices/[id] - Get a single invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
      include: {
        site: true,
        contract: true,
        siteLines: siteLinesInclude,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la facture" },
      { status: 500 }
    );
  }
}

// PUT /api/invoices/[id] - Update an invoice
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier une facture" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const parsedBody = invoiceUpdateSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Données invalides" },
        { status: 400 }
      );
    }
    const input = parsedBody.data;

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    // Une facture validée ou refusée est figée : elle alimente (ou pas) le
    // solde P3 tel qu'elle a été décidée. La règle est ici, pas seulement dans
    // l'affichage des boutons.
    if (existingInvoice.status !== "EN_ATTENTE") {
      return NextResponse.json(
        { error: "Facture validée ou refusée : elle n'est plus modifiable" },
        { status: 409 }
      );
    }

    // Le sous-type suit le type : repasser une facture P1 en P2 doit vider le
    // sous-type, sinon il reste affiché à côté d'un type qui ne le porte pas.
    const nextType = input.type ?? existingInvoice.type;
    const nextP1SubType =
      nextType !== "P1"
        ? null
        : input.p1SubType !== undefined
          ? input.p1SubType || null
          : existingInvoice.p1SubType;

    // `lines` absent = le client ne touche pas à la répartition (édition
    // partielle) ; `lines: []` = il la vide explicitement.
    const nextLines = input.lines;
    const nextContractId =
      input.contractId !== undefined ? (input.contractId ?? null) : existingInvoice.contractId;

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: {
          ...(input.reference !== undefined && { reference: input.reference }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.nature !== undefined && { nature: input.nature ?? null }),
          ...(input.amount !== undefined && { amount: input.amount }),
          ...(input.taxAmount !== undefined && { taxAmount: input.taxAmount ?? null }),
          ...(input.issueDate !== undefined && { issueDate: new Date(input.issueDate) }),
          ...(input.dueDate ? { dueDate: new Date(input.dueDate) } : {}),
          ...(input.periodStart !== undefined && {
            periodStart: input.periodStart ? new Date(input.periodStart) : null,
          }),
          ...(input.periodEnd !== undefined && {
            periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
          }),
          ...(input.description !== undefined && { description: input.description ?? null }),
          ...(input.documentUrl !== undefined && { documentUrl: input.documentUrl ?? null }),
          ...(input.siteId !== undefined && { siteId: input.siteId ?? null }),
          ...(input.contractId !== undefined && { contractId: input.contractId ?? null }),
          p1SubType: nextP1SubType,
          // Facture répartie : pas de site global en plus des lignes.
          ...(nextLines && nextLines.length > 0 ? { siteId: null } : {}),
        },
      });

      const resolvedLines = nextLines
        ? await replaceInvoiceSiteLines(tx, {
            invoiceId: id,
            contractId: nextContractId,
            organizationId: effectiveOrgId,
            lines: nextLines,
          })
        : [];

      const full = await tx.invoice.findUniqueOrThrow({
        where: { id },
        include: {
          site: { select: { id: true, name: true, city: true } },
          contract: { select: { id: true, reference: true, provider: true } },
          siteLines: siteLinesInclude,
        },
      });
      return { full, resolvedLines };
    }, { timeout: 20_000 });

    // Hors transaction : perdre un alias n'a aucune conséquence financière.
    await learnBillingAliases(prisma, {
      contractId: nextContractId,
      organizationId: effectiveOrgId,
      lines: invoice.resolvedLines,
    });

    return NextResponse.json(invoice.full);
  } catch (error) {
    console.error("Error updating invoice:", error);
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Une facture avec cette référence existe déjà sur ce contrat" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la facture" },
      { status: 500 }
    );
  }
}

// DELETE /api/invoices/[id] - Delete an invoice
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer une facture" },
        { status: 403 }
      );
    }

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    if (existingInvoice.status !== "EN_ATTENTE") {
      return NextResponse.json(
        { error: "Facture validée ou refusée : elle ne peut plus être supprimée" },
        { status: 409 }
      );
    }

    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la facture" },
      { status: 500 }
    );
  }
}
