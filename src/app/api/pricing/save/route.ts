import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { SiteType, EnergyType, EquipmentDomain, EquipmentType } from "@/generated/prisma/enums";

/**
 * Sauvegarde un projet de chiffrage en BDD
 * Crée un contrat "En attente" avec les sites et équipements
 */

interface EquipmentData {
  siteName: string;
  equipmentType: string;
  power?: number | null;
  quantity?: number | null;
  year?: number | null;
  theoreticalLifespan?: number | null;
  brand?: string;
  model?: string;
  location?: string;
  level?: string;
}

interface SiteData {
  name: string;
  type?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  surface?: number;
  equipments: EquipmentData[];
}

// Mapping type -> domaine
const TYPE_TO_DOMAIN: Record<string, EquipmentDomain> = {
  CHAUDIERE: EquipmentDomain.CHAUFFAGE,
  CHAUDIERE_CONDENSATION: EquipmentDomain.CHAUFFAGE,
  PAC: EquipmentDomain.CHAUFFAGE,
  PAC_AIR_EAU: EquipmentDomain.CHAUFFAGE,
  PAC_EAU_EAU: EquipmentDomain.CHAUFFAGE,
  PAC_AIR_AIR: EquipmentDomain.CHAUFFAGE,
  BRULEUR: EquipmentDomain.CHAUFFAGE,
  RADIATEUR: EquipmentDomain.CHAUFFAGE,
  PLANCHER_CHAUFFANT: EquipmentDomain.CHAUFFAGE,
  CONVECTEUR: EquipmentDomain.CHAUFFAGE,
  AEROTERME: EquipmentDomain.CHAUFFAGE,
  RADIANT_GAZ: EquipmentDomain.CHAUFFAGE,
  CIRCULATEUR: EquipmentDomain.CHAUFFAGE,
  POMPE_CHAUFFAGE: EquipmentDomain.CHAUFFAGE,
  VANNE_3_VOIES: EquipmentDomain.CHAUFFAGE,
  VANNE_MOTORISEE: EquipmentDomain.CHAUFFAGE,
  VASE_EXPANSION: EquipmentDomain.CHAUFFAGE,
  ECHANGEUR_THERMIQUE: EquipmentDomain.CHAUFFAGE,
  REGULATEUR: EquipmentDomain.CHAUFFAGE,
  SONDE_TEMPERATURE: EquipmentDomain.CHAUFFAGE,
  SONDE_EXTERIEURE: EquipmentDomain.CHAUFFAGE,
  BALLON_ECS: EquipmentDomain.ECS,
  BALLON_THERMODYNAMIQUE: EquipmentDomain.ECS,
  PREPARATEUR_ECS_GAZ: EquipmentDomain.ECS,
  ECHANGEUR_ECS: EquipmentDomain.ECS,
  POMPE_BOUCLAGE: EquipmentDomain.ECS,
  MITIGEUR_THERMOSTATIQUE: EquipmentDomain.ECS,
  RESISTANCE_ELECTRIQUE: EquipmentDomain.ECS,
  VMC: EquipmentDomain.VENTILATION,
  VMC_SIMPLE_FLUX: EquipmentDomain.VENTILATION,
  VMC_DOUBLE_FLUX: EquipmentDomain.VENTILATION,
  CTA: EquipmentDomain.VENTILATION,
  CAISSON_EXTRACTION: EquipmentDomain.VENTILATION,
  CAISSON_SOUFFLAGE: EquipmentDomain.VENTILATION,
  VENTILATEUR: EquipmentDomain.VENTILATION,
  BATTERIE_CHAUDE: EquipmentDomain.VENTILATION,
  BATTERIE_FROIDE: EquipmentDomain.VENTILATION,
  RECUPERATEUR_CHALEUR: EquipmentDomain.VENTILATION,
  GROUPE_FROID: EquipmentDomain.CLIMATISATION,
  CLIMATISATION: EquipmentDomain.CLIMATISATION,
  CLIMATISEUR: EquipmentDomain.CLIMATISATION,
  SPLIT: EquipmentDomain.CLIMATISATION,
  MULTI_SPLIT: EquipmentDomain.CLIMATISATION,
  CASSETTE: EquipmentDomain.CLIMATISATION,
  GAINABLE: EquipmentDomain.CLIMATISATION,
  ROOFTOP: EquipmentDomain.CLIMATISATION,
  ADOUCISSEUR: EquipmentDomain.TRAITEMENT_EAU,
  DISCONNECTEUR: EquipmentDomain.TRAITEMENT_EAU,
  FILTRE: EquipmentDomain.TRAITEMENT_EAU,
  POT_BOUE: EquipmentDomain.TRAITEMENT_EAU,
  DEGAZEUR: EquipmentDomain.TRAITEMENT_EAU,
  DOSEUR: EquipmentDomain.TRAITEMENT_EAU,
  COMPTEUR_ENERGIE: EquipmentDomain.COMPTAGE,
  COMPTEUR_CALORIES: EquipmentDomain.COMPTAGE,
  COMPTEUR_GAZ: EquipmentDomain.COMPTAGE,
  COMPTEUR_EAU: EquipmentDomain.COMPTAGE,
};

