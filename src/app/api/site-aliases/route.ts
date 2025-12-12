import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/site-aliases - List all site aliases for the organization
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");

    const where: { organizationId: string; source?: string } = {
      organizationId: user.organizationId,
    };

    if (source) {
      where.source = source;
    }

    const aliases = await prisma.siteAlias.findMany({
      where,
      include: {
        site: {
          select: { id: true, name: true, type: true, city: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(aliases);
  } catch (error) {
    console.error("Error fetching site aliases:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des alias" },
      { status: 500 }
    );
  }
}

// POST /api/site-aliases - Create a new site alias (or batch create)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer des alias" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Support batch creation
    const aliasesToCreate = Array.isArray(body) ? body : [body];

    const created = [];
    const errors = [];

    for (const aliasData of aliasesToCreate) {
      const { alias, siteId, source } = aliasData;
      console.log("Creating alias:", { alias, siteId, source });

      if (!alias || !siteId) {
        errors.push({ alias, error: "Alias et siteId requis" });
        continue;
      }

      // Verify site belongs to organization
      const site = await prisma.site.findFirst({
        where: { id: siteId, organizationId: user.organizationId },
      });

      if (!site) {
        errors.push({ alias, error: "Site non trouvé" });
        continue;
      }

      try {
        // Upsert to handle duplicates gracefully
        const siteAlias = await prisma.siteAlias.upsert({
          where: {
            alias_source_organizationId: {
              alias,
              source: source || null,
              organizationId: user.organizationId,
            },
          },
          update: { siteId },
          create: {
            alias,
            source: source || null,
            siteId,
            organizationId: user.organizationId,
          },
          include: {
            site: {
              select: { id: true, name: true },
            },
          },
        });

        created.push(siteAlias);
      } catch (err) {
        console.error("Error creating alias:", err);
        errors.push({ alias, error: "Erreur lors de la création" });
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
      aliases: created,
    }, { status: created.length > 0 ? 201 : 400 });
  } catch (error) {
    console.error("Error creating site alias:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'alias" },
      { status: 500 }
    );
  }
}

// DELETE /api/site-aliases - Delete site aliases
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer des alias" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const alias = searchParams.get("alias");
    const source = searchParams.get("source");

    if (id) {
      // Delete by ID
      await prisma.siteAlias.delete({
        where: { id, organizationId: user.organizationId },
      });
    } else if (alias) {
      // Delete by alias + source
      await prisma.siteAlias.deleteMany({
        where: {
          alias,
          source: source || null,
          organizationId: user.organizationId,
        },
      });
    } else {
      return NextResponse.json(
        { error: "Veuillez spécifier un id ou alias" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting site alias:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'alias" },
      { status: 500 }
    );
  }
}
