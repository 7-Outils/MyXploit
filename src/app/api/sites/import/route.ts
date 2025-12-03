import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as XLSX from "xlsx";
import { SiteType, EnergyType, NbUnit, ContractType } from "@/generated/prisma/enums";

interface ImportedSite {
  name: string;
  type?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  surface?: number;
  surfaceChauffee?: number;
  energyType?: string;
  nb?: number;
  nbUnit?: string;
  pce?: string;
  pdl?: string;
  rae?: string;
  // Contract link fields
  contractType?: string;
  hasP1?: boolean;
  hasP2?: boolean;
  hasP3?: boolean;
  hasP4?: boolean;
  amountP1?: number;
  amountP2?: number;
  amountP3?: number;
}

const validSiteTypes = Object.values(SiteType);
const validEnergyTypes = Object.values(EnergyType);

function parseSiteType(value?: string): SiteType {
  if (!value) return SiteType.AUTRE;
  const upper = value.toUpperCase().trim();
  if (validSiteTypes.includes(upper as SiteType)) {
    return upper as SiteType;
  }
  // Try to match common French names
  const mapping: Record<string, SiteType> = {
    "LYCÉE": SiteType.LYCEE,
    "COLLÈGE": SiteType.COLLEGE,
    "ÉCOLE": SiteType.ECOLE,
    "HÔPITAL": SiteType.HOPITAL,
    "MÉDIATHÈQUE": SiteType.MEDIATHEQUE,
  };
  return mapping[upper] || SiteType.AUTRE;
}

function parseEnergyType(value?: string): EnergyType {
  if (!value) return EnergyType.GAZ;
  const upper = value.toUpperCase().trim();
  if (validEnergyTypes.includes(upper as EnergyType)) {
    return upper as EnergyType;
  }
  // Try to match common French names
  const mapping: Record<string, EnergyType> = {
    "ÉLECTRICITÉ": EnergyType.ELECTRICITE,
    "ELECTRICITÉ": EnergyType.ELECTRICITE,
    "RÉSEAU DE CHALEUR": EnergyType.RESEAU_CHALEUR,
    "RESEAU DE CHALEUR": EnergyType.RESEAU_CHALEUR,
    "CHALEUR": EnergyType.RESEAU_CHALEUR,
  };
  return mapping[upper] || EnergyType.GAZ;
}

function parseNbUnit(value?: string): NbUnit | null {
  if (!value) return null;
  const upper = value.toUpperCase().trim();
  if (upper === "PCS" || upper === "UTILE") {
    return upper as NbUnit;
  }
  return null;
}

const validContractTypes = Object.values(ContractType);

function parseContractType(value?: string): ContractType {
  if (!value) return ContractType.MC;
  const upper = value.toUpperCase().trim();
  if (validContractTypes.includes(upper as ContractType)) {
    return upper as ContractType;
  }
  return ContractType.MC;
}

// Column name mapping (French to field names)
const columnMapping: Record<string, keyof ImportedSite> = {
  // Site fields
  "nom": "name",
  "name": "name",
  "site": "name",
  "type": "type",
  "type de site": "type",
  "adresse": "address",
  "address": "address",
  "ville": "city",
  "city": "city",
  "code postal": "postalCode",
  "cp": "postalCode",
  "postalcode": "postalCode",
  "surface": "surface",
  "surface (m²)": "surface",
  "surface m2": "surface",
  "surface chauffee": "surfaceChauffee",
  "surface chauffée": "surfaceChauffee",
  "surface chauffée (m²)": "surfaceChauffee",
  "energie": "energyType",
  "énergie": "energyType",
  "type energie": "energyType",
  "type énergie": "energyType",
  "energytype": "energyType",
  "nb": "nb",
  "nb unite": "nbUnit",
  "nb unité": "nbUnit",
  "nbunit": "nbUnit",
  "pce": "pce",
  "pdl": "pdl",
  "rae": "rae",
  // Contract fields
  "type contrat": "contractType",
  "contracttype": "contractType",
  "p1": "hasP1",
  "p2": "hasP2",
  "p3": "hasP3",
  "p4": "hasP4",
  "montant p1": "amountP1",
  "amountp1": "amountP1",
  "montant p2": "amountP2",
  "amountp2": "amountP2",
  "montant p3": "amountP3",
  "amountp3": "amountP3",
};

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = value.toLowerCase().trim();
    return v === "oui" || v === "yes" || v === "true" || v === "1" || v === "x";
  }
  return false;
}

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return isNaN(num) ? undefined : num;
}

