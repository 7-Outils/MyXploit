import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Mapping type -> domain
const TYPE_TO_DOMAIN: Record<string, string> = {
  // Chauffage
  CHAUDIERE: "CHAUFFAGE",
  CHAUDIERE_CONDENSATION: "CHAUFFAGE",
  PAC: "CHAUFFAGE",
  PAC_AIR_EAU: "CHAUFFAGE",
  PAC_EAU_EAU: "CHAUFFAGE",
  PAC_AIR_AIR: "CHAUFFAGE",
  RADIATEUR: "CHAUFFAGE",
  PLANCHER_CHAUFFANT: "CHAUFFAGE",
  CONVECTEUR: "CHAUFFAGE",
  AEROTERME: "CHAUFFAGE",
  RADIANT_GAZ: "CHAUFFAGE",
  VANNE_3_VOIES: "CHAUFFAGE",
  VANNE_MOTORISEE: "CHAUFFAGE",
  POMPE_CHAUFFAGE: "CHAUFFAGE",
  CIRCULATEUR: "CHAUFFAGE",
  VASE_EXPANSION: "CHAUFFAGE",
  ECHANGEUR_THERMIQUE: "CHAUFFAGE",
  BRULEUR: "CHAUFFAGE",
  REGULATEUR: "CHAUFFAGE",
  SONDE_TEMPERATURE: "CHAUFFAGE",
  SONDE_EXTERIEURE: "CHAUFFAGE",
  // ECS
  BALLON_ECS: "ECS",
  BALLON_THERMODYNAMIQUE: "ECS",
  PREPARATEUR_ECS_GAZ: "ECS",
  ECHANGEUR_ECS: "ECS",
  POMPE_BOUCLAGE: "ECS",
  MITIGEUR_THERMOSTATIQUE: "ECS",
  RESISTANCE_ELECTRIQUE: "ECS",
  // Ventilation
  VMC: "VENTILATION",
  VMC_SIMPLE_FLUX: "VENTILATION",
  VMC_DOUBLE_FLUX: "VENTILATION",
  CTA: "VENTILATION",
  CAISSON_EXTRACTION: "VENTILATION",
  CAISSON_SOUFFLAGE: "VENTILATION",
  VENTILATEUR: "VENTILATION",
  REGISTRE: "VENTILATION",
  BATTERIE_CHAUDE: "VENTILATION",
  BATTERIE_FROIDE: "VENTILATION",
  RECUPERATEUR_CHALEUR: "VENTILATION",
  // Climatisation
  GROUPE_FROID: "CLIMATISATION",
  CLIMATISATION: "CLIMATISATION",
  CLIMATISEUR: "CLIMATISATION",
  SPLIT: "CLIMATISATION",
  MULTI_SPLIT: "CLIMATISATION",
  CASSETTE: "CLIMATISATION",
  GAINABLE: "CLIMATISATION",
  ROOFTOP: "CLIMATISATION",
  // Traitement eau
  ADOUCISSEUR: "TRAITEMENT_EAU",
  DISCONNECTEUR: "TRAITEMENT_EAU",
  FILTRE: "TRAITEMENT_EAU",
  POT_BOUE: "TRAITEMENT_EAU",
  DEGAZEUR: "TRAITEMENT_EAU",
  DOSEUR: "TRAITEMENT_EAU",
  // Plomberie
  COMPTEUR_EAU: "PLOMBERIE",
  VANNE_GENERALE: "PLOMBERIE",
  SURPRESSEUR: "PLOMBERIE",
  BACHE_EAU: "PLOMBERIE",
  REDUCTION_PRESSION: "PLOMBERIE",
  // CFO/CFA (Électricité)
  ARMOIRE_ELECTRIQUE: "CFO_CFA",
  ARMOIRE_TGBT: "CFO_CFA",
  ARMOIRE_TD: "CFO_CFA",
  ONDULEUR: "CFO_CFA",
  GROUPE_ELECTROGENE: "CFO_CFA",
  TRANSFORMATEUR: "CFO_CFA",
  BAIE_INFORMATIQUE: "CFO_CFA",
  // Comptage
  COMPTEUR_ENERGIE: "COMPTAGE",
  COMPTEUR_CALORIES: "COMPTAGE",
  COMPTEUR_FRIGORIES: "COMPTAGE",
  COMPTEUR_ECS: "COMPTAGE",
  COMPTEUR_GAZ: "COMPTAGE",
  COMPTEUR_ELECTRIQUE: "COMPTAGE",
  SOUS_COMPTEUR_ELEC: "COMPTAGE",
  COMPTEUR_HORAIRE: "COMPTAGE",
  ANALYSEUR_RESEAU: "COMPTAGE",
  SONDE_TEMPERATURE_AMB: "COMPTAGE",
  SONDE_HYGROMETRIE: "COMPTAGE",
  CAPTEUR_CO2: "COMPTAGE",
  CAPTEUR_QUALITE_AIR: "COMPTAGE",
  // Autre
  AUTRE: "AUTRE",
};