// Durée de vie par défaut
const DEFAULT_LIFESPAN: Record<string, number> = {
  CHAUDIERE: 20, CHAUDIERE_CONDENSATION: 20, PAC: 20, PAC_AIR_EAU: 20, PAC_EAU_EAU: 25, PAC_AIR_AIR: 15,
  BRULEUR: 15, RADIATEUR: 30, PLANCHER_CHAUFFANT: 50, CONVECTEUR: 20, AEROTERME: 15, RADIANT_GAZ: 15,
  VMC: 15, CTA: 20, GROUPE_FROID: 20, CLIMATISEUR: 15, SPLIT: 12,
  AUTRE: 15,
};

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { projectName, sites, duration } = body as {
      projectName: string;
      sites: SiteData[];
      duration: number;
      marginPercent: number;
    };

    if (!projectName || !sites || sites.length === 0) {
      return NextResponse.json(
        { error: "Nom du projet et sites requis" },
        { status: 400 }
      );
    }

    // Create a contract as "project" for the tender
    const contract = await prisma.contract.create({
      data: {
        reference: `AO-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
        title: projectName,
        provider: "À définir",
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + (duration || 8))),
        status: "EN_ATTENTE",
        description: `Projet d'appel d'offres créé le ${new Date().toLocaleDateString("fr-FR")}`,
        organizationId: user.organizationId,
      },
    });

    const createdSites: Array<{ id: string; name: string; equipmentCount: number }> = [];
    let totalEquipments = 0;

    for (const siteData of sites) {
      // Create site
      const site = await prisma.site.create({
        data: {
          name: siteData.name,
          type: (siteData.type as SiteType) || SiteType.AUTRE,
          address: siteData.address || "",
          city: siteData.city || "",
          postalCode: siteData.postalCode || "",
          surface: siteData.surface,
          energyType: EnergyType.GAZ,
          organizationId: user.organizationId,
          createdById: user.id,
        },
      });

      // Link to contract
      await prisma.contractSite.create({
        data: {
          contractId: contract.id,
          siteId: site.id,
          hasP2: true,
          hasP3: true,
        },
      });

      // Create equipments
      let eqCount = 0;
      for (const eq of siteData.equipments) {
        const eqType = eq.equipmentType as EquipmentType;
        const domain = TYPE_TO_DOMAIN[eqType] || EquipmentDomain.AUTRE;
        const lifespan = eq.theoreticalLifespan || DEFAULT_LIFESPAN[eqType] || 15;

        await prisma.equipment.create({
          data: {
            domain,
            type: eqType,
            brand: eq.brand || undefined,
            model: eq.model || undefined,
            power: eq.power || undefined,
            quantity: eq.quantity || 1,
            year: eq.year || undefined,
            location: eq.location || undefined,
            level: eq.level || undefined,
            theoreticalLifespan: lifespan,
            siteId: site.id,
            organizationId: user.organizationId,
          },
        });
        eqCount++;
        totalEquipments++;
      }

      createdSites.push({
        id: site.id,
        name: site.name,
        equipmentCount: eqCount,
      });
    }

    return NextResponse.json({
      success: true,
      contractId: contract.id,
      contractReference: contract.reference,
      sitesCreated: createdSites.length,
      equipmentsCreated: totalEquipments,
      sites: createdSites,
    });
  } catch (error) {
    console.error("Error saving project:", error);
    return NextResponse.json(
      { error: "Erreur lors de la sauvegarde du projet" },
      { status: 500 }
    );
  }
}
