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
  site: { name: string; city?: string | null };
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
}

// Domain labels
const DOMAIN_LABELS: Record<string, string> = {
  CHAUFFAGE: "Chauffage",
  ECS: "Eau chaude sanitaire",
  VENTILATION: "Ventilation",
  CLIMATISATION: "Climatisation",
  TRAITEMENT_EAU: "Traitement d'eau",
  PLOMBERIE: "Plomberie",
  CFO_CFA: "CFO / CFA",
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
  OPERATIONNEL: "Opérationnel",
  MAINTENANCE: "En maintenance",
  PANNE: "En panne",
  HORS_SERVICE: "Hors service",
};

// Convert image URL to base64 data URL
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Preload all images
async function preloadImages(equipments: ReportEquipment[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  const imagePromises = equipments
    .filter((eq) => eq.imageUrl)
    .map(async (eq) => {
      const base64 = await fetchImageAsBase64(eq.imageUrl!);
      if (base64) {
        imageMap.set(eq.id, base64);
      }
    });
  await Promise.all(imagePromises);
  return imageMap;
}

// Group equipments by site then domain
function groupEquipments(equipments: ReportEquipment[]): Map<string, Map<string, ReportEquipment[]>> {
  const grouped = new Map<string, Map<string, ReportEquipment[]>>();

  for (const eq of equipments) {
    const siteName = eq.site?.name || "Site inconnu";
    const domain = eq.domain || "AUTRE";
    if (!grouped.has(siteName)) {
      grouped.set(siteName, new Map());
    }
    const siteGroup = grouped.get(siteName)!;
    if (!siteGroup.has(domain)) {
      siteGroup.set(domain, []);
    }
    siteGroup.get(domain)!.push(eq);
  }

  return grouped;
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

    // Count by worst rating (visual state as primary indicator)
    const rating = eq.audit?.visualState || "NON_EVALUE";
    ratingCounts[rating]++;
  }

  return {
    total: equipments.length,
    averageScore: scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : "-",
    ratingCounts,
  };
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

  // Preload images (with error handling)
  let imageMap = new Map<string, string>();
  try {
    imageMap = await preloadImages(equipments);
    console.log("Loaded", imageMap.size, "images");
  } catch (e) {
    console.warn("Error loading images:", e);
  }

  let doc: jsPDF;
  try {
    doc = new jsPDF();
  } catch (e) {
    console.error("Error creating jsPDF instance:", e);
    throw new Error("Impossible de créer le document PDF");
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;

  // Colors
  const primaryColor: [number, number, number] = [30, 41, 59]; // slate-800
  const accentColor: [number, number, number] = [234, 88, 12]; // orange-600
  const grayColor: [number, number, number] = [100, 116, 139]; // slate-500
  const lightGray: [number, number, number] = [248, 250, 252]; // slate-50

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("RAPPORT D'ÉTAT DU PATRIMOINE", pageWidth / 2, 18, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const subtitle = options.siteName || "Tous les sites";
  doc.text(subtitle, pageWidth / 2, 30, { align: "center" });

  y = 50;

  // Organization and date
  doc.setTextColor(...grayColor);
  doc.setFontSize(10);
  if (options.organizationName) {
    doc.text(options.organizationName, 14, y);
  }
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, pageWidth - 14, y, { align: "right" });
  y += 10;

  // Statistics summary
  const stats = calculateStats(equipments);

  doc.setFillColor(...lightGray);
  doc.roundedRect(14, y, pageWidth - 28, 28, 3, 3, "F");

  y += 8;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RÉSUMÉ", 20, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Summary grid
  const summaryItems = [
    { label: "Total équipements", value: stats.total.toString() },
    { label: "Score moyen", value: stats.averageScore !== "-" ? `${stats.averageScore}/5` : "-" },
    { label: "Excellent/Bon", value: (stats.ratingCounts.EXCELLENT + stats.ratingCounts.BON).toString(), color: RATING_COLORS.BON },
    { label: "Moyen", value: stats.ratingCounts.MOYEN.toString(), color: RATING_COLORS.MOYEN },
    { label: "Mauvais/Critique", value: (stats.ratingCounts.MAUVAIS + stats.ratingCounts.CRITIQUE).toString(), color: RATING_COLORS.CRITIQUE },
  ];

  let xPos = 20;
  for (const item of summaryItems) {
    doc.setTextColor(...grayColor);
    doc.text(item.label, xPos, y);
    if (item.color) {
      doc.setTextColor(...item.color);
    } else {
      doc.setTextColor(...primaryColor);
    }
    doc.setFont("helvetica", "bold");
    doc.text(item.value, xPos, y + 5);
    doc.setFont("helvetica", "normal");
    xPos += 36;
  }

  y += 22;

  // Group equipments
  const grouped = groupEquipments(equipments);

  // Iterate through sites
  for (const [siteName, domainMap] of grouped) {
    // Check if we need a new page
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    // Site header
    doc.setFillColor(...accentColor);
    doc.roundedRect(14, y, pageWidth - 28, 10, 2, 2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`SITE: ${siteName}`, 20, y + 7);
    y += 15;

    // Iterate through domains
    for (const [domain, domainEquipments] of domainMap) {
      // Check if we need a new page
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 20;
      }

      // Domain header
      doc.setTextColor(...primaryColor);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(DOMAIN_LABELS[domain] || domain, 14, y);
      y += 3;

      // Equipment table for this domain
      const tableBody = domainEquipments.map((eq) => {
        const imageData = imageMap.get(eq.id);
        const audit = eq.audit;

        // Build info text
        const info: string[] = [];
        const name = eq.name || EQUIPMENT_TYPE_LABELS[eq.type] || eq.type;
        info.push(name);
        if (eq.brand || eq.model) {
          info.push(`${eq.brand || ""} ${eq.model || ""}`.trim());
        }
        if (eq.year || eq.power) {
          const details: string[] = [];
          if (eq.year) details.push(`${eq.year}`);
          if (eq.power) details.push(`${eq.power} kW`);
          info.push(details.join(" | "));
        }
        if (eq.location || eq.level) {
          info.push(`${eq.location || ""} ${eq.level ? `(${eq.level})` : ""}`.trim());
        }

        // Build audit text
        const auditInfo: string[] = [];
        if (audit) {
          auditInfo.push(`Audit: ${new Date(audit.auditDate).toLocaleDateString("fr-FR")}`);
          if (eq.globalScore) {
            auditInfo.push(`Score: ${eq.globalScore.toFixed(1)}/5`);
          }
          auditInfo.push(`• Visuel: ${RATING_LABELS[audit.visualState]}`);
          auditInfo.push(`• Performance: ${RATING_LABELS[audit.performance]}`);
          auditInfo.push(`• Sécurité: ${RATING_LABELS[audit.security]}`);
          auditInfo.push(`• Accessibilité: ${RATING_LABELS[audit.accessibility]}`);
          auditInfo.push(`• Conformité: ${RATING_LABELS[audit.compliance]}`);
          if (audit.generalNotes) {
            const notes = audit.generalNotes.length > 100
              ? audit.generalNotes.substring(0, 100) + "..."
              : audit.generalNotes;
            auditInfo.push(`Notes: ${notes}`);
          }
        } else {
          auditInfo.push("Pas d'audit");
        }

        return {
          imageData,
          info: info.join("\n"),
          audit: auditInfo.join("\n"),
          status: STATUS_LABELS[eq.status] || eq.status,
          rating: audit?.visualState || "NON_EVALUE",
        };
      });

      autoTable(doc, {
        startY: y,
        head: [["Photo", "Équipement", "Audit", "État"]],
        body: tableBody.map((row) => [
          "", // Photo will be drawn manually
          row.info,
          row.audit,
          row.status,
        ]),
        theme: "grid",
        headStyles: {
          fillColor: primaryColor,
          fontSize: 8,
          cellPadding: 3,
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
          minCellHeight: 35,
          valign: "top",
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 55 },
          2: { cellWidth: 70 },
          3: { cellWidth: 25, halign: "center" },
        },
        margin: { left: 14, right: 14 },
        didDrawCell: (data) => {
          // Draw images in first column
          if (data.column.index === 0 && data.section === "body") {
            const rowData = tableBody[data.row.index];
            if (rowData.imageData) {
              const cellX = data.cell.x + 2;
              const cellY = data.cell.y + 2;
              const imgSize = Math.min(data.cell.width - 4, data.cell.height - 4, 26);
              try {
                doc.addImage(rowData.imageData, "JPEG", cellX, cellY, imgSize, imgSize);
              } catch {
                // Image loading failed, skip
              }
            }

            // Draw rating color indicator
            const ratingColor = RATING_COLORS[rowData.rating as AuditRating];
            doc.setFillColor(...ratingColor);
            doc.rect(data.cell.x + data.cell.width - 4, data.cell.y + 2, 2, data.cell.height - 4, "F");
          }
        },
      });

      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    y += 5;
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(...grayColor);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} / ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
    doc.text(
      "Généré par MyXploit",
      14,
      pageHeight - 10
    );
  }

  // Generate filename
  const dateStr = new Date().toISOString().split("T")[0];
  const sitePart = options.siteName
    ? options.siteName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    : "tous-sites";
  const fileName = `rapport-patrimoine-${sitePart}-${dateStr}.pdf`;

  console.log("Saving PDF as:", fileName);

  try {
    doc.save(fileName);
    console.log("PDF saved successfully");
  } catch (e) {
    console.error("Error saving PDF:", e);
    throw new Error("Erreur lors de la sauvegarde du PDF");
  }
}
