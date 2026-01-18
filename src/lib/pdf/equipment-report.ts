import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/pricing/equipment-pricing";

// Types
type AuditRating = "NON_EVALUE" | "CRITIQUE" | "MAUVAIS" | "MOYEN" | "BON" | "EXCELLENT";

interface ReportEquipment {
  id: string;
  name: string | null;
  type: string;
  domain: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  power: number | null;
  location: string | null;
  level: string | null;
  imageUrl: string | null;
  status: string;
  site: {
    name: string;
    city?: string | null;
    address?: string | null;
    postalCode?: string | null;
  };
  audit?: {
    auditDate: string;
    auditor?: string | null;
    visualState: AuditRating;
    performance: AuditRating;
    security: AuditRating;
    accessibility: AuditRating;
    compliance: AuditRating;
    generalNotes?: string | null;
  };
  globalScore?: number | null;
}

interface ReportOptions {
  siteName?: string;
  organizationName?: string;
  siteAddress?: string;
  siteCity?: string;
  sitePostalCode?: string;
  auditDate?: string;
  auditorName?: string;
  coverImageUrl?: string;
  context?: string;
  scope?: string[];
  objectives?: string[];
  // New fields for configuration
  reportTitle?: string;  // Title for the header (e.g., "MyXploit" or custom)
  madeBy?: string;       // Who made the report (e.g., "Équipe technique")
}

// Domain labels
const DOMAIN_LABELS: Record<string, string> = {
  CHAUFFAGE: "Chauffage",
  ECS: "Eau chaude sanitaire",
  VENTILATION: "Ventilation",
  CLIMATISATION: "Climatisation",
  TRAITEMENT_EAU: "Traitement d'eau",
  PLOMBERIE: "Plomberie",
  CFO_CFA: "Électricité CFO/CFA",
  COMPTAGE: "Comptage",
  PISCINE: "Piscine",
  AUTRE: "Autre",
};

// Rating labels and colors
const RATING_LABELS: Record<AuditRating, string> = {
  NON_EVALUE: "Non évalué",
  CRITIQUE: "Critique",
  MAUVAIS: "Mauvais",
  MOYEN: "Moyen",
  BON: "Bon",
  EXCELLENT: "Excellent",
};

const RATING_COLORS: Record<AuditRating, [number, number, number]> = {
  CRITIQUE: [220, 38, 38],    // red-600
  MAUVAIS: [234, 88, 12],     // orange-600
  MOYEN: [202, 138, 4],       // yellow-600
  BON: [22, 163, 74],         // green-600
  EXCELLENT: [22, 163, 74],   // green-600
  NON_EVALUE: [156, 163, 175] // gray-400
};

const STATUS_LABELS: Record<string, string> = {
  OPERATIONNEL: "En service",
  MAINTENANCE: "En maintenance",
  PANNE: "En panne",
  HORS_SERVICE: "Hors service",
};

// Criteria labels for our 5 audit criteria
const CRITERIA_LABELS = {
  visualState: "État visuel",
  performance: "Performance",
  security: "Sécurité",
  accessibility: "Accessibilité",
  compliance: "Conformité",
};

const CRITERIA_SHORT = {
  visualState: "V",
  performance: "P",
  security: "S",
  accessibility: "A",
  compliance: "C",
};

// Convert image URL to base64 data URL
async function fetchImageAsBase64(url: string): Promise<string | null> {
  // If it's already a data URL, return as-is
  if (url.startsWith("data:")) {
    return url;
  }

  // Try using Image API first (better CORS handling for some cases)
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            resolve(dataUrl);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => {
        // Fallback: try fetch API
        fetch(url, { mode: "cors" })
          .then((response) => {
            if (!response.ok) throw new Error("Fetch failed");
            return response.blob();
          })
          .then((blob) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          })
          .catch(() => resolve(null));
      };

      img.src = url;
    });
  } catch {
    return null;
  }
}

// Preload all images with timeout
async function preloadImages(equipments: ReportEquipment[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  const equipmentsWithImages = equipments.filter((eq) => eq.imageUrl);

  console.log(`[PDF] Loading ${equipmentsWithImages.length} images...`);

  const imagePromises = equipmentsWithImages.map(async (eq) => {
    try {
      // Add timeout of 5 seconds per image
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const imagePromise = fetchImageAsBase64(eq.imageUrl!);

      const base64 = await Promise.race([imagePromise, timeoutPromise]);

      if (base64) {
        imageMap.set(eq.id, base64);
        console.log(`[PDF] Loaded image for ${eq.id}`);
      } else {
        console.warn(`[PDF] Failed to load image for ${eq.id}: ${eq.imageUrl}`);
      }
    } catch (error) {
      console.warn(`[PDF] Error loading image for ${eq.id}:`, error);
    }
  });

  await Promise.all(imagePromises);
  console.log(`[PDF] Successfully loaded ${imageMap.size}/${equipmentsWithImages.length} images`);
  return imageMap;
}

// Group equipments by domain
function groupByDomain(equipments: ReportEquipment[]): Map<string, ReportEquipment[]> {
  const grouped = new Map<string, ReportEquipment[]>();
  for (const eq of equipments) {
    const domain = eq.domain || "AUTRE";
    if (!grouped.has(domain)) {
      grouped.set(domain, []);
    }
    grouped.get(domain)!.push(eq);
  }
  return grouped;
}

// Group equipments by type
function groupByType(equipments: ReportEquipment[]): Map<string, ReportEquipment[]> {
  const grouped = new Map<string, ReportEquipment[]>();
  for (const eq of equipments) {
    const type = eq.type || "AUTRE";
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)!.push(eq);
  }
  return grouped;
}

