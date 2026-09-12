import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { monthUsageUsd } from "@/lib/ai-usage";

// Au-delà, la page n'est plus lisible et la requête devient coûteuse : le
// détail se consulte en resserrant la période.
const MAX_CALLS = 500;

/**
 * GET /api/admin/ai-usage?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Consommation IA de l'organisation sur la période (mois courant par
 * défaut) : agrégat par client pour la refacturation, et le détail des
 * appels pour comprendre une ligne qui surprend.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    let from = defaultFrom;
    if (fromParam) {
      const d = new Date(`${fromParam}T00:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) from = d;
    }

    // Borne de fin inclusive : l'utilisateur saisit un jour, pas un instant.
    let to: Date | null = null;
    if (toParam) {
      const d = new Date(`${toParam}T23:59:59.999Z`);
      if (!Number.isNaN(d.getTime())) to = d;
    }

    const where = {
      organizationId: effectiveOrgId,
      createdAt: { gte: from, ...(to ? { lte: to } : {}) },
    };

    const [org, monthUsedUsd, rows] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: effectiveOrgId },
        select: { aiMonthlyBudgetUsd: true },
      }),
      // Toujours le mois calendaire courant : c'est lui que le plafond borne,
      // indépendamment de la période affichée.
      monthUsageUsd(effectiveOrgId),
      prisma.aiUsage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: MAX_CALLS,
        select: {
          id: true,
          createdAt: true,
          feature: true,
          provider: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          costUsd: true,
          durationMs: true,
          ok: true,
          error: true,
          clientId: true,
          client: { select: { name: true } },
          contract: { select: { reference: true } },
          quote: { select: { reference: true } },
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    // L'agrégat par client porte sur toute la période, pas seulement sur les
    // 500 appels listés : un total tronqué serait un total faux.
    const grouped = await prisma.aiUsage.groupBy({
      by: ["clientId"],
      where,
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
    });

    const failedByClient = await prisma.aiUsage.groupBy({
      by: ["clientId"],
      where: { ...where, ok: false },
      _count: { _all: true },
    });
    const failedMap = new Map(failedByClient.map((g) => [g.clientId, g._count._all]));

    const clientIds = grouped.map((g) => g.clientId).filter((id): id is string => !!id);
    const clients = clientIds.length
      ? await prisma.client.findMany({
          where: { id: { in: clientIds }, organizationId: effectiveOrgId },
          select: { id: true, name: true },
        })
      : [];
    const clientNames = new Map(clients.map((c) => [c.id, c.name]));

    const byClient = grouped
      .map((g) => ({
        clientId: g.clientId,
        clientName: g.clientId ? (clientNames.get(g.clientId) ?? "Client supprimé") : "Sans client",
        calls: g._count._all,
        failed: failedMap.get(g.clientId) ?? 0,
        inputTokens: g._sum.inputTokens ?? 0,
        outputTokens: g._sum.outputTokens ?? 0,
        costUsd: g._sum.costUsd ?? 0,
      }))
      .sort((a, b) => b.costUsd - a.costUsd);

    const calls = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      feature: r.feature,
      provider: r.provider,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      costUsd: r.costUsd,
      durationMs: r.durationMs,
      ok: r.ok,
      error: r.error,
      clientId: r.clientId,
      clientName: r.client?.name ?? "Sans client",
      contractRef: r.contract?.reference ?? null,
      quoteRef: r.quote?.reference ?? null,
      userName: r.user
        ? [r.user.firstName, r.user.lastName].filter(Boolean).join(" ") || r.user.email
        : null,
    }));

    return NextResponse.json({
      budgetUsd: org?.aiMonthlyBudgetUsd ?? 0,
      monthUsedUsd,
      byClient,
      calls,
    });
  } catch (error) {
    console.error("Error fetching AI usage:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la consommation IA" },
      { status: 500 }
    );
  }
}
