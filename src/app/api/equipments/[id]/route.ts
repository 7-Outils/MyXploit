import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { TYPE_TO_DOMAIN } from "@/lib/equipment-domain";
import { EquipmentType } from "@/generated/prisma/enums";

// GET /api/equipments/[id] - Get a single equipment with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    const equipment = await prisma.equipment.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
      include: {
        site: {
          select: { id: true, name: true, city: true, address: true },
        },
        audits: {
          orderBy: { auditDate: "desc" },
        },
      },
    });

    if (!equipment) {
      return NextResponse.json(
        { error: "Équipement non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'équipement" },
      { status: 500 }
    );
  }
}

// PUT /api/equipments/[id] - Update an equipment
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
        { error: "Vous n'avez pas les droits pour modifier cet équipement" },
        { status: 403 }
      );
    }

    // Verify equipment belongs to organization
    const existingEquipment = await prisma.equipment.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
    });

    if (!existingEquipment) {
      return NextResponse.json(
        { error: "Équipement non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const equipment = await prisma.equipment.update({
      where: { id },
      data: {
        name: body.name || null,
        domain: body.domain,
        type: body.type,
        brand: body.brand || null,
        model: body.model || null,
        serialNumber: body.serialNumber || null,
        imageUrl: body.imageUrl || null,
        year: body.year ? parseInt(body.year) : null,
        power: body.power ? parseFloat(body.power) : null,
        quantity: body.quantity ? parseInt(body.quantity) : null,
        location: body.location || null,
        level: body.level || null,
        serviceArea: body.serviceArea || null,
        inContractList: body.inContractList ?? true,
        presentOnSite: body.presentOnSite ?? true,
        theoreticalLifespan: body.theoreticalLifespan
          ? parseInt(body.theoreticalLifespan)
          : null,
        status: body.status,
        installDate: body.installDate ? new Date(body.installDate) : null,
        warrantyEnd: body.warrantyEnd ? new Date(body.warrantyEnd) : null,
      },
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error updating equipment:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'équipement" },
      { status: 500 }
    );
  }
}

// PATCH /api/equipments/[id] - Partial update of an equipment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour modifier cet équipement" },
        { status: 403 }
      );
    }

    // Verify equipment belongs to organization
    const existingEquipment = await prisma.equipment.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
    });

    if (!existingEquipment) {
      return NextResponse.json(
        { error: "Équipement non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name || null;
    if (body.brand !== undefined) updateData.brand = body.brand || null;
    if (body.model !== undefined) updateData.model = body.model || null;
    if (body.year !== undefined) updateData.year = body.year ? parseInt(body.year) : null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.domain !== undefined) updateData.domain = body.domain;
    if (body.type !== undefined) {
      // Le type est un enum Prisma : une valeur inconnue ferait échouer l'update
      // en 500, on la refuse en 400 comme la validation du POST.
      if (!Object.prototype.hasOwnProperty.call(EquipmentType, body.type)) {
        return NextResponse.json(
          { error: "Type d'équipement invalide" },
          { status: 400 }
        );
      }
      updateData.type = body.type;
      // Le domaine découle du type : on le recalcule si l'appelant ne l'impose pas,
      // sinon la fiche resterait classée dans l'ancien domaine (filtres, synthèse).
      if (body.domain === undefined) {
        updateData.domain = TYPE_TO_DOMAIN[body.type] || "AUTRE";
      }
    }
    if (body.siteId !== undefined) {
      // Déplacer un équipement vers un autre site : le site cible doit appartenir
      // à la même organisation (même contrôle que POST /api/equipments).
      const site = await prisma.site.findFirst({
        where: { id: body.siteId, organizationId: effectiveOrgId },
        select: { id: true },
      });
      if (!site) {
        return NextResponse.json({ error: "Site non trouvé" }, { status: 404 });
      }
      updateData.siteId = body.siteId;
    }
    if (body.serialNumber !== undefined) updateData.serialNumber = body.serialNumber || null;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl || null;
    if (body.power !== undefined) updateData.power = body.power ? parseFloat(body.power) : null;
    if (body.quantity !== undefined) updateData.quantity = body.quantity ? parseInt(body.quantity) : null;
    if (body.location !== undefined) updateData.location = body.location || null;
    if (body.level !== undefined) updateData.level = body.level || null;
    if (body.serviceArea !== undefined) updateData.serviceArea = body.serviceArea || null;
    if (body.inContractList !== undefined) updateData.inContractList = body.inContractList;
    if (body.presentOnSite !== undefined) updateData.presentOnSite = body.presentOnSite;
    if (body.theoreticalLifespan !== undefined) updateData.theoreticalLifespan = body.theoreticalLifespan ? parseInt(body.theoreticalLifespan) : null;
    if (body.installDate !== undefined) updateData.installDate = body.installDate ? new Date(body.installDate) : null;
    if (body.warrantyEnd !== undefined) updateData.warrantyEnd = body.warrantyEnd ? new Date(body.warrantyEnd) : null;

    const equipment = await prisma.equipment.update({
      where: { id },
      data: updateData,
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(equipment);
  } catch (error) {
    console.error("Error updating equipment:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'équipement" },
      { status: 500 }
    );
  }
}

// DELETE /api/equipments/[id] - Delete an equipment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id } = await params;

    // Supprimer un équipement saisi par erreur est un geste d'édition normal :
    // même règle que la création/modification (seul READER est bloqué).
    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour supprimer un équipement" },
        { status: 403 }
      );
    }

    // Verify equipment belongs to organization
    const existingEquipment = await prisma.equipment.findFirst({
      where: {
        id,
        organizationId: effectiveOrgId,
      },
    });

    if (!existingEquipment) {
      return NextResponse.json(
        { error: "Équipement non trouvé" },
        { status: 404 }
      );
    }

    await prisma.equipment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting equipment:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'équipement" },
      { status: 500 }
    );
  }
}