// Calculate aggregate rating for a group of equipments
function calculateAggregateRating(equipments: ReportEquipment[], criterion: keyof typeof CRITERIA_LABELS): AuditRating {
  const ratings = equipments
    .filter(eq => eq.audit)
    .map(eq => eq.audit![criterion]);

  if (ratings.length === 0) return "NON_EVALUE";

  const ratingOrder: AuditRating[] = ["CRITIQUE", "MAUVAIS", "MOYEN", "BON", "EXCELLENT", "NON_EVALUE"];

  // Return the worst rating found
  for (const rating of ratingOrder) {
    if (ratings.includes(rating) && rating !== "NON_EVALUE") {
      return rating;
    }
  }
  return "NON_EVALUE";
}

// Calculate statistics
function calculateStats(equipments: ReportEquipment[]) {
  let totalScore = 0;
  let scoredCount = 0;
  const ratingCounts: Record<string, number> = {
    EXCELLENT: 0,
    BON: 0,
    MOYEN: 0,
    MAUVAIS: 0,
    CRITIQUE: 0,
    NON_EVALUE: 0,
  };

  for (const eq of equipments) {
    if (eq.globalScore && eq.globalScore > 0) {
      totalScore += eq.globalScore;
      scoredCount++;
    }
    const rating = eq.audit?.visualState || "NON_EVALUE";
    ratingCounts[rating]++;
  }

  return {
    total: equipments.length,
    averageScore: scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : "-",
    ratingCounts,
    auditedCount: equipments.filter(eq => eq.audit).length,
  };
}

