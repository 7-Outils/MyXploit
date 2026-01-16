import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Valid audit ratings
const VALID_RATINGS = ["NON_EVALUE", "CRITIQUE", "MAUVAIS", "MOYEN", "BON", "EXCELLENT"];

// Synonymes pour les notes d'audit (incluant les labels contextuels)
const RATING_SYNONYMS: Record<string, string> = {
  // Non évalué
  "non évalué": "NON_EVALUE",
  "non evalue": "NON_EVALUE",
  "non evalué": "NON_EVALUE",
  "n/a": "NON_EVALUE",
  "-": "NON_EVALUE",
  "": "NON_EVALUE",
  // Critique (1)
  "critique": "CRITIQUE",
  "crit": "CRITIQUE",
  "1": "CRITIQUE",
  "degradation majeure": "CRITIQUE",
  "dégradation majeure": "CRITIQUE",
  "defaillant": "CRITIQUE",
  "défaillant": "CRITIQUE",
  "danger immediat": "CRITIQUE",
  "danger immédiat": "CRITIQUE",
  "inaccessible": "CRITIQUE",
  "non conformite majeure": "CRITIQUE",
  "non-conformite majeure": "CRITIQUE",
  "non conformité majeure": "CRITIQUE",
  "non-conformité majeure": "CRITIQUE",
  // Mauvais (2)
  "mauvais": "MAUVAIS",
  "mauv": "MAUVAIS",
  "2": "MAUVAIS",
  "usure importante": "MAUVAIS",
  "sous performant": "MAUVAIS",
  "sous-performant": "MAUVAIS",
  "risques importants": "MAUVAIS",
  "difficile": "MAUVAIS",
  "non conformite mineure": "MAUVAIS",
  "non-conformite mineure": "MAUVAIS",
  "non conformité mineure": "MAUVAIS",
  "non-conformité mineure": "MAUVAIS",
  // Moyen (3)
  "moyen": "MOYEN",
  "moy": "MOYEN",
  "3": "MOYEN",
  "usure normale": "MOYEN",
  "acceptable": "MOYEN",
  "a surveiller": "MOYEN",
  "à surveiller": "MOYEN",
  "limite": "MOYEN",
  "limité": "MOYEN",
  "a verifier": "MOYEN",
  "à vérifier": "MOYEN",
  "a verifer": "MOYEN",
  // Bon (4)
  "bon": "BON",
  "4": "BON",
  "bon etat": "BON",
  "bon état": "BON",
  "performant": "BON",
  "conforme": "BON",
  "accessible": "BON",
  // Excellent (5)
  "excellent": "EXCELLENT",
  "exc": "EXCELLENT",
  "5": "EXCELLENT",
  "etat neuf": "EXCELLENT",
  "état neuf": "EXCELLENT",
  "optimal": "EXCELLENT",
  "securise": "EXCELLENT",
  "sécurisé": "EXCELLENT",
  "certifie": "EXCELLENT",
  "certifié": "EXCELLENT",
};