// POST /api/sites/import - Import sites from Excel file
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer des sites" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const contractId = formData.get("contractId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    // Verify contract if provided
    let contract = null;
    if (contractId) {
      contract = await prisma.contract.findFirst({
        where: {
          id: contractId,
          organizationId: user.organizationId,
        },
      });

      if (!contract) {
        return NextResponse.json(
          { error: "Contrat non trouvé" },
          { status: 404 }
        );
      }

      if (contract.status === "RESILIE" || contract.status === "EXPIRE") {
        return NextResponse.json(
          { error: "Impossible d'ajouter des sites à un contrat résilié ou expiré" },
          { status: 400 }
        );
      }
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Le fichier est vide" },
        { status: 400 }
      );
    }

    // Map columns to fields
    const firstRow = rows[0];
    const columnMap = new Map<string, keyof ImportedSite>();

    for (const col of Object.keys(firstRow)) {
      const normalizedCol = normalizeColumnName(col);
      const mappedField = columnMapping[normalizedCol];
      if (mappedField) {
        columnMap.set(col, mappedField);
      }
    }

    // Check if we have at least the name column
    const hasNameColumn = Array.from(columnMap.values()).includes("name");
    if (!hasNameColumn) {
      return NextResponse.json(
        { error: "Colonne 'Nom' ou 'Site' requise dans le fichier" },
        { status: 400 }
      );
    }

    // Parse rows into sites
    const sitesToCreate: ImportedSite[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const site: Partial<ImportedSite> = {};

      for (const [col, field] of columnMap.entries()) {
        const value = row[col];

        switch (field) {
          case "name":
          case "type":
          case "address":
          case "city":
          case "postalCode":
          case "energyType":
          case "nbUnit":
          case "pce":
          case "pdl":
          case "rae":
          case "contractType":
            site[field] = value ? String(value).trim() : undefined;
            break;
          case "surface":
          case "surfaceChauffee":
          case "nb":
          case "amountP1":
          case "amountP2":
          case "amountP3":
            site[field] = parseNumber(value);
            break;
          case "hasP1":
          case "hasP2":
          case "hasP3":
          case "hasP4":
            site[field] = parseBoolean(value);
            break;
        }
      }

      if (!site.name) {
        errors.push(`Ligne ${i + 2}: Nom du site manquant`);
        continue;
      }

      sitesToCreate.push(site as ImportedSite);
    }

    if (sitesToCreate.length === 0) {
      return NextResponse.json(
        { error: "Aucun site valide à importer", details: errors },
        { status: 400 }
      );
    }

    // Create sites in database
    const createdSites: Array<{ id: string; name: string }> = [];
    const createdContractSites: Array<{ siteId: string; siteName: string }> = [];

    for (const siteData of sitesToCreate) {
      const site = await prisma.site.create({
        data: {
          name: siteData.name,
          type: parseSiteType(siteData.type),
          address: siteData.address || "",
          city: siteData.city || "",
          postalCode: siteData.postalCode || "",
          surface: siteData.surface,
          surfaceChauffee: siteData.surfaceChauffee,
          energyType: parseEnergyType(siteData.energyType),
          nb: siteData.nb,
          nbUnit: parseNbUnit(siteData.nbUnit),
          pce: siteData.pce,
          pdl: siteData.pdl,
          rae: siteData.rae,
          organizationId: user.organizationId,
          createdById: user.id,
        },
      });

      createdSites.push({ id: site.id, name: site.name });

      // If contract provided, create ContractSite link
      if (contract) {
        await prisma.contractSite.create({
          data: {
            contractId: contract.id,
            siteId: site.id,
            contractType: parseContractType(siteData.contractType),
            hasP1: siteData.hasP1 || false,
            hasP2: siteData.hasP2 || false,
            hasP3: siteData.hasP3 || false,
            hasP4: siteData.hasP4 || false,
            amountP1: siteData.amountP1,
            amountP2: siteData.amountP2,
            amountP3: siteData.amountP3,
          },
        });
        createdContractSites.push({ siteId: site.id, siteName: site.name });
      }
    }

    return NextResponse.json({
      success: true,
      imported: createdSites.length,
      linkedToContract: createdContractSites.length,
      sites: createdSites,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error importing sites:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import des sites" },
      { status: 500 }
    );
  }
}
