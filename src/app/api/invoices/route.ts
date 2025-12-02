import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/invoices - List all invoices
export async function GET() {
  try {
    const user = await requireAuth();

    const invoices = await prisma.invoice.findMany({
      where: { organizationId: user.organizationId },
      include: {
        site: {
          select: { id: true, name: true },
        },
        contract: {
          select: { id: true, reference: true, provider: true },
        },
      },
      orderBy: { issueDate: "desc" },
    });

    return NextResponse.json(invoices);
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
        status: body.status || "BROUILLON",
        amount: parseFloat(body.amount),
        taxAmount: body.taxAmount ? parseFloat(body.taxAmount) : null,
        issueDate: new Date(body.issueDate),
        dueDate: new Date(body.dueDate),
        description: body.description,
        siteId: body.siteId,
        contractId: body.contractId,
        organizationId: user.organizationId,
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
