import jsPDF from "jspdf";
import "jspdf-autotable";

// Types
interface ChecklistItem {
  equipmentType: string;
  itemId: string;
  label: string;
  category: string;
  result: "CONFORME" | "NON_CONFORME" | "NA" | "NON_VERIFIE";
  notes?: string;
  conformeText?: string;
  nonConformeText?: string;
  regulatoryReference?: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  estimatedCostMin: number | null;
  estimatedCostMax: number | null;
  priority: number;
  auditorNotes?: string;
}

interface TechnicalAudit {
  id: string;
  auditDate: string;
  auditor: string | null;
  checklistItems: ChecklistItem[];
  globalResult: "CONFORME" | "NON_CONFORME" | "PARTIEL" | "NON_VERIFIE";
  generalNotes: string | null;
  recommendations?: Recommendation[];
}

interface Site {
  name: string;
  address?: string;
  city?: string;
  postalCode?: string;
}

interface GeneratePDFOptions {
  audit: TechnicalAudit;
  site: Site;
  categoryLabels: Record<string, string>;
  organizationName?: string;
}

const RESULT_LABELS: Record<string, string> = {
  CONFORME: "Conforme",
  NON_CONFORME: "Non conforme",
  NA: "Non applicable",
  NON_VERIFIE: "Non vérifié",
  PARTIEL: "Partiellement conforme",
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "Urgent",
  2: "Court terme",
  3: "Moyen terme",
  4: "Long terme",
};

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: unknown) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export function generateTechnicalAuditPDF({
  audit,
  site,
  categoryLabels,
  organizationName = "MyXploit",
}: GeneratePDFOptions): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let currentY = margin;

  // Colors
  const primaryColor: [number, number, number] = [147, 51, 234]; // Purple
  const successColor: [number, number, number] = [34, 197, 94]; // Green
  const dangerColor: [number, number, number] = [239, 68, 68]; // Red
  const warningColor: [number, number, number] = [249, 115, 22]; // Orange
  const grayColor: [number, number, number] = [107, 114, 128];

  // Helper functions
  const addNewPageIfNeeded = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatCost = (min: number | null, max: number | null) => {
    if (min === null && max === null) return "À chiffrer";
    if (min === max || max === null) return `${(min || 0).toLocaleString("fr-FR")} €`;
    return `${(min || 0).toLocaleString("fr-FR")} - ${(max || 0).toLocaleString("fr-FR")} €`;
  };

  // ============================================
  // PAGE 1: Cover Page
  // ============================================

  // Header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, "F");

  // Organization name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(organizationName, margin, 15);

  // Title
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("RAPPORT D'AUDIT TECHNIQUE", margin, 32);

  currentY = 60;

  // Site info box
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 50, 3, 3, "F");

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(site.name, margin + 10, currentY + 15);

  if (site.address) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayColor);
    let addressText = site.address;
    if (site.postalCode) addressText += `, ${site.postalCode}`;
    if (site.city) addressText += ` ${site.city}`;
    doc.text(addressText, margin + 10, currentY + 28);
  }

  // Audit info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Date de l'audit : ${formatDate(audit.auditDate)}`, margin + 10, currentY + 40);
  if (audit.auditor) {
    doc.text(`Auditeur : ${audit.auditor}`, pageWidth / 2, currentY + 40);
  }

  currentY += 65;

  // Global result box
  const resultColor = audit.globalResult === "CONFORME" ? successColor :
                      audit.globalResult === "NON_CONFORME" ? dangerColor :
                      audit.globalResult === "PARTIEL" ? warningColor : grayColor;

  doc.setFillColor(...resultColor);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 35, 3, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("RÉSULTAT GLOBAL", margin + 10, currentY + 12);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(RESULT_LABELS[audit.globalResult].toUpperCase(), margin + 10, currentY + 27);

  // Stats on the right
  const stats = {
    conforme: audit.checklistItems.filter((i) => i.result === "CONFORME").length,
    nonConforme: audit.checklistItems.filter((i) => i.result === "NON_CONFORME").length,
    na: audit.checklistItems.filter((i) => i.result === "NA").length,
    total: audit.checklistItems.length,
  };

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const statsText = `${stats.conforme} conforme(s) | ${stats.nonConforme} non conforme(s) | ${stats.na} N/A`;
  doc.text(statsText, pageWidth - margin - 10, currentY + 20, { align: "right" });

  currentY += 50;

  // Summary section
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("SYNTHÈSE", margin, currentY);

  currentY += 10;

  // Summary table
  const summaryData = [
    ["Points de contrôle", stats.total.toString()],
    ["Conformes", stats.conforme.toString()],
    ["Non conformes", stats.nonConforme.toString()],
    ["Non applicables", stats.na.toString()],
  ];

  if (audit.recommendations && audit.recommendations.length > 0) {
    const totalCostMin = audit.recommendations.reduce((sum, r) => sum + (r.estimatedCostMin || 0), 0);
    const totalCostMax = audit.recommendations.reduce((sum, r) => sum + (r.estimatedCostMax || 0), 0);
    summaryData.push(["Préconisations", audit.recommendations.length.toString()]);
    summaryData.push(["Estimation totale", formatCost(totalCostMin, totalCostMax)]);
  }

  doc.autoTable({
    startY: currentY,
    head: [],
    body: summaryData,
    theme: "plain",
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60 },
      1: { halign: "left" },
    },
    margin: { left: margin, right: margin },
  });

  currentY = doc.lastAutoTable.finalY + 15;

  // ============================================
  // PAGE 2+: Detailed Results
  // ============================================
  doc.addPage();
  currentY = margin;

  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DÉTAIL DES CONTRÔLES", margin, 13);

  currentY = 35;

  // Group items by category
  const itemsByCategory = audit.checklistItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  // Render each category
  for (const [category, items] of Object.entries(itemsByCategory)) {
    addNewPageIfNeeded(40);

    // Category header
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, currentY, pageWidth - 2 * margin, 10, "F");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(categoryLabels[category] || category, margin + 5, currentY + 7);

    currentY += 15;

    // Items table
    const tableData = items.map((item) => {
      const statusSymbol = item.result === "CONFORME" ? "✓" :
                          item.result === "NON_CONFORME" ? "✗" :
                          item.result === "NA" ? "-" : "?";

      let details = "";
      if (item.result === "CONFORME" && item.conformeText) {
        details = item.conformeText;
      } else if (item.result === "NON_CONFORME") {
        if (item.nonConformeText) details = item.nonConformeText;
        if (item.regulatoryReference) {
          details += (details ? "\n" : "") + `Réf: ${item.regulatoryReference}`;
        }
        if (item.notes) {
          details += (details ? "\n" : "") + `Note: ${item.notes}`;
        }
      }

      return [statusSymbol, item.label, details || "-"];
    });

    doc.autoTable({
      startY: currentY,
      head: [["", "Point de contrôle", "Détails"]],
      body: tableData,
      theme: "striped",
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [229, 231, 235],
        textColor: [0, 0, 0],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 60 },
        2: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data: { section: string; column: { index: number }; cell: { text: string[]; styles: { textColor: number[] } } }) => {
        if (data.section === "body" && data.column.index === 0) {
          const symbol = data.cell.text[0];
          if (symbol === "✓") {
            data.cell.styles.textColor = successColor;
          } else if (symbol === "✗") {
            data.cell.styles.textColor = dangerColor;
          }
        }
      },
    });

    currentY = doc.lastAutoTable.finalY + 10;
  }

  // ============================================
  // Recommendations Page
  // ============================================
  if (audit.recommendations && audit.recommendations.length > 0) {
    doc.addPage();
    currentY = margin;

    doc.setFillColor(...warningColor);
    doc.rect(0, 0, pageWidth, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("PRÉCONISATIONS", margin, 13);

    currentY = 35;

    // Total cost
    const totalCostMin = audit.recommendations.reduce((sum, r) => sum + (r.estimatedCostMin || 0), 0);
    const totalCostMax = audit.recommendations.reduce((sum, r) => sum + (r.estimatedCostMax || 0), 0);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre de préconisations : ${audit.recommendations.length}`, margin, currentY);
    doc.text(`Estimation totale : ${formatCost(totalCostMin, totalCostMax)}`, pageWidth - margin, currentY, { align: "right" });

    currentY += 15;

    // Recommendations table
    const recData = audit.recommendations.map((rec, index) => [
      (index + 1).toString(),
      rec.title,
      rec.description + (rec.auditorNotes ? `\nNote: ${rec.auditorNotes}` : ""),
      PRIORITY_LABELS[rec.priority] || "Moyen terme",
      formatCost(rec.estimatedCostMin, rec.estimatedCostMax),
    ]);

    doc.autoTable({
      startY: currentY,
      head: [["#", "Action", "Description", "Priorité", "Estimation"]],
      body: recData,
      theme: "striped",
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: warningColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 40, fontStyle: "bold" },
        2: { cellWidth: "auto" },
        3: { cellWidth: 25, halign: "center" },
        4: { cellWidth: 30, halign: "right" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data: { section: string; column: { index: number }; row: { index: number }; cell: { styles: { fillColor: number[] } } }) => {
        if (data.section === "body" && data.column.index === 3) {
          const priority = audit.recommendations?.[data.row.index]?.priority;
          if (priority === 1) {
            data.cell.styles.fillColor = [254, 226, 226]; // Red light
          } else if (priority === 2) {
            data.cell.styles.fillColor = [255, 237, 213]; // Orange light
          }
        }
      },
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // Summary by priority
    addNewPageIfNeeded(50);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Récapitulatif par priorité", margin, currentY);
    currentY += 10;

    const byPriority: Record<number, { count: number; costMin: number; costMax: number }> = {};
    for (const rec of audit.recommendations) {
      if (!byPriority[rec.priority]) {
        byPriority[rec.priority] = { count: 0, costMin: 0, costMax: 0 };
      }
      byPriority[rec.priority].count++;
      byPriority[rec.priority].costMin += rec.estimatedCostMin || 0;
      byPriority[rec.priority].costMax += rec.estimatedCostMax || 0;
    }

    const priorityData = Object.entries(byPriority)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([priority, data]) => [
        PRIORITY_LABELS[parseInt(priority)] || `Priorité ${priority}`,
        data.count.toString(),
        formatCost(data.costMin, data.costMax),
      ]);

    priorityData.push([
      "TOTAL",
      audit.recommendations.length.toString(),
      formatCost(totalCostMin, totalCostMax),
    ]);

    doc.autoTable({
      startY: currentY,
      head: [["Priorité", "Nombre", "Estimation"]],
      body: priorityData,
      theme: "striped",
      styles: {
        fontSize: 10,
        cellPadding: 5,
      },
      headStyles: {
        fillColor: [229, 231, 235],
        textColor: [0, 0, 0],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: "center" },
        2: { cellWidth: 50, halign: "right" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data: { section: string; row: { index: number }; cell: { styles: { fontStyle: string } } }) => {
        if (data.section === "body" && data.row.index === priorityData.length - 1) {
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  // ============================================
  // General Notes (if any)
  // ============================================
  if (audit.generalNotes) {
    addNewPageIfNeeded(60);

    currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : currentY + 20;

    doc.setFillColor(243, 244, 246);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 8, 2, 2, "F");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVATIONS GÉNÉRALES", margin + 5, currentY + 6);

    currentY += 15;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const splitNotes = doc.splitTextToSize(audit.generalNotes, pageWidth - 2 * margin - 10);
    doc.text(splitNotes, margin + 5, currentY);
  }

  // ============================================
  // Footer on all pages
  // ============================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text(
      `Rapport d'audit technique - ${site.name} - ${formatDate(audit.auditDate)}`,
      margin,
      pageHeight - 10
    );
    doc.text(`Page ${i}/${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }

  // Save PDF
  const fileName = `audit-technique-${site.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${audit.auditDate}.pdf`;
  doc.save(fileName);
}
