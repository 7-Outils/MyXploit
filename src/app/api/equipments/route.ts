import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { rateLimit, getClientIdentifier, rateLimitExceeded } from "@/lib/rate-limit";
import { equipmentCreateSchema, validateInput } from "@/lib/validations";
import { TYPE_TO_DOMAIN } from "@/lib/equipment-domain";
import { resolveTopology } from "@/lib/equipment-topology";
import { Prisma } from "@/generated/prisma/client";

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
  // Nouveaux types
  AUTOMATE: "Automate",
  DRV: "DRV",
  RESEAU_DISTRIBUTION: "Réseau de distribution",
  RESEAU_ENTERRE: "Réseau enterré",
  COMPTEUR_APPOINT: "Compteur d'appoint",
  POT_INJECTION: "Pot d'injection",
  TELESURVEILLANCE: "Télésurveillance",
  PRESSOSTAT: "Pressostat",
  MANOMETRE: "Manomètre",
  THERMOSTAT: "Thermostat",
  THERMOSTAT_AMBIANCE: "Thermostat d'ambiance",
  AQUASTAT: "Aquastat",
  THERMOMETRE: "Thermomètre",
  SOUPAPE_SECURITE: "Soupape de sécurité",
  CLAPET_ANTI_RETOUR: "Clapet anti-retour",
  BOUTEILLE_MELANGE: "Bouteille de mélange",
  COLLECTEUR: "Collecteur",
  SEPARATEUR_AIR: "Séparateur d'air",
  PURGEUR: "Purgeur",
  ROBINET_VIDANGE: "Robinet de vidange",
  VANNE_ISOLEMENT: "Vanne d'isolement",
  VANNE_EQUILIBRAGE: "Vanne d'équilibrage",
  ROBINET_THERMOSTATIQUE: "Robinet thermostatique",
  TETE_THERMOSTATIQUE: "Tête thermostatique",
  GENERATEUR_AIR_CHAUD: "Générateur air chaud",
  AEROTHERME_GAZ: "Aérotherme gaz",
  UNIT_HEATER: "Unit heater",
  PANNEAU_RAYONNANT: "Panneau rayonnant",
  BOUCHE_EXTRACTION: "Bouche d'extraction",
  BOUCHE_SOUFFLAGE: "Bouche de soufflage",
  DIFFUSEUR: "Diffuseur",
  GRILLE_VENTILATION: "Grille de ventilation",
  PLENUM: "Plénum",
  SILENCIEUX: "Silencieux",
  CLAPET_COUPE_FEU: "Clapet coupe-feu",
  HUMIDIFICATEUR: "Humidificateur",
  RIDEAU_AIR: "Rideau d'air",
  TOUR_REFROIDISSEMENT: "Tour de refroidissement",
  AEROREFRIGERANT: "Aéroréfrigérant",
  DRY_COOLER: "Dry cooler",
  REFROIDISSEUR_ADIABATIQUE: "Refroidisseur adiabatique",
  UNITE_INTERIEURE: "Unité intérieure",
  UNITE_EXTERIEURE: "Unité extérieure",
  CONSOLE_CLIMATISATION: "Console climatisation",
  MURAL_CLIMATISATION: "Mural climatisation",
  ARMOIRE_CLIMATISATION: "Armoire climatisation",
  DEBITMETRE: "Débitmètre",
  VARIATEUR_FREQUENCE: "Variateur de fréquence",
  DETECTEUR_FUMEE: "Détecteur de fumée",
  DETECTEUR_CO: "Détecteur CO",
  MODULE_HYDRAULIQUE: "Module hydraulique",
  STATION_RELEVAGE: "Station de relevage",
  POMPE_RELEVAGE: "Pompe de relevage",
  PANNEAU_SOLAIRE_THERMIQUE: "Panneau solaire thermique",
  BALLON_SOLAIRE: "Ballon solaire",
  STATION_SOLAIRE: "Station solaire",
  ELECTROVANNE: "Électrovanne",
  ELECTROVANNE_GAZ: "Électrovanne gaz",
  VANNE_2_VOIES: "Vanne 2 voies",
  SERVOMOTEUR: "Servomoteur",
  CENTRALE_DETECTION_GAZ: "Centrale détection gaz",
  DETECTEUR_GAZ: "Détecteur gaz",
  EXTRACTEUR: "Extracteur",
  CAISSON_VENTILATION: "Caisson de ventilation",
  CUVE: "Cuve",
  CUVE_FIOUL: "Cuve fioul",
  CUVE_GAZ: "Cuve gaz",
  ECRAN_TACTILE: "Écran tactile",
  TELECOMMANDE: "Télécommande",
  GAINE: "Gaine",
  BAC_SEL: "Bac à sel",
  EMETTEUR: "Émetteur",
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
  // Nouveaux types
  AUTOMATE: 15,
  DRV: 15,
  RESEAU_DISTRIBUTION: 30,
  RESEAU_ENTERRE: 40,
  COMPTEUR_APPOINT: 15,
  POT_INJECTION: 20,
  TELESURVEILLANCE: 10,
  PRESSOSTAT: 10,
  MANOMETRE: 10,
  THERMOSTAT: 10,
  THERMOSTAT_AMBIANCE: 10,
  AQUASTAT: 10,
  THERMOMETRE: 10,
  SOUPAPE_SECURITE: 15,
  CLAPET_ANTI_RETOUR: 20,
  BOUTEILLE_MELANGE: 25,
  COLLECTEUR: 30,
  SEPARATEUR_AIR: 20,
  PURGEUR: 10,
  ROBINET_VIDANGE: 20,
  VANNE_ISOLEMENT: 25,
  VANNE_EQUILIBRAGE: 20,
  ROBINET_THERMOSTATIQUE: 15,
  TETE_THERMOSTATIQUE: 8,
  GENERATEUR_AIR_CHAUD: 20,
  AEROTHERME_GAZ: 15,
  UNIT_HEATER: 15,
  PANNEAU_RAYONNANT: 20,
  BOUCHE_EXTRACTION: 20,
  BOUCHE_SOUFFLAGE: 20,
  DIFFUSEUR: 25,
  GRILLE_VENTILATION: 30,
  PLENUM: 25,
  SILENCIEUX: 25,
  CLAPET_COUPE_FEU: 20,
  HUMIDIFICATEUR: 10,
  RIDEAU_AIR: 15,
  TOUR_REFROIDISSEMENT: 20,
  AEROREFRIGERANT: 20,
  DRY_COOLER: 20,
  REFROIDISSEUR_ADIABATIQUE: 15,
  UNITE_INTERIEURE: 12,
  UNITE_EXTERIEURE: 15,
  CONSOLE_CLIMATISATION: 12,
  MURAL_CLIMATISATION: 12,
  ARMOIRE_CLIMATISATION: 15,
  DEBITMETRE: 15,
  VARIATEUR_FREQUENCE: 15,
  DETECTEUR_FUMEE: 10,
  DETECTEUR_CO: 7,
  MODULE_HYDRAULIQUE: 20,
  STATION_RELEVAGE: 15,
  POMPE_RELEVAGE: 15,
  PANNEAU_SOLAIRE_THERMIQUE: 25,
  BALLON_SOLAIRE: 20,
  STATION_SOLAIRE: 15,
  ELECTROVANNE: 15,
  ELECTROVANNE_GAZ: 15,
  VANNE_2_VOIES: 15,
  SERVOMOTEUR: 12,
  CENTRALE_DETECTION_GAZ: 15,
  DETECTEUR_GAZ: 10,
  EXTRACTEUR: 15,
  CAISSON_VENTILATION: 20,
  CUVE: 30,
  CUVE_FIOUL: 30,
  CUVE_GAZ: 30,
  ECRAN_TACTILE: 10,
  TELECOMMANDE: 10,
  GAINE: 30,
  BAC_SEL: 15,
  EMETTEUR: 25,
  // Autre
  AUTRE: 15,
};