// Labels for equipment types (used for auto-generating name)
const TYPE_LABELS: Record<string, string> = {
  // Chauffage
  CHAUDIERE: "Chaudière",
  CHAUDIERE_CONDENSATION: "Chaudière condensation",
  PAC: "Pompe à chaleur",
  PAC_AIR_EAU: "PAC air/eau",
  PAC_EAU_EAU: "PAC eau/eau",
  PAC_AIR_AIR: "PAC air/air",
  RADIATEUR: "Radiateur",
  PLANCHER_CHAUFFANT: "Plancher chauffant",
  CONVECTEUR: "Convecteur",
  AEROTERME: "Aérotherme",
  RADIANT_GAZ: "Radiant gaz",
  VANNE_3_VOIES: "Vanne 3 voies",
  VANNE_MOTORISEE: "Vanne motorisée",
  POMPE_CHAUFFAGE: "Pompe chauffage",
  CIRCULATEUR: "Circulateur",
  VASE_EXPANSION: "Vase d'expansion",
  ECHANGEUR_THERMIQUE: "Échangeur thermique",
  BRULEUR: "Brûleur",
  REGULATEUR: "Régulateur",
  SONDE_TEMPERATURE: "Sonde température",
  SONDE_EXTERIEURE: "Sonde extérieure",
  // ECS
  BALLON_ECS: "Ballon ECS",
  BALLON_THERMODYNAMIQUE: "Ballon thermodynamique",
  PREPARATEUR_ECS_GAZ: "Préparateur ECS gaz",
  ECHANGEUR_ECS: "Échangeur ECS",
  POMPE_BOUCLAGE: "Pompe de bouclage",
  MITIGEUR_THERMOSTATIQUE: "Mitigeur thermostatique",
  RESISTANCE_ELECTRIQUE: "Résistance électrique",
  // Ventilation
  VMC: "VMC",
  VMC_SIMPLE_FLUX: "VMC simple flux",
  VMC_DOUBLE_FLUX: "VMC double flux",
  CTA: "CTA",
  CAISSON_EXTRACTION: "Caisson d'extraction",
  CAISSON_SOUFFLAGE: "Caisson de soufflage",
  VENTILATEUR: "Ventilateur",
  REGISTRE: "Registre",
  BATTERIE_CHAUDE: "Batterie chaude",
  BATTERIE_FROIDE: "Batterie froide",
  RECUPERATEUR_CHALEUR: "Récupérateur de chaleur",
  // Climatisation
  GROUPE_FROID: "Groupe froid",
  CLIMATISATION: "Climatisation",
  CLIMATISEUR: "Climatiseur",
  SPLIT: "Split",
  MULTI_SPLIT: "Multi-split",
  CASSETTE: "Cassette",
  GAINABLE: "Gainable",
  ROOFTOP: "Rooftop",
  // Traitement eau
  ADOUCISSEUR: "Adoucisseur",
  DISCONNECTEUR: "Disconnecteur",
  FILTRE: "Filtre",
  POT_BOUE: "Pot à boue",
  DEGAZEUR: "Dégazeur",
  DOSEUR: "Doseur",
  // Plomberie
  COMPTEUR_EAU: "Compteur d'eau",
  VANNE_GENERALE: "Vanne générale",
  SURPRESSEUR: "Surpresseur",
  BACHE_EAU: "Bâche à eau",
  REDUCTION_PRESSION: "Réducteur de pression",
  // CFO/CFA
  ARMOIRE_ELECTRIQUE: "Armoire électrique",
  ARMOIRE_TGBT: "TGBT",
  ARMOIRE_TD: "Tableau divisionnaire",
  ONDULEUR: "Onduleur",
  GROUPE_ELECTROGENE: "Groupe électrogène",
  TRANSFORMATEUR: "Transformateur",
  BAIE_INFORMATIQUE: "Baie informatique",
  // Comptage
  COMPTEUR_ENERGIE: "Compteur d'énergie",
  COMPTEUR_CALORIES: "Compteur de calories",
  COMPTEUR_FRIGORIES: "Compteur de frigories",
  COMPTEUR_ECS: "Compteur ECS",
  COMPTEUR_GAZ: "Compteur gaz",
  COMPTEUR_ELECTRIQUE: "Compteur électrique",
  SOUS_COMPTEUR_ELEC: "Sous-compteur électrique",
  COMPTEUR_HORAIRE: "Compteur horaire",
  ANALYSEUR_RESEAU: "Analyseur réseau",
  SONDE_TEMPERATURE_AMB: "Sonde température ambiante",
  SONDE_HYGROMETRIE: "Sonde hygrométrie",
  CAPTEUR_CO2: "Capteur CO2",
  CAPTEUR_QUALITE_AIR: "Capteur qualité d'air",
  // Autre
  AUTRE: "Autre équipement",
};