// Get defects/issues from equipments
function getDefects(equipments: ReportEquipment[]): Array<{
  equipment: ReportEquipment;
  criterion: string;
  criterionLabel: string;
  rating: AuditRating;
  severity: "high" | "medium" | "low";
}> {
  const defects: Array<{
    equipment: ReportEquipment;
    criterion: string;
    criterionLabel: string;
    rating: AuditRating;
    severity: "high" | "medium" | "low";
  }> = [];

  for (const eq of equipments) {
    if (!eq.audit) continue;

    const criteria = ["visualState", "performance", "security", "accessibility", "compliance"] as const;

    for (const criterion of criteria) {
      const rating = eq.audit[criterion];
      if (rating === "CRITIQUE" || rating === "MAUVAIS" || rating === "MOYEN") {
        defects.push({
          equipment: eq,
          criterion,
          criterionLabel: CRITERIA_LABELS[criterion],
          rating,
          severity: rating === "CRITIQUE" ? "high" : rating === "MAUVAIS" ? "medium" : "low",
        });
      }
    }
  }

  // Sort by severity
  return defects.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export async function generateEquipmentReportPDF(
  equipments: ReportEquipment[],
  options: ReportOptions = {}
): Promise<void> {
  if (!equipments || equipments.length === 0) {
    alert("Aucun équipement à exporter");
    return;
  }

  console.log("Generating PDF for", equipments.length, "equipments");

  // Preload images
  let imageMap = new Map<string, string>();
  let coverImage: string | null = null;
  try {
    imageMap = await preloadImages(equipments);
    console.log("Loaded", imageMap.size, "images");

    // Try to load cover image
    if (options.coverImageUrl) {
      coverImage = await fetchImageAsBase64(options.coverImageUrl);
    } else if (equipments[0]?.imageUrl) {
      // Use first equipment image as fallback
      coverImage = imageMap.get(equipments[0].id) || null;
    }
  } catch (e) {
    console.warn("Error loading images:", e);
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Colors
  const primaryColor: [number, number, number] = [30, 41, 59]; // slate-800
  const accentColor: [number, number, number] = [234, 88, 12]; // orange-600
  const grayColor: [number, number, number] = [100, 116, 139]; // slate-500
  const lightGray: [number, number, number] = [248, 250, 252]; // slate-50
  const white: [number, number, number] = [255, 255, 255];

  // Track pages for table of contents
  const tocEntries: Array<{ title: string; page: number; level: number }> = [];
  let currentPage = 1;

  // Helper to add a new page
  const addNewPage = () => {
    doc.addPage();
    currentPage++;
    return 20;
  };

  // Helper to draw page header (for pages after cover)
  const drawPageHeader = () => {
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 12, "F");
    doc.setTextColor(...white);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const title = options.siteName || "Rapport d'état du patrimoine";
    doc.text(title, 14, 8);
    doc.text(options.reportTitle || "MyXploit", pageWidth - 14, 8, { align: "right" });
    doc.setTextColor(0, 0, 0);
  };

  // ============================================
  // PAGE 1: COVER PAGE
  // ============================================

  // Header band
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 50, "F");

  // Title
  doc.setTextColor(...white);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("RAPPORT D'ÉTAT", pageWidth / 2, 25, { align: "center" });
  doc.text("DU PATRIMOINE", pageWidth / 2, 38, { align: "center" });

  // Site name
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...accentColor);
  const siteName = options.siteName || equipments[0]?.site?.name || "Tous les sites";
  doc.setFillColor(...white);
  doc.roundedRect(20, 55, pageWidth - 40, 20, 3, 3, "F");
  doc.setTextColor(...primaryColor);
  doc.text(siteName, pageWidth / 2, 67, { align: "center" });

  // Cover image (only show if provided)
  let y = 85;
  if (coverImage) {
    try {
      const imgWidth = pageWidth - 40;
      const imgHeight = 100;
      doc.addImage(coverImage, "JPEG", 20, y, imgWidth, imgHeight);
      y += imgHeight + 10;
    } catch {
      // Skip if image fails to load
    }
  }
  // No placeholder if no image - just continue

  // Info box
  doc.setFillColor(...lightGray);
  doc.roundedRect(20, y, pageWidth - 40, 50, 3, 3, "F");

  y += 12;
  doc.setTextColor(...grayColor);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  // Date d'émission
  doc.text("Date d'émission", 30, y);
  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  doc.text(new Date().toLocaleDateString("fr-FR"), pageWidth - 30, y, { align: "right" });

  y += 10;
  doc.setTextColor(...grayColor);
  doc.setFont("helvetica", "normal");
  doc.text("Date de visite", 30, y);
  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  const auditDate = options.auditDate || equipments.find(eq => eq.audit)?.audit?.auditDate;
  doc.text(auditDate ? new Date(auditDate).toLocaleDateString("fr-FR") : "-", pageWidth - 30, y, { align: "right" });

  y += 10;
  doc.setTextColor(...grayColor);
  doc.setFont("helvetica", "normal");
  doc.text("Auditeur", 30, y);
  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  doc.text(options.auditorName || "-", pageWidth - 30, y, { align: "right" });

  y += 10;
  doc.setTextColor(...grayColor);
  doc.setFont("helvetica", "normal");
  doc.text("Équipements audités", 30, y);
  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  doc.text(equipments.length.toString(), pageWidth - 30, y, { align: "right" });

  // Report maker at bottom
  const reportMaker = options.madeBy || options.reportTitle || "MyXploit";
  doc.setTextColor(...grayColor);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(reportMaker, pageWidth / 2, pageHeight - 20, { align: "center" });

  // Footer
  doc.setTextColor(...grayColor);
  doc.setFontSize(8);
  doc.text("Rapport d'état du patrimoine", 14, pageHeight - 10);
  doc.text(`Créé le ${new Date().toLocaleDateString("fr-FR")}`, pageWidth / 2, pageHeight - 10, { align: "center" });
  doc.text("1/" + "{TOTAL}", pageWidth - 14, pageHeight - 10, { align: "right" });

  // ============================================
  // PAGE 2: TABLE OF CONTENTS (placeholder - will update later)
  // ============================================
  y = addNewPage();
  const tocPageNumber = currentPage;
  drawPageHeader();

  y = 25;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Sommaire", 14, y);
  y += 15;

  // We'll come back to fill this after we know all page numbers
  const tocStartY = y;

  // ============================================
  // PAGE 3: SYNTHESIS OF MISSION
  // ============================================
  y = addNewPage();
  drawPageHeader();
  tocEntries.push({ title: "1. Synthèse de la mission", page: currentPage, level: 1 });

  y = 25;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("1. Synthèse de la mission", 14, y);
  y += 12;

  // 1.1 Mission
  doc.setFontSize(12);
  doc.text("1.1 Mission", 14, y);
  tocEntries.push({ title: "1.1 Mission", page: currentPage, level: 2 });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  const visitDate = auditDate ? new Date(auditDate).toLocaleDateString("fr-FR") : new Date().toLocaleDateString("fr-FR");
  doc.text(`Date de visite : ${visitDate}`, 20, y);
  y += 12;

  // 1.2 Contexte
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("1.2 Contexte", 14, y);
  tocEntries.push({ title: "1.2 Contexte", page: currentPage, level: 2 });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);

  const contextText = options.context ||
    `Dans le cadre de la gestion du patrimoine technique, un audit a été réalisé sur les équipements du site ${siteName}. ` +
    `Cet audit vise à évaluer l'état général des installations et à identifier les actions de maintenance nécessaires.`;

  const contextLines = doc.splitTextToSize(contextText, pageWidth - 40);
  doc.text(contextLines, 20, y);
  y += contextLines.length * 5 + 10;

  // 1.3 Périmètre
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("1.3 Périmètre", 14, y);
  tocEntries.push({ title: "1.3 Périmètre", page: currentPage, level: 2 });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  doc.text("L'audit technique porte sur les domaines suivants :", 20, y);
  y += 6;

  const domains = Array.from(groupByDomain(equipments).keys());
  for (const domain of domains) {
    doc.text(`• ${DOMAIN_LABELS[domain] || domain}`, 25, y);
    y += 5;
  }
  y += 8;

  // 1.4 Objectif
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("1.4 Objectifs", 14, y);
  tocEntries.push({ title: "1.4 Objectifs", page: currentPage, level: 2 });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  doc.text("Cette évaluation a pour objectif :", 20, y);
  y += 6;

  const objectives = options.objectives || [
    "Quantifier et inventorier les équipements techniques",
    "Évaluer l'état visuel et le niveau de performance des équipements",
    "Identifier les problèmes de sécurité et de conformité",
    "Évaluer l'accessibilité des équipements pour la maintenance",
    "Identifier les priorités d'intervention et de renouvellement",
  ];

  for (const obj of objectives) {
    doc.text(`• ${obj}`, 25, y);
    y += 5;
  }

  // ============================================
  // PAGE 4: SCORING METHODOLOGY
  // ============================================
  y = addNewPage();
  drawPageHeader();
  tocEntries.push({ title: "2. Méthode de notation utilisée", page: currentPage, level: 1 });

  y = 25;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("2. Méthode de notation utilisée", 14, y);
  y += 12;

  // 2.1 Équipements
  doc.setFontSize(12);
  doc.text("2.1 Équipements", 14, y);
  tocEntries.push({ title: "2.1 Équipements", page: currentPage, level: 2 });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  doc.text("À l'issue de l'audit, un score est défini sur les 5 critères audités. Le tableau ci-après détaille le code couleur utilisé :", 20, y);
  y += 8;

  // Methodology table - uniform column widths
  const methodTableWidth = pageWidth - 28; // 14 + 14 margins
  const methodColWidth = methodTableWidth / 6; // 6 columns

  autoTable(doc, {
    startY: y,
    head: [["", "État visuel", "Performance", "Sécurité", "Accessibilité", "Conformité"]],
    body: [
      [
        { content: "Critique", styles: { fillColor: RATING_COLORS.CRITIQUE, textColor: [255, 255, 255] } },
        "Dégradation majeure",
        "Défaillant",
        "Danger immédiat",
        "Inaccessible",
        "Non-conformité majeure",
      ],
      [
        { content: "Mauvais", styles: { fillColor: RATING_COLORS.MAUVAIS, textColor: [255, 255, 255] } },
        "Usure importante",
        "Sous-performant",
        "Risques importants",
        "Difficile",
        "Non-conformité mineure",
      ],
      [
        { content: "Moyen", styles: { fillColor: RATING_COLORS.MOYEN, textColor: [255, 255, 255] } },
        "Usure normale",
        "Acceptable",
        "À surveiller",
        "Limité",
        "À vérifier",
      ],
      [
        { content: "Bon", styles: { fillColor: RATING_COLORS.BON, textColor: [255, 255, 255] } },
        "Bon état",
        "Performant",
        "Conforme",
        "Accessible",
        "Conforme",
      ],
      [
        { content: "Non évalué", styles: { fillColor: RATING_COLORS.NON_EVALUE } },
        "Non évalué",
        "Non évalué",
        "Non évalué",
        "Non évalué",
        "Non évalué",
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: primaryColor, fontSize: 8, cellPadding: 3, halign: "center" },
    bodyStyles: { fontSize: 8, cellPadding: 3, halign: "center" },
    columnStyles: {
      0: { cellWidth: methodColWidth, halign: "center", fontStyle: "bold" },
      1: { cellWidth: methodColWidth },
      2: { cellWidth: methodColWidth },
      3: { cellWidth: methodColWidth },
      4: { cellWidth: methodColWidth },
      5: { cellWidth: methodColWidth },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

  // 2.2 Score global
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("2.2 Score global", 14, y);
  tocEntries.push({ title: "2.2 Score global", page: currentPage, level: 2 });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  const scoreText = "Le score global (sur 5) est calculé comme la moyenne des 5 critères d'audit. " +
    "Un score de 5 indique un équipement en excellent état, tandis qu'un score de 1 indique un état critique.";
  const scoreLines = doc.splitTextToSize(scoreText, pageWidth - 40);
  doc.text(scoreLines, 20, y);

  // ============================================
  // PAGE 5: SITE INFORMATION
  // ============================================
  y = addNewPage();
  drawPageHeader();
  tocEntries.push({ title: "3. Informations sur le site", page: currentPage, level: 1 });

  y = 25;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("3. Informations sur le site", 14, y);
  y += 12;

  doc.setFontSize(12);
  doc.text("3.1 Carte d'identité", 14, y);
  tocEntries.push({ title: "3.1 Carte d'identité", page: currentPage, level: 2 });
  y += 8;

  const siteInfo = equipments[0]?.site;
  const siteData = [
    ["Nom du site", siteName],
    ["Adresse", options.siteAddress || siteInfo?.address || "-"],
    ["Code postal", options.sitePostalCode || siteInfo?.postalCode || "-"],
    ["Ville", options.siteCity || siteInfo?.city || "-"],
    ["Nombre d'équipements", equipments.length.toString()],
    ["Domaines couverts", domains.map(d => DOMAIN_LABELS[d] || d).join(", ")],
  ];

  autoTable(doc, {
    startY: y,
    body: siteData,
    theme: "plain",
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 60, textColor: grayColor, fontStyle: "normal" },
      1: { textColor: primaryColor, fontStyle: "bold", halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // ============================================
  // PAGE 6: FUNCTIONAL ANALYSIS
  // ============================================
  y = addNewPage();
  drawPageHeader();
  tocEntries.push({ title: "4. Analyse fonctionnelle", page: currentPage, level: 1 });

  y = 25;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("4. Analyse fonctionnelle", 14, y);
  y += 12;

  const byDomain = groupByDomain(equipments);

  for (const [domain, domainEquipments] of byDomain) {
    if (y > pageHeight - 40) {
      y = addNewPage();
      drawPageHeader();
      y = 25;
    }

    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(DOMAIN_LABELS[domain] || domain, 14, y);
    y += 6;

    // Count by type
    const byType = groupByType(domainEquipments);
    const typeCounts: string[] = [];

    for (const [type, typeEquipments] of byType) {
      const label = EQUIPMENT_TYPE_LABELS[type] || type;
      typeCounts.push(`${typeEquipments.length} x ${label}`);
    }

    // Draw as tags
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let tagX = 20;
    const tagY = y;
    const maxWidth = pageWidth - 30;

    for (const tag of typeCounts) {
      const tagWidth = doc.getTextWidth(tag) + 8;

      if (tagX + tagWidth > maxWidth) {
        y += 8;
        tagX = 20;
      }

      // Draw tag background
      doc.setFillColor(...lightGray);
      doc.roundedRect(tagX, y - 4, tagWidth, 7, 1, 1, "F");

      // Draw tag text
      doc.setTextColor(...grayColor);
      doc.text(tag, tagX + 4, y);

      tagX += tagWidth + 4;
    }

    y += 12;
  }

  // ============================================
  // PAGE 7: PATRIMOINE STATE MATRICES
  // ============================================
  y = addNewPage();
  drawPageHeader();
  tocEntries.push({ title: "5. États du patrimoine", page: currentPage, level: 1 });

  y = 25;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("5. États du patrimoine", 14, y);
  y += 12;

  // Color legend
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grayColor);
  doc.text("Légende des couleurs :", 14, y);
  y += 6;

  const legendItems: Array<{ label: string; color: [number, number, number] }> = [
    { label: "Excellent", color: RATING_COLORS.EXCELLENT },
    { label: "Bon", color: RATING_COLORS.BON },
    { label: "Moyen", color: RATING_COLORS.MOYEN },
    { label: "Mauvais", color: RATING_COLORS.MAUVAIS },
    { label: "Critique", color: RATING_COLORS.CRITIQUE },
    { label: "Non évalué", color: RATING_COLORS.NON_EVALUE },
  ];

  let legendX = 20;
  for (const item of legendItems) {
    doc.setFillColor(...item.color);
    doc.roundedRect(legendX, y - 3, 8, 8, 1, 1, "F");
    doc.setTextColor(...grayColor);
    doc.setFontSize(7);
    doc.text(item.label, legendX + 10, y + 2);
    legendX += 32;
  }
  y += 15;

  // Matrix by domain
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Matrice par domaine", 14, y);
  y += 10;

  // Draw matrix header with full names
  const matrixX = 55;
  const cellSize = 25;
  const cellSpacing = 2;
  const criteria = ["visualState", "performance", "security", "accessibility", "compliance"] as const;
  const criteriaHeaderLabels = ["Visuel", "Perf.", "Sécu.", "Access.", "Conf."];

  // Domain labels on left
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");

  // Criteria headers
  let headerX = matrixX;
  for (let i = 0; i < criteriaHeaderLabels.length; i++) {
    doc.setTextColor(...grayColor);
    doc.text(criteriaHeaderLabels[i], headerX + cellSize / 2, y, { align: "center" });
    headerX += cellSize + cellSpacing;
  }
  y += 6;

  doc.setFont("helvetica", "normal");

  // Draw matrix rows
  for (const [domain, domainEquipments] of byDomain) {
    if (y > pageHeight - 30) {
      y = addNewPage();
      drawPageHeader();
      y = 25;
    }

    // Domain label
    doc.setTextColor(...primaryColor);
    doc.setFontSize(8);
    const domainLabel = DOMAIN_LABELS[domain] || domain;
    doc.text(domainLabel, 14, y + cellSize / 2);

    // Rating cells
    let cellX = matrixX;
    for (const criterion of criteria) {
      const rating = calculateAggregateRating(domainEquipments, criterion);
      const color = RATING_COLORS[rating];
      doc.setFillColor(...color);
      doc.roundedRect(cellX, y, cellSize, cellSize - 8, 2, 2, "F");
      cellX += cellSize + cellSpacing;
    }

    y += cellSize - 4;
  }

  // ============================================
  // PAGES: SYNTHESIS BY DOMAIN
  // ============================================
  // Add section 6 title page
  y = addNewPage();
  drawPageHeader();
  tocEntries.push({ title: "6. Synthèse par domaine", page: currentPage, level: 1 });

  y = 25;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("6. Synthèse par domaine", 14, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  doc.text("Cette section présente l'analyse détaillée de chaque domaine technique :", 14, y);
  y += 8;

  for (const [domain] of byDomain) {
    doc.text(`• ${DOMAIN_LABELS[domain] || domain}`, 20, y);
    y += 5;
  }

  let domainIndex = 1;
  for (const [domain, domainEquipments] of byDomain) {
    y = addNewPage();
    drawPageHeader();
    tocEntries.push({ title: `6.${domainIndex} ${DOMAIN_LABELS[domain] || domain}`, page: currentPage, level: 2 });

    y = 25;
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`6.${domainIndex} Domaine ${DOMAIN_LABELS[domain] || domain}`, 14, y);
    y += 12;

    // Score section
    doc.setFontSize(11);
    doc.text("Score", 14, y);
    y += 10;

    // Draw score circles
    const circleRadius = 12;
    const circleSpacing = 35;
    let circleX = 30;

    for (const criterion of criteria) {
      const rating = calculateAggregateRating(domainEquipments, criterion);
      const color = RATING_COLORS[rating];

      // Draw circle
      doc.setFillColor(...color);
      doc.circle(circleX, y + circleRadius, circleRadius, "F");

      // Label below
      doc.setTextColor(...grayColor);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const label = CRITERIA_LABELS[criterion];
      doc.text(label, circleX, y + circleRadius * 2 + 6, { align: "center" });

      circleX += circleSpacing;
    }

    y += circleRadius * 2 + 15;

    // Equipment list
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Liste des équipements", 14, y);
    y += 5;

    const tableBody = domainEquipments.map((eq) => {
      const imageData = imageMap.get(eq.id);
      const audit = eq.audit;
      const name = eq.name || EQUIPMENT_TYPE_LABELS[eq.type] || eq.type;

      return {
        imageData,
        name,
        level: eq.level || "-",
        location: eq.location || "-",
        brand: eq.brand || "-",
        status: STATUS_LABELS[eq.status] || eq.status,
        ratings: {
          V: audit?.visualState || "NON_EVALUE",
          P: audit?.performance || "NON_EVALUE",
          S: audit?.security || "NON_EVALUE",
          A: audit?.accessibility || "NON_EVALUE",
          C: audit?.compliance || "NON_EVALUE",
        },
      };
    });

    // Calculate available width (pageWidth - left margin - right margin)
    const availableWidth = pageWidth - 28; // 14 + 14 margins
    const colWidth = availableWidth / 11; // 11 columns

    autoTable(doc, {
      startY: y,
      head: [["Photo", "Équipement", "Niveau", "Local", "Marque", "Statut", "Vis.", "Perf.", "Sécu.", "Acc.", "Conf."]],
      body: tableBody.map((row) => [
        "", // Photo placeholder
        row.name,
        row.level,
        row.location,
        row.brand,
        row.status,
        "", "", "", "", "", // Rating placeholders
      ]),
      theme: "grid",
      headStyles: { fillColor: primaryColor, fontSize: 6, cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 2, minCellHeight: 20, valign: "middle" },
      columnStyles: {
        0: { cellWidth: colWidth * 1.2 },      // Photo
        1: { cellWidth: colWidth * 2 },         // Équipement
        2: { cellWidth: colWidth * 0.8 },       // Niveau
        3: { cellWidth: colWidth * 1.2 },       // Local
        4: { cellWidth: colWidth * 1.2 },       // Marque
        5: { cellWidth: colWidth * 1.2 },       // Statut
        6: { cellWidth: colWidth * 0.68, halign: "center" },  // Vis.
        7: { cellWidth: colWidth * 0.68, halign: "center" },  // Perf.
        8: { cellWidth: colWidth * 0.68, halign: "center" },  // Sécu.
        9: { cellWidth: colWidth * 0.68, halign: "center" },  // Acc.
        10: { cellWidth: colWidth * 0.68, halign: "center" }, // Conf.
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (data) => {
        if (data.section === "body") {
          const rowData = tableBody[data.row.index];
          if (!rowData) return;

          // Draw photo
          if (data.column.index === 0 && rowData.imageData) {
            try {
              const imgSize = Math.min(data.cell.width - 2, data.cell.height - 2, 16);
              doc.addImage(
                rowData.imageData,
                "JPEG",
                data.cell.x + 1,
                data.cell.y + 1,
                imgSize,
                imgSize
              );
            } catch {
              // Skip
            }
          }

          // Draw rating colors
          const ratingColumns = [6, 7, 8, 9, 10];
          const ratingKeys = ["V", "P", "S", "A", "C"] as const;

          if (ratingColumns.includes(data.column.index)) {
            const ratingIndex = data.column.index - 6;
            const ratingKey = ratingKeys[ratingIndex];
            const rating = rowData.ratings[ratingKey] as AuditRating;
            const color = RATING_COLORS[rating];

            doc.setFillColor(...color);
            doc.roundedRect(
              data.cell.x + 1,
              data.cell.y + 1,
              data.cell.width - 2,
              data.cell.height - 2,
              1,
              1,
              "F"
            );
          }
        }
      },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Defects list
    const domainDefects = getDefects(domainEquipments);

    if (domainDefects.length > 0) {
      if (y > pageHeight - 60) {
        y = addNewPage();
        drawPageHeader();
        y = 25;
      }

      doc.setTextColor(...primaryColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Liste des défauts", 14, y);
      y += 5;

      const defectBody = domainDefects.slice(0, 10).map((d) => {
        const severityColor = d.severity === "high" ? RATING_COLORS.CRITIQUE :
          d.severity === "medium" ? RATING_COLORS.MAUVAIS : RATING_COLORS.MOYEN;

        return {
          action: `Vérifier ${d.criterionLabel.toLowerCase()}`,
          equipment: d.equipment.name || EQUIPMENT_TYPE_LABELS[d.equipment.type] || d.equipment.type,
          location: d.equipment.location || "-",
          category: d.criterionLabel,
          severityColor,
        };
      });

      autoTable(doc, {
        startY: y,
        head: [["Action", "Équipement", "Localisation", "Catégorie"]],
        body: defectBody.map((d) => [d.action, d.equipment, d.location, d.category]),
        theme: "grid",
        headStyles: { fillColor: [220, 38, 38], fontSize: 8, cellPadding: 2 },
        bodyStyles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
        didDrawCell: (data) => {
          if (data.section === "body" && data.column.index === 3) {
            const d = defectBody[data.row.index];
            if (d) {
              doc.setFillColor(...d.severityColor);
              doc.rect(data.cell.x + data.cell.width - 3, data.cell.y + 2, 2, data.cell.height - 4, "F");
            }
          }
        },
      });

      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    } else {
      doc.setTextColor(...grayColor);
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text("Aucun défaut constaté", 20, y);
      y += 10;
    }

    // Photo gallery
    if (y > pageHeight - 80) {
      y = addNewPage();
      drawPageHeader();
      y = 25;
    }

    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Photothèque", 14, y);
    y += 8;

    const photosPerRow = 4;
    const photoSize = 40;
    const photoSpacing = 5;
    let photoX = 14;
    let photoIndex = 1;
    let photosDrawn = 0;
    const maxPhotos = 8;

    for (const eq of domainEquipments) {
      if (photosDrawn >= maxPhotos) break;

      const imageData = imageMap.get(eq.id);
      if (!imageData) continue;

      if (photoX + photoSize > pageWidth - 14) {
        photoX = 14;
        y += photoSize + 15;

        if (y > pageHeight - photoSize - 20) {
          y = addNewPage();
          drawPageHeader();
          y = 25;
        }
      }

      try {
        doc.addImage(imageData, "JPEG", photoX, y, photoSize, photoSize);

        // Photo number
        doc.setFillColor(...accentColor);
        doc.circle(photoX + 5, y + 5, 4, "F");
        doc.setTextColor(...white);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(photoIndex.toString(), photoX + 5, y + 6.5, { align: "center" });

        // Caption
        doc.setTextColor(...grayColor);
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        const caption = (eq.name || EQUIPMENT_TYPE_LABELS[eq.type] || eq.type).substring(0, 20);
        doc.text(`${photoIndex}. ${caption}`, photoX, y + photoSize + 4);

        photoX += photoSize + photoSpacing;
        photoIndex++;
        photosDrawn++;
      } catch {
        // Skip failed images
      }
    }

    domainIndex++;
  }

  // ============================================
  // FINAL PAGE: GLOBAL SYNTHESIS
  // ============================================
  y = addNewPage();
  drawPageHeader();
  tocEntries.push({ title: "7. Synthèse globale", page: currentPage, level: 1 });

  y = 25;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("7. Synthèse globale", 14, y);
  y += 12;

  const stats = calculateStats(equipments);
  const allDefects = getDefects(equipments);

  // Summary stats
  doc.setFillColor(...lightGray);
  doc.roundedRect(14, y, pageWidth - 28, 30, 3, 3, "F");
  y += 10;

  doc.setFontSize(10);
  const statItems = [
    { label: "Équipements audités", value: `${stats.auditedCount}/${stats.total}` },
    { label: "Score moyen", value: stats.averageScore !== "-" ? `${stats.averageScore}/5` : "-" },
    { label: "Défauts identifiés", value: allDefects.length.toString() },
    { label: "Critiques", value: stats.ratingCounts.CRITIQUE.toString(), color: RATING_COLORS.CRITIQUE },
  ];

  let statX = 25;
  for (const stat of statItems) {
    doc.setTextColor(...grayColor);
    doc.setFont("helvetica", "normal");
    doc.text(stat.label, statX, y);
    const colorToUse = stat.color || primaryColor;
    doc.setTextColor(...colorToUse);
    doc.setFont("helvetica", "bold");
    doc.text(stat.value, statX, y + 6);
    statX += 45;
  }

  y += 30;

  // Key findings
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Points clés", 14, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);

  const findings: string[] = [];

  if (stats.ratingCounts.CRITIQUE > 0) {
    findings.push(`${stats.ratingCounts.CRITIQUE} équipement(s) en état critique nécessitant une intervention urgente.`);
  }
  if (stats.ratingCounts.MAUVAIS > 0) {
    findings.push(`${stats.ratingCounts.MAUVAIS} équipement(s) en mauvais état à surveiller.`);
  }
  if (allDefects.filter(d => d.criterion === "security").length > 0) {
    findings.push(`${allDefects.filter(d => d.criterion === "security").length} problème(s) de sécurité identifié(s).`);
  }
  if (allDefects.filter(d => d.criterion === "compliance").length > 0) {
    findings.push(`${allDefects.filter(d => d.criterion === "compliance").length} problème(s) de conformité à traiter.`);
  }
  if (findings.length === 0) {
    findings.push("L'ensemble du patrimoine est en bon état général.");
  }

  for (const finding of findings) {
    doc.text(`• ${finding}`, 20, y);
    y += 6;
  }

  // ============================================
  // UPDATE TABLE OF CONTENTS
  // ============================================
  doc.setPage(tocPageNumber);
  let tocY = tocStartY;

  doc.setFontSize(10);
  for (const entry of tocEntries) {
    const indent = entry.level === 2 ? 10 : 0;
    doc.setFont("helvetica", entry.level === 1 ? "bold" : "normal");
    doc.setTextColor(...primaryColor);
    doc.text(entry.title, 14 + indent, tocY);

    // Dots
    const titleWidth = doc.getTextWidth(entry.title);
    const pageNumWidth = doc.getTextWidth(entry.page.toString());
    const dotsStart = 14 + indent + titleWidth + 2;
    const dotsEnd = pageWidth - 14 - pageNumWidth - 2;

    doc.setTextColor(...grayColor);
    let dotX = dotsStart;
    while (dotX < dotsEnd) {
      doc.text(".", dotX, tocY);
      dotX += 2;
    }

    doc.setTextColor(...primaryColor);
    doc.text(entry.page.toString(), pageWidth - 14, tocY, { align: "right" });

    tocY += entry.level === 1 ? 7 : 5;
  }

  // ============================================
  // UPDATE FOOTERS WITH TOTAL PAGE COUNT
  // ============================================
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setTextColor(...grayColor);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    // Clear the placeholder and write actual page numbers
    doc.setFillColor(...white);
    doc.rect(pageWidth - 30, pageHeight - 14, 25, 8, "F");
    doc.text(`${i}/${totalPages}`, pageWidth - 14, pageHeight - 10, { align: "right" });

    if (i > 1) {
      doc.text("Rapport d'état du patrimoine", 14, pageHeight - 10);
      doc.text(`Créé le ${new Date().toLocaleDateString("fr-FR")}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    }
  }

  // ============================================
  // SAVE PDF
  // ============================================
  const dateStr = new Date().toISOString().split("T")[0];
  const sitePart = (options.siteName || "tous-sites")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const fileName = `rapport-patrimoine-${sitePart}-${dateStr}.pdf`;

  console.log("Saving PDF as:", fileName);
  doc.save(fileName);
  console.log("PDF saved successfully");
}