// Normalise un texte pour la recherche
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`´]/g, " ")
    .replace(/[-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Parse rating from input
function parseRating(input: string | undefined): string {
  if (!input || input.trim() === "") return "NON_EVALUE";

  const normalized = normalize(input.trim());

  // Check if already a valid rating
  if (VALID_RATINGS.includes(input.toUpperCase())) {
    return input.toUpperCase();
  }

  // Check synonyms
  if (RATING_SYNONYMS[normalized]) {
    return RATING_SYNONYMS[normalized];
  }

  return "NON_EVALUE";
}

// Parse date from various formats
function parseDate(input: string | undefined): Date | null {
  if (!input || input.trim() === "") return null;

  const trimmed = input.trim();

  // Try ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;
  }

  // Try French format (DD/MM/YYYY)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("/").map(Number);
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }

  // Try French format (DD-MM-YYYY)
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

interface ImportRow {
  // Equipment identification
  site?: string;
  type?: string;
  marque?: string;
  brand?: string;
  modele?: string;
  model?: string;
  numero_serie?: string;
  serial_number?: string;
  // Audit data
  date_audit?: string;
  audit_date?: string;
  auditeur?: string;
  auditor?: string;
  etat_visuel?: string;
  visual_state?: string;
  performance?: string;
  securite?: string;
  security?: string;
  accessibilite?: string;
  accessibility?: string;
  conformite?: string;
  compliance?: string;
  notes?: string;
  general_notes?: string;
}

// POST /api/equipments/audits/import - Import audits from CSV
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour importer des audits" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { rows, contractId, preview = true } = body as {
      rows: ImportRow[];
      contractId: string;
      preview?: boolean;
    };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Aucune donnée à importer" },
        { status: 400 }
      );
    }

    if (!contractId) {
      return NextResponse.json(
        { error: "ID du contrat requis" },
        { status: 400 }
      );
    }

    // Get sites for this contract
    const contractSites = await prisma.contractSite.findMany({
      where: { contractId },
      include: { site: true },
    });

    if (contractSites.length === 0) {
      return NextResponse.json(
        { error: "Aucun site associé à ce contrat" },
        { status: 400 }
      );
    }

    const siteIds = contractSites.map((cs) => cs.siteId);

    // Build site name -> id mapping
    const siteMap = new Map<string, string>();
    for (const cs of contractSites) {
      const name = normalize(cs.site.name);
      siteMap.set(name, cs.siteId);
      const nameWithCity = normalize(`${cs.site.name} ${cs.site.city || ""}`);
      siteMap.set(nameWithCity, cs.siteId);
    }

    // Get existing equipment for matching
    const existingEquipments = await prisma.equipment.findMany({
      where: {
        siteId: { in: siteIds },
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        serialNumber: true,
        siteId: true,
        type: true,
        brand: true,
        model: true,
        name: true,
        site: { select: { name: true } },
      },
    });

    // Build indexes for equipment matching
    const serialNumberMap = new Map<string, string>();
    const signatureMap = new Map<string, string>();

    for (const eq of existingEquipments) {
      if (eq.serialNumber) {
        serialNumberMap.set(normalize(eq.serialNumber), eq.id);
      }
      // Signature: siteId + type + brand + model (normalized)
      const signature = `${eq.siteId}|${eq.type}|${normalize(eq.brand || "")}|${normalize(eq.model || "")}`;
      signatureMap.set(signature, eq.id);
    }

    // Process rows
    const results: Array<{
      row: number;
      status: "ok" | "warning" | "error";
      equipmentId?: string;
      equipmentName?: string;
      site?: string;
      auditDate?: string;
      auditor?: string;
      visualState?: string;
      performance?: string;
      security?: string;
      accessibility?: string;
      compliance?: string;
      generalNotes?: string;
      message?: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result: typeof results[0] = {
        row: i + 1,
        status: "ok",
      };

      // Try to find the equipment
      let equipmentId: string | undefined;
      let matchMethod = "";

      // Method 1: Match by serial number
      const serialNumber = row.numero_serie || row.serial_number;
      if (serialNumber) {
        const normalizedSerial = normalize(serialNumber);
        if (serialNumberMap.has(normalizedSerial)) {
          equipmentId = serialNumberMap.get(normalizedSerial);
          matchMethod = "numéro de série";
        }
      }

      // Method 2: Match by site + type + brand + model
      if (!equipmentId) {
        const siteName = row.site?.trim();
        const type = row.type?.trim();
        const brand = row.marque || row.brand;
        const model = row.modele || row.model;

        if (siteName && type) {
          // Find site ID
          let siteId: string | undefined;
          const normalizedSite = normalize(siteName);

          if (siteMap.has(normalizedSite)) {
            siteId = siteMap.get(normalizedSite);
          } else {
            for (const [name, id] of siteMap.entries()) {
              if (name.includes(normalizedSite) || normalizedSite.includes(name)) {
                siteId = id;
                break;
              }
            }
          }

          if (siteId) {
            // Try to match by signature
            const signature = `${siteId}|${type.toUpperCase()}|${normalize(brand || "")}|${normalize(model || "")}`;
            if (signatureMap.has(signature)) {
              equipmentId = signatureMap.get(signature);
              matchMethod = "site + type + marque + modèle";
            }
          }
        }
      }

      if (!equipmentId) {
        result.status = "error";
        result.message = "Équipement non trouvé. Vérifiez le numéro de série ou la combinaison site/type/marque/modèle.";
        result.site = row.site;
        results.push(result);
        continue;
      }

      // Get equipment info for display
      const equipment = existingEquipments.find((eq) => eq.id === equipmentId);
      result.equipmentId = equipmentId;
      result.equipmentName = equipment?.name || `${equipment?.type} ${equipment?.brand || ""} ${equipment?.model || ""}`.trim();
      result.site = equipment?.site.name;

      // Parse audit date
      const auditDateStr = row.date_audit || row.audit_date;
      const auditDate = parseDate(auditDateStr);
      if (!auditDate) {
        result.status = "warning";
        result.message = `Date d'audit invalide ou manquante, utilisation de la date du jour`;
      }
      result.auditDate = auditDate ? auditDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

      // Parse other fields
      result.auditor = row.auditeur || row.auditor || undefined;
      result.visualState = parseRating(row.etat_visuel || row.visual_state);
      result.performance = parseRating(row.performance);
      result.security = parseRating(row.securite || row.security);
      result.accessibility = parseRating(row.accessibilite || row.accessibility);
      result.compliance = parseRating(row.conformite || row.compliance);
      result.generalNotes = row.notes || row.general_notes || undefined;

      results.push(result);
    }

    // If preview, just return results
    if (preview) {
      const validCount = results.filter((r) => r.status !== "error").length;
      const errorCount = results.filter((r) => r.status === "error").length;
      const warningCount = results.filter((r) => r.status === "warning").length;

      return NextResponse.json({
        preview: true,
        total: rows.length,
        valid: validCount,
        errors: errorCount,
        warnings: warningCount,
        results,
      });
    }

    // Import valid rows
    const validRows = results.filter((r) => r.status !== "error" && r.equipmentId);
    let created = 0;

    for (const row of validRows) {
      try {
        await prisma.equipmentAudit.create({
          data: {
            equipmentId: row.equipmentId!,
            auditDate: new Date(row.auditDate!),
            auditor: row.auditor || null,
            visualState: row.visualState as "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT",
            performance: row.performance as "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT",
            security: row.security as "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT",
            accessibility: row.accessibility as "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT",
            compliance: row.compliance as "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT",
            generalNotes: row.generalNotes || null,
          },
        });
        created++;
      } catch (err) {
        console.error(`Error creating audit for row ${row.row}:`, err);
      }
    }

    return NextResponse.json({
      preview: false,
      total: rows.length,
      created,
      errors: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (error) {
    console.error("Error importing audits:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'import des audits" },
      { status: 500 }
    );
  }
}
