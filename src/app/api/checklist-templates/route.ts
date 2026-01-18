import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Type pour la catégorie (fallback vers les labels hardcodés si pas en BDD)
const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  DOSSIER_TECHNIQUE: "Dossier technique",
  CONFORMITE_REGLEMENTAIRE: "Conformité réglementaire",
  CONSIGNES: "Consignes d'exploitation",
  COMBUSTION: "Combustion",
  SECURITE: "Sécurité",
  EVACUATION: "Évacuation",
  HYDRAULIQUE: "Hydraulique",
  REGLEMENTAIRE: "Réglementaire",
  FLUIDE: "Fluide frigorigène",
  ECHANGEUR: "Échangeur",
  VENTILATION: "Ventilation",
  FILTRATION: "Filtration",
  ELECTRIQUE: "Électrique",
  AMONT: "En amont",
  AVAL: "En aval",
  INSTALLATION: "Installation",
  PRECAUTION: "Précautions",
  TEMPERATURE: "Température",
  LEGIONELLE: "Légionelle",
  ANODE: "Anode",
  ISOLATION: "Isolation",
  REGLAGE: "Réglage",
  VENTILATEUR: "Ventilateur",
  BATTERIE: "Batterie",
  REGISTRES: "Registres",
  HUMIDIFICATEUR: "Humidificateur",
  HYGIENE: "Hygiène",
  GAINES: "Gaines",
  BOUCHES: "Bouches",
  BYPASS: "Bypass",
  COURROIE: "Courroie",
  COMPRESSEUR: "Compresseur",
  CONDENSEUR: "Condenseur",
  EVAPORATEUR: "Évaporateur",
  PRESSOSTAT: "Pressostat",
  FILTRES: "Filtres",
  TELECOMMANDE: "Télécommande",
  FIXATION: "Fixation",
  RESERVOIR: "Réservoir",
  POMPE: "Pompe",
  FLOTTEUR: "Flotteur",
  ALARME: "Alarme",
  BACHE: "Bâche",
  SEL: "Sel",
  RESINE: "Résine",
  REGENERATION: "Régénération",
  DURETE: "Dureté",
  COMPTEUR: "Compteur",
  TEST: "Test",
  VISUEL: "Visuel",
  SERRAGE: "Serrage",
  THERMIQUE: "Thermique",
  PROTECTION: "Protection",
  TERRE: "Terre",
  BATTERIE_ELEC: "Batterie",
  AUTONOMIE: "Autonomie",
  ALARMES: "Alarmes",
  AFFICHAGE: "Affichage",
  COMMUNICATION: "Communication",
  ETALONNAGE: "Étalonnage",
  SONDES: "Sondes",
  PRESSION: "Pression",
  MANOMETRE: "Manomètre",
  CONTRELAVAGE: "Contre-lavage",
  MEDIA: "Média filtrant",
  AMORCAGE: "Amorçage",
  PANIER: "Panier",
  INTENSITE: "Intensité",
  GARNITURE: "Garniture",
  CONSOMMATION: "Consommation",
  DOSAGE: "Dosage",
  SONDE: "Sonde",
  CELLULE: "Cellule",
  PRESSION_GONFLAGE: "Pression",
  ETAT: "État",
  DIMENSIONNEMENT: "Dimensionnement",
  ETANCHEITE: "Étanchéité",
};

// GET /api/checklist-templates - Liste les templates pour l'audit
// Accessible à tous les utilisateurs authentifiés (pas seulement admin)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const equipmentTypes = searchParams.get("equipmentTypes")?.split(",").filter(Boolean);

    // Construire le filtre
    const where: {
      organizationId: string;
      isActive: boolean;
      equipmentTypes?: { hasSome: string[] };
    } = {
      organizationId: user.organizationId,
      isActive: true,
    };

    // Si des types d'équipements sont spécifiés, filtrer les templates correspondants
    if (equipmentTypes && equipmentTypes.length > 0) {
      // Ajouter le type spécial pour la checklist commune
      const typesWithCommon = ["_SITE_COMMON_", ...equipmentTypes];
      where.equipmentTypes = { hasSome: typesWithCommon };
    }

    const templates = await prisma.checklistTemplate.findMany({
      where,
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: {
            recommendations: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Récupérer les catégories personnalisées de l'organisation
    const categories = await prisma.checklistCategory.findMany({
      where: { organizationId: user.organizationId },
    });

    // Créer un map des labels de catégories (BDD + fallback)
    const categoryLabels: Record<string, string> = { ...DEFAULT_CATEGORY_LABELS };
    for (const cat of categories) {
      categoryLabels[cat.key] = cat.label;
    }

    return NextResponse.json({
      templates,
      categoryLabels,
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des templates" },
      { status: 500 }
    );
  }
}
