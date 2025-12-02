import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/invoices/[id] - Get a single invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        site: true,
        contract: true,
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
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier une facture" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...(body.reference && { reference: body.reference }),
        ...(body.type && { type: body.type }),
        ...(body.status && { status: body.status }),
        ...(body.amount && { amount: parseFloat(body.amount) }),
        ...(body.taxAmount !== undefined && {
          taxAmount: body.taxAmount ? parseFloat(body.taxAmount) : null,
        }),
        ...(body.issueDate && { issueDate: new Date(body.issueDate) }),
        ...(body.dueDate && { dueDate: new Date(body.dueDate) }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.siteId !== undefined && {
          siteId: body.siteId || null,
        }),
        ...(body.contractId !== undefined && {
          contractId: body.contractId || null,
        }),
      },
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error updating invoice:", error);
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
    const { id } = await params;

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer une facture" },
        { status: 403 }
      );
    }

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
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
