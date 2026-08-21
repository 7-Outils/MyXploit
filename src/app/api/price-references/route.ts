import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// Le référentiel est modifiable par tous sauf lecture seule
function requireAdmin(role: string) {
  return role !== "READER";
}

// GET /api/price-references - Résumé du référentiel de prix de l'organisation
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const [count, latest] = await Promise.all([
      prisma.priceReference.count({ where: { organizationId: effectiveOrgId } }),
      prisma.priceReference.findFirst({
        where: { organizationId: effectiveOrgId },
        select: { source: true },
      }),
    ]);

    return NextResponse.json({ count, source: latest?.source ?? null });
  } catch (error) {
    console.error("Error fetching price references summary:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du référentiel" },
      { status: 500 }
    );
  }
}

interface IncomingRow {
  code: string;
  lot?: string | null;
  corpsEtat?: string | null;
  designation: string;
  unit?: string | null;
  laborHours?: number | null;
  laborCost?: number | null;
  suppliesCost?: number | null;
  sellPriceHT?: number | null;
  installOnly?: number | null;
  description?: string | null;
}

// POST /api/price-references - Import par lots (le client envoie le CSV
// parsé en paquets de quelques milliers de lignes, le premier avec
// replace=true pour repartir de zéro)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (!requireAdmin(user.role)) {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour gérer le référentiel de prix" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const rows: IncomingRow[] = Array.isArray(body.rows) ? body.rows : [];
    const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "Import";
    const replace = body.replace === true;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Aucune ligne fournie" }, { status: 400 });
    }
    if (rows.length > 5000) {
      return NextResponse.json(
        { error: "Trop de lignes par lot (max 5000) : découpez l'envoi" },
        { status: 400 }
      );
    }

    const clean = rows
      .filter((r) => r && typeof r.code === "string" && r.code.trim() && typeof r.designation === "string" && r.designation.trim())
      .map((r) => ({
        code: r.code.trim(),
        lot: r.lot?.toString().trim() || null,
        corpsEtat: r.corpsEtat?.toString().trim() || null,
        designation: r.designation.trim(),
        unit: r.unit?.toString().trim() || null,
        laborHours: typeof r.laborHours === "number" ? r.laborHours : null,
        laborCost: typeof r.laborCost === "number" ? r.laborCost : null,
        suppliesCost: typeof r.suppliesCost === "number" ? r.suppliesCost : null,
        sellPriceHT: typeof r.sellPriceHT === "number" ? r.sellPriceHT : null,
        installOnly: typeof r.installOnly === "number" ? r.installOnly : null,
        description: r.description?.toString().trim() || null,
        source,
        organizationId: effectiveOrgId,
      }));

    if (replace) {
      await prisma.priceReference.deleteMany({ where: { organizationId: effectiveOrgId } });
    }

    const result = await prisma.priceReference.createMany({
      data: clean,
      skipDuplicates: true, // doublons de code dans le fichier : première occurrence gagne
    });

    return NextResponse.json({ inserted: result.count, skipped: rows.length - result.count });
  } catch (error) {
    console.error("Error importing price references:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import du référentiel" },
      { status: 500 }
    );
  }
}

// DELETE /api/price-references - Vider le référentiel
export async function DELETE() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (!requireAdmin(user.role)) {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour gérer le référentiel de prix" },
        { status: 403 }
      );
    }

    const result = await prisma.priceReference.deleteMany({
      where: { organizationId: effectiveOrgId },
    });
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("Error deleting price references:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du référentiel" },
      { status: 500 }
    );
  }
}