// GET /api/equipments - List all equipments (optionally filter by siteId, contractId, domain)
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const { success } = await rateLimit(clientId);
    if (!success) return rateLimitExceeded();

    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const contractId = searchParams.get("contractId");
    const domain = searchParams.get("domain");

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: effectiveOrgId,
    };

    if (siteId) {
      where.siteId = siteId;
    } else if (contractId) {
      // Get all sites for this contract
      const contractSites = await prisma.contractSite.findMany({
        where: { contractId, contract: { organizationId: effectiveOrgId } },
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
        // Topologie : le local et le circuit s'affichent sur la fiche et la
        // liste, le parent sert à regrouper les organes sous leur source.
        room: { select: { id: true, name: true } },
        circuit: { select: { id: true, name: true } },
        audits: {
          orderBy: { auditDate: "desc" },
          take: 1, // Only latest audit
          // Seuls ces champs sont lus (matrice, tableau, export PDF). Les 5 blocs
          // de notes par critère et le tableau `photos` pesaient sur chaque ligne
          // sans jamais être affichés — sur un contrat de plusieurs milliers
          // d'équipements, c'est l'essentiel du poids de la réponse.
          select: {
            id: true,
            auditDate: true,
            auditor: true,
            visualState: true,
            performance: true,
            security: true,
            accessibility: true,
            compliance: true,
            generalNotes: true,
            auditedByUser: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
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
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const { success } = await rateLimit(clientId);
    if (!success) return rateLimitExceeded();

    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un équipement" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = validateInput(equipmentCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Verify the site belongs to the user's organization
    const site = await prisma.site.findFirst({
      where: {
        id: body.siteId,
        organizationId: effectiveOrgId,
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

    // Pas de repère inventé : un repère terrain vide reste vide,
    // l'affichage se rabat sur le libellé du type.
    const name = body.name || null;

    // Get default lifespan based on type if not provided
    const theoreticalLifespan = body.theoreticalLifespan
      ? parseInt(body.theoreticalLifespan)
      : DEFAULT_LIFESPAN[type] || 15;

    // Topologie : local / circuit doivent appartenir au site visé, et seul un
    // organe rattachable peut désigner une source.
    const topology = await resolveTopology(body, body.siteId, type);
    if (!topology.ok) {
      return NextResponse.json({ error: topology.error }, { status: 400 });
    }

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
        serviceArea: body.serviceArea || null,
        inContractList: body.inContractList ?? true,
        presentOnSite: body.presentOnSite ?? true,
        theoreticalLifespan,
        status: body.status || "OPERATIONNEL",
        installDate: body.installDate ? new Date(body.installDate) : null,
        warrantyEnd: body.warrantyEnd ? new Date(body.warrantyEnd) : null,
        // Caractéristiques propres au type : stockées telles quelles (validées
        // par equipmentCreateSchema). Absentes = colonne NULL.
        characteristics: validation.data.characteristics ?? Prisma.DbNull,
        ...topology.data,
        siteId: body.siteId,
        organizationId: effectiveOrgId,
      },
      include: {
        site: {
          select: { id: true, name: true },
        },
        room: { select: { id: true, name: true } },
        circuit: { select: { id: true, name: true } },
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
