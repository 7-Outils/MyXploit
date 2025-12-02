import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/alerts - List all alerts
export async function GET() {
  try {
    const user = await requireAuth();

    const alerts = await prisma.alert.findMany({
      where: { organizationId: user.organizationId },
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des alertes" },
      { status: 500 }
    );
  }
}

// POST /api/alerts - Create a new alert
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer une alerte" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const alert = await prisma.alert.create({
      data: {
        type: body.type || "AUTRE",
        priority: body.priority || "MOYENNE",
        title: body.title || "Nouvelle alerte",
        message: body.message,
        isRead: false,
        siteId: body.siteId || null,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error("Error creating alert:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'alerte" },
      { status: 500 }
    );
  }
}
