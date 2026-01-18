import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/audit-checkpoints - Get all active checkpoints for audit
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const checkpoints = await prisma.auditCheckPoint.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });

    // Also fetch recommendations for linking
    const recommendations = await prisma.recommendationLibrary.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        priceUnit: true,
        priority: true,
        category: true,
      },
    });

    return NextResponse.json({
      checkpoints,
      recommendations,
    });
  } catch (error) {
    console.error("Error fetching audit checkpoints:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des points de contrôle" },
      { status: 500 }
    );
  }
}
