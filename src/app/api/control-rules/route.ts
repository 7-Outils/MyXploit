import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { EquipmentType } from "@/generated/prisma/enums";

/**
 * Règles de contrôle réglementaire par type d'équipement.
 * Une règle dit « ce type se contrôle tous les n mois » ; la conformité du parc
 * se déduit ensuite des contrôles enregistrés sur chaque fiche.
 */

/** Jeu de départ proposé à la première ouverture (obligations CVC courantes). */
const DEFAULT_RULES: Array<{
  equipmentType: string;
  name: string;
  frequencyMonths: number;
}> = [
  { equipmentType: "DISCONNECTEUR", name: "Contrôle annuel disconnecteur", frequencyMonths: 12 },
  { equipmentType: "SOUPAPE_SECURITE", name: "Vérification soupape de sécurité", frequencyMonths: 12 },
  { equipmentType: "CHAUDIERE", name: "Entretien annuel chaudière", frequencyMonths: 12 },
  { equipmentType: "CHAUDIERE_CONDENSATION", name: "Entretien annuel chaudière", frequencyMonths: 12 },
  { equipmentType: "BALLON_ECS", name: "Contrôle température ECS / légionelle", frequencyMonths: 12 },
  { equipmentType: "BALLON_THERMODYNAMIQUE", name: "Contrôle température ECS / légionelle", frequencyMonths: 12 },
  { equipmentType: "VASE_EXPANSION", name: "Vérification pression de gonflage", frequencyMonths: 12 },
  { equipmentType: "CTA", name: "Vérification ventilation", frequencyMonths: 12 },
  { equipmentType: "ADOUCISSEUR", name: "Entretien adoucisseur", frequencyMonths: 12 },
  { equipmentType: "GROUPE_FROID", name: "Contrôle étanchéité fluides frigorigènes", frequencyMonths: 12 },
  { equipmentType: "PAC", name: "Contrôle étanchéité fluides frigorigènes", frequencyMonths: 12 },
  { equipmentType: "PAC_AIR_EAU", name: "Contrôle étanchéité fluides frigorigènes", frequencyMonths: 12 },
  { equipmentType: "SPLIT", name: "Contrôle étanchéité fluides frigorigènes", frequencyMonths: 12 },
  { equipmentType: "CLIMATISEUR", name: "Contrôle étanchéité fluides frigorigènes", frequencyMonths: 12 },
];

function isEquipmentType(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(EquipmentType, value)
  );
}

// GET /api/control-rules — règles de l'organisation (seed au premier appel)
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    const count = await prisma.equipmentControlRule.count({
      where: { organizationId: effectiveOrgId },
    });

    if (count === 0) {
      await prisma.equipmentControlRule.createMany({
        data: DEFAULT_RULES.map((rule) => ({
          ...rule,
          organizationId: effectiveOrgId,
        })),
      });
    }

    const rules = await prisma.equipmentControlRule.findMany({
      where: { organizationId: effectiveOrgId },
      orderBy: [{ equipmentType: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("GET /api/control-rules error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/control-rules — nouvelle règle
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer une règle" },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!isEquipmentType(body.equipmentType)) {
      return NextResponse.json(
        { error: "Type d'équipement invalide" },
        { status: 400 }
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Le nom du contrôle est obligatoire" },
        { status: 400 }
      );
    }

    const frequencyMonths = Number(body.frequencyMonths);
    if (
      !Number.isInteger(frequencyMonths) ||
      frequencyMonths < 1 ||
      frequencyMonths > 120
    ) {
      return NextResponse.json(
        { error: "La fréquence doit être un nombre de mois entre 1 et 120" },
        { status: 400 }
      );
    }

    const rule = await prisma.equipmentControlRule.create({
      data: {
        equipmentType: body.equipmentType,
        name,
        frequencyMonths,
        organizationId: effectiveOrgId,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("POST /api/control-rules error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