// Default theoretical lifespan by equipment type (years)
const DEFAULT_LIFESPAN: Record<string, number> = {
  // Chauffage - générateurs
  CHAUDIERE: 20,
  CHAUDIERE_CONDENSATION: 20,
  PAC: 20,
  PAC_AIR_EAU: 20,
  PAC_EAU_EAU: 25,
  PAC_AIR_AIR: 15,
  BRULEUR: 15,
  // Chauffage - émetteurs
  RADIATEUR: 30,
  PLANCHER_CHAUFFANT: 50,
  CONVECTEUR: 20,
  AEROTERME: 15,
  // Chauffage - accessoires
  VANNE_3_VOIES: 15,
  VANNE_MOTORISEE: 15,
  POMPE_CHAUFFAGE: 15,
  CIRCULATEUR: 15,
  VASE_EXPANSION: 15,
  ECHANGEUR_THERMIQUE: 20,
  REGULATEUR: 15,
  SONDE_TEMPERATURE: 10,
  SONDE_EXTERIEURE: 10,
  // ECS
  BALLON_ECS: 15,
  BALLON_THERMODYNAMIQUE: 15,
  ECHANGEUR_ECS: 20,
  POMPE_BOUCLAGE: 15,
  MITIGEUR_THERMOSTATIQUE: 10,
  RESISTANCE_ELECTRIQUE: 10,
  // Ventilation
  VMC: 15,
  VMC_SIMPLE_FLUX: 15,
  VMC_DOUBLE_FLUX: 15,
  CTA: 20,
  CAISSON_EXTRACTION: 15,
  CAISSON_SOUFFLAGE: 15,
  VENTILATEUR: 15,
  REGISTRE: 20,
  BATTERIE_CHAUDE: 20,
  BATTERIE_FROIDE: 20,
  RECUPERATEUR_CHALEUR: 15,
  // Climatisation
  GROUPE_FROID: 20,
  CLIMATISATION: 15,
  CLIMATISEUR: 15,
  SPLIT: 12,
  MULTI_SPLIT: 12,
  CASSETTE: 12,
  GAINABLE: 15,
  ROOFTOP: 20,
  // Traitement eau
  ADOUCISSEUR: 15,
  DISCONNECTEUR: 20,
  FILTRE: 10,
  POT_BOUE: 20,
  DEGAZEUR: 20,
  DOSEUR: 10,
  // Plomberie
  COMPTEUR_EAU: 15,
  VANNE_GENERALE: 30,
  SURPRESSEUR: 15,
  BACHE_EAU: 25,
  REDUCTION_PRESSION: 15,
  // CFO/CFA
  ARMOIRE_ELECTRIQUE: 30,
  ARMOIRE_TGBT: 30,
  ARMOIRE_TD: 30,
  ONDULEUR: 10,
  GROUPE_ELECTROGENE: 25,
  TRANSFORMATEUR: 35,
  BAIE_INFORMATIQUE: 15,
  // Comptage
  COMPTEUR_ENERGIE: 15,
  COMPTEUR_CALORIES: 15,
  COMPTEUR_FRIGORIES: 15,
  COMPTEUR_ECS: 15,
  COMPTEUR_GAZ: 15,
  COMPTEUR_ELECTRIQUE: 15,
  SOUS_COMPTEUR_ELEC: 15,
  COMPTEUR_HORAIRE: 10,
  ANALYSEUR_RESEAU: 15,
  SONDE_TEMPERATURE_AMB: 10,
  SONDE_HYGROMETRIE: 10,
  CAPTEUR_CO2: 10,
  CAPTEUR_QUALITE_AIR: 10,
  // Autre
  AUTRE: 15,
};

