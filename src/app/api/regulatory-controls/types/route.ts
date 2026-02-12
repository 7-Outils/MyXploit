import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// Templates par défaut CVC
const DEFAULT_CONTROL_TYPES = [
  {
    name: "Ramonage conduit fumée",
    category: "COMBUSTION" as const,
    description: "Ramonage des conduits de fumée des chaudières gaz/fioul",
    regulatoryRef: "Arrêté du 15/09/2009 - RSDT",
    frequency: "ANNUEL" as const,
    frequencyMonths: 12,
    applicableDomains: ["CHAUFFAGE" as const],
  },
  {
    name: "Contrôle combustion chaudière",
    category: "COMBUSTION" as const,
    description: "Mesure des rendements de combustion et taux de CO/CO2",
    regulatoryRef: "Arrêté du 02/10/2009 (rendement > 400kW)",
    frequency: "ANNUEL" as const,
    frequencyMonths: 12,
    applicableDomains: ["CHAUFFAGE" as const],
  },
  {
    name: "Vérification installation gaz",
    category: "GAZ" as const,
    description: "Vérification de l'étanchéité et conformité de l'installation gaz",
    regulatoryRef: "Arrêté du 02/08/1977 modifié",
    frequency: "ANNUEL" as const,
    frequencyMonths: 12,
    applicableDomains: ["CHAUFFAGE" as const],
  },
  {
    name: "Analyse légionelle ECS",
    category: "LEGIONELLE" as const,
    description: "Prélèvement et analyse bactériologique légionella dans les réseaux ECS",
    regulatoryRef: "Arrêté du 01/02/2010 - ERP",
    frequency: "ANNUEL" as const,
    frequencyMonths: 12,
    applicableDomains: ["ECS" as const],
  },
  {
    name: "Carnet sanitaire ECS",
    category: "LEGIONELLE" as const,
    description: "Mise à jour du carnet sanitaire, relevé températures, purges",
    regulatoryRef: "Arrêté du 01/02/2010",
    frequency: "MENSUEL" as const,
    frequencyMonths: 1,
    applicableDomains: ["ECS" as const],
  },
  {
    name: "Contrôle étanchéité fluide frigorigène",
    category: "FLUIDE_FRIGORIGENE" as const,
    description: "Détection de fuites sur les circuits frigorifiques (PAC, climatisation)",
    regulatoryRef: "Règlement UE 517/2014 (F-Gas)",
    frequency: "ANNUEL" as const,
    frequencyMonths: 12,
    applicableDomains: ["CLIMATISATION" as const, "CHAUFFAGE" as const],
    minPowerKw: 5,
  },
  {
    name: "Vérification disconnecteurs",
    category: "PRESSION" as const,
    description: "Vérification et test des disconnecteurs de protection réseau eau",
    regulatoryRef: "Arrêté du 10/09/2021",
    frequency: "ANNUEL" as const,
    frequencyMonths: 12,
    applicableDomains: ["TRAITEMENT_EAU" as const, "PLOMBERIE" as const],
  },
  {
    name: "Contrôle aéraulique VMC/CTA",
    category: "AERAULIQUE" as const,
    description: "Mesure des débits, vérification filtres, état des réseaux aérauliques",
    regulatoryRef: "Code du travail R4222 / RT applicable",
    frequency: "ANNUEL" as const,
    frequencyMonths: 12,
    applicableDomains: ["VENTILATION" as const],
  },
  {
    name: "Inspection chaudière > 400kW",
    category: "COMBUSTION" as const,
    description: "Inspection périodique des chaudières de puissance > 400kW",
    regulatoryRef: "Arrêté du 02/10/2009",
    frequency: "BIENNAL" as const,
    frequencyMonths: 24,
    applicableDomains: ["CHAUFFAGE" as const],
    minPowerKw: 400,
  },
  {
    name: "Vérification électrique",
    category: "ELECTRIQUE" as const,
    description: "Vérification périodique des installations électriques (TGBT, armoires)",
    regulatoryRef: "Arrêté du 26/12/2011 - Code du travail",
    frequency: "ANNUEL" as const,
    frequencyMonths: 12,
    applicableDomains: ["CFO_CFA" as const],
  },
  {
    name: "Traitement d'eau chauffage",
    category: "EAU" as const,
    description: "Analyse et traitement de l'eau des circuits de chauffage (TH, pH, embouage)",
    regulatoryRef: "DTU 60.1 / Recommandations COSTIC",
    frequency: "ANNUEL" as const,
    frequencyMonths: 12,
    applicableDomains: ["TRAITEMENT_EAU" as const, "CHAUFFAGE" as const],
  },
];

/**
 * GET /api/regulatory-controls/types
 * Liste des types de contrôle de l'organisation
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    const types = await prisma.regulatoryControlType.findMany({
      where: { organizationId: effectiveOrgId, isActive: true },
      include: {
        _count: { select: { controls: true } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(types);
  } catch (error) {
    console.error("GET /api/regulatory-controls/types error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/regulatory-controls/types
 * Créer un type de contrôle ou initialiser les templates par défaut
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Action spéciale : initialiser les templates par défaut
    if (body.action === "init-defaults") {
      const existing = await prisma.regulatoryControlType.count({
        where: { organizationId: effectiveOrgId },
      });

      if (existing > 0) {
        return NextResponse.json(
          { error: "Des types de contrôle existent déjà" },
          { status: 400 }
        );
      }

      const created = await prisma.regulatoryControlType.createMany({
        data: DEFAULT_CONTROL_TYPES.map((t) => ({
          ...t,
          organizationId: effectiveOrgId,
        })),
      });

      return NextResponse.json(
        { created: created.count, message: `${created.count} types de contrôle initialisés` },
        { status: 201 }
      );
    }

    // Création manuelle
    const {
      name,
      category,
      description,
      regulatoryRef,
      frequency,
      frequencyMonths,
      applicableDomains,
      minPowerKw,
    } = body;

    if (!name?.trim() || !category) {
      return NextResponse.json(
        { error: "Nom et catégorie requis" },
        { status: 400 }
      );
    }

    const type = await prisma.regulatoryControlType.create({
      data: {
        organizationId: effectiveOrgId,
        name: name.trim(),
        category,
        description: description?.trim() || null,
        regulatoryRef: regulatoryRef?.trim() || null,
        frequency: frequency || "ANNUEL",
        frequencyMonths: frequencyMonths || 12,
        applicableDomains: applicableDomains || [],
        minPowerKw: minPowerKw ? parseFloat(minPowerKw) : null,
      },
    });

    return NextResponse.json(type, { status: 201 });
  } catch (error) {
    console.error("POST /api/regulatory-controls/types error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
