import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/platform/stats - Stats globales plateforme (SUPER_ADMIN only)
export async function GET() {
  try {
    const user = await requireAuth();

    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Acces reserve aux super administrateurs" },
        { status: 403 }
      );
    }

    const [orgCount, userCount, siteCount, contractCount, recentOrgs] =
      await Promise.all([
        prisma.organization.count(),
        prisma.user.count(),
        prisma.site.count(),
        prisma.contract.count(),
        prisma.organization.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: {
                users: true,
                sites: true,
                contracts: true,
              },
            },
          },
        }),
      ]);

    return NextResponse.json({
      stats: {
        organizations: orgCount,
        users: userCount,
        sites: siteCount,
        contracts: contractCount,
      },
      recentOrganizations: recentOrgs,
    });
  } catch (error) {
    console.error("Error fetching platform stats:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des stats" },
      { status: 500 }
    );
  }
}