// GET /api/equipments - List all equipments (optionally filter by siteId, contractId, domain)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const contractId = searchParams.get("contractId");
    const domain = searchParams.get("domain");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };

    if (siteId) {
      where.siteId = siteId;
    } else if (contractId) {
      // Get all sites for this contract
      const contractSites = await prisma.contractSite.findMany({
        where: { contractId },
        select: { siteId: true },
      });
      where.siteId = { in: contractSites.map((cs) => cs.siteId) };
    }

    if (domain) {
      where.domain = domain;
    }

    const equipments = await prisma.equipment.findMany({
      where,
      include: {
        site: {
          select: { id: true, name: true, city: true },
        },
        audits: {
          orderBy: { auditDate: "desc" },
          take: 1, // Only latest audit
        },
        _count: {
          select: { audits: true },
        },
      },
      orderBy: [{ domain: "asc" }, { type: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(equipments);
  } catch (error) {
    console.error("Error fetching equipments:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des équipements" },
      { status: 500 }
    );
  }
}

// POST /api/equipments - Create a new equipment
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un équipement" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Verify the site belongs to the user's organization
    const site = await prisma.site.findFirst({
      where: {
        id: body.siteId,
        organizationId: user.organizationId,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    // Get type and infer domain
    const type = body.type || "AUTRE";
    const domain = body.domain || TYPE_TO_DOMAIN[type] || "AUTRE";

    // Auto-generate name from type if not provided
    const name = body.name || TYPE_LABELS[type] || type;

    // Get default lifespan based on type if not provided
    const theoreticalLifespan = body.theoreticalLifespan
      ? parseInt(body.theoreticalLifespan)
      : DEFAULT_LIFESPAN[type] || 15;

    const equipment = await prisma.equipment.create({
      data: {
        name,
        domain,
        type,
        brand: body.brand || null,
        model: body.model || null,
        serialNumber: body.serialNumber || null,
        year: body.year ? parseInt(body.year) : null,
        power: body.power ? parseFloat(body.power) : null,
        quantity: body.quantity ? parseInt(body.quantity) : null,
        location: body.location || null,
        level: body.level || null,
        theoreticalLifespan,
        status: body.status || "OPERATIONNEL",
        installDate: body.installDate ? new Date(body.installDate) : null,
        warrantyEnd: body.warrantyEnd ? new Date(body.warrantyEnd) : null,
        siteId: body.siteId,
        organizationId: user.organizationId,
      },
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(equipment, { status: 201 });
  } catch (error) {
    console.error("Error creating equipment:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'équipement" },
      { status: 500 }
    );
  }
}
