import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EQUIPMENT_TYPE_LABELS } from "@/lib/pricing/equipment-pricing";

interface DimensioningResult {
  params: {
    contractId: string | null;
    siteIds: string[] | null;
    duration: number;
    startYear: number;
  };
  summary: {
    equipmentCount: number;
    siteCount: number;
    totalP2Annual: number;
    totalP3GEAnnual: number;
    totalP3RAnnual: number;
    totalP3Annual: number;
    totalAnnual: number;
    totalHoursP2: number;
    totalP2Contract: number;
    totalP3GEContract: number;
    totalP3RContract: number;
    totalP3Contract: number;
    totalContract: number;
    renewalsCount: number;
    mandatoryWorksCount: number;
    totalRenewalCost: number;
    totalMandatoryWorksCost: number;
  };
  bySite: Array<{
    siteId: string;
    siteName: string;
    equipmentCount: number;
    p2Annual: number;
    p3GEAnnual: number;
    p3RAnnual: number;
    hoursP2: number;
    renewalsCount: number;
  }>;
  renewals: Array<{
    equipmentId: string;
    equipmentType: string;
    siteName: string;
    siteId: string;
    replacementCost: number;
    remainingLifeYears: number;
    renewalNeeded: boolean;
    urgency: string;
    renewalYear?: number;
    annualProvision: number;
    notes: string[];
  }>;
  mandatoryWorks: Array<{
    equipmentId: string;
    equipmentType: string;
    siteName: string;
    siteId: string;
    replacementCost: number;
    remainingLifeYears: number;
    urgency: string;
    renewalYear?: number;
    notes: string[];
  }>;
}

const URGENCY_LABELS: Record<string, string> = {
  CRITICAL: "Critique",
  HIGH: "Haute",
  MEDIUM: "Moyenne",
  LOW: "Basse",
  NONE: "Aucune",
};

export function generateDimensioningPDF(
  result: DimensioningResult,
  contractTitle?: string,
  organizationName?: string
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Colors
  const primaryColor: [number, number, number] = [30, 41, 59]; // slate-800
  const accentColor: [number, number, number] = [234, 88, 12]; // orange-600
  const grayColor: [number, number, number] = [100, 116, 139]; // slate-500

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("DIMENSIONNEMENT MARCHÉ CVC", pageWidth / 2, 18, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  if (contractTitle) {
    doc.text(contractTitle, pageWidth / 2, 28, { align: "center" });
  }
  doc.text(`Durée: ${result.params.duration} ans (${result.params.startYear} - ${result.params.startYear + result.params.duration})`, pageWidth / 2, 36, { align: "center" });

  y = 50;

  // Organization and date
  doc.setTextColor(...grayColor);
  doc.setFontSize(10);
  if (organizationName) {
    doc.text(organizationName, 14, y);
  }
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, pageWidth - 14, y, { align: "right" });
  y += 10;

  // Summary cards
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(14, y, pageWidth - 28, 35, 3, 3, "F");

  y += 8;
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RÉSUMÉ", 20, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Summary grid
  const summaryData = [
    ["Sites", result.summary.siteCount.toString()],
    ["Équipements", result.summary.equipmentCount.toString()],
    ["Heures P2/an", `${result.summary.totalHoursP2}h`],
    ["Renouvellements", result.summary.renewalsCount.toString()],
  ];

  let xPos = 25;
  summaryData.forEach(([label, value]) => {
    doc.setTextColor(...grayColor);
    doc.text(label, xPos, y);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text(value, xPos, y + 5);
    doc.setFont("helvetica", "normal");
    xPos += 40;
  });

  y += 25;

  // Budget annuel
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("BUDGET ANNUEL", 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [["Poste", "Montant", "Détail"]],
    body: [
      ["P2 - Petit entretien", `${result.summary.totalP2Annual.toLocaleString("fr-FR")} €`, `${result.summary.totalHoursP2} heures/an`],
      ["P3 GE - Gros entretien", `${result.summary.totalP3GEAnnual.toLocaleString("fr-FR")} €`, "Maintenance lourde annuelle"],
      ["P3 R - Renouvellement", `${result.summary.totalP3RAnnual.toLocaleString("fr-FR")} €`, `Provision pour ${result.summary.renewalsCount} renouvellements`],
    ],
    foot: [["TOTAL ANNUEL", `${result.summary.totalAnnual.toLocaleString("fr-FR")} €`, ""]],
    theme: "striped",
    headStyles: { fillColor: primaryColor, fontSize: 9 },
    footStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Budget sur durée du marché
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`BUDGET SUR ${result.params.duration} ANS`, 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [["Poste", "Montant"]],
    body: [
      ["P2 Total", `${result.summary.totalP2Contract.toLocaleString("fr-FR")} €`],
      ["P3 GE Total", `${result.summary.totalP3GEContract.toLocaleString("fr-FR")} €`],
      ["P3 R Total", `${result.summary.totalP3RContract.toLocaleString("fr-FR")} €`],
    ],
    foot: [["TOTAL MARCHÉ", `${result.summary.totalContract.toLocaleString("fr-FR")} €`]],
    theme: "striped",
    headStyles: { fillColor: primaryColor, fontSize: 9 },
    footStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 11 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

  // Check if we need a new page
  if (y > 250 && (result.mandatoryWorks.length > 0 || result.bySite.length > 0)) {
    doc.addPage();
    y = 20;
  }

  // Mandatory works
  if (result.mandatoryWorks.length > 0) {
    doc.setFillColor(254, 226, 226); // red-100
    doc.roundedRect(14, y, pageWidth - 28, 10, 2, 2, "F");

    doc.setTextColor(185, 28, 28); // red-700
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`TRAVAUX OBLIGATOIRES (${result.mandatoryWorks.length})`, 20, y + 7);

    y += 15;

    autoTable(doc, {
      startY: y,
      head: [["Équipement", "Site", "Urgence", "Coût"]],
      body: result.mandatoryWorks.map((w) => [
        EQUIPMENT_TYPE_LABELS[w.equipmentType] || w.equipmentType,
        w.siteName,
        URGENCY_LABELS[w.urgency] || w.urgency,
        `${w.replacementCost.toLocaleString("fr-FR")} €`,
      ]),
      foot: [["", "", "Total", `${result.summary.totalMandatoryWorksCost.toLocaleString("fr-FR")} €`]],
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38], fontSize: 9 },
      footStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }

  // Check if we need a new page
  if (y > 200 && result.bySite.length > 0) {
    doc.addPage();
    y = 20;
  }

  // Detail by site
  if (result.bySite.length > 0) {
    doc.setTextColor(...primaryColor);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DÉTAIL PAR SITE", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Site", "Équip.", "P2/an", "Heures", "P3 GE/an", "P3 R/an", "Total/an"]],
      body: result.bySite.map((s) => [
        s.siteName,
        s.equipmentCount.toString(),
        `${Math.round(s.p2Annual).toLocaleString("fr-FR")} €`,
        `${s.hoursP2.toFixed(1)}h`,
        `${Math.round(s.p3GEAnnual).toLocaleString("fr-FR")} €`,
        `${Math.round(s.p3RAnnual).toLocaleString("fr-FR")} €`,
        `${Math.round(s.p2Annual + s.p3GEAnnual + s.p3RAnnual).toLocaleString("fr-FR")} €`,
      ]),
      theme: "striped",
      headStyles: { fillColor: primaryColor, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: "center", cellWidth: 15 },
        2: { halign: "right" },
        3: { halign: "right", cellWidth: 18 },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right", fontStyle: "bold" },
      },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }

  // Check if we need a new page for renewals
  if (y > 180 && result.renewals.length > 0) {
    doc.addPage();
    y = 20;
  }

  // Renewal plan
  if (result.renewals.length > 0) {
    doc.setTextColor(...primaryColor);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("PLAN DE RENOUVELLEMENT", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Équipement", "Site", "Année", "Urgence", "Coût", "Provision/an"]],
      body: result.renewals.map((r) => [
        EQUIPMENT_TYPE_LABELS[r.equipmentType] || r.equipmentType,
        r.siteName,
        r.renewalYear?.toString() || "-",
        URGENCY_LABELS[r.urgency] || r.urgency,
        `${r.replacementCost.toLocaleString("fr-FR")} €`,
        `${r.annualProvision.toLocaleString("fr-FR")} €`,
      ]),
      foot: [["", "", "", "Total", `${result.summary.totalRenewalCost.toLocaleString("fr-FR")} €`, `${result.summary.totalP3RAnnual.toLocaleString("fr-FR")} €`]],
      theme: "striped",
      headStyles: { fillColor: [126, 34, 206], fontSize: 8 }, // purple
      footStyles: { fillColor: [126, 34, 206], textColor: [255, 255, 255], fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 40 },
        2: { halign: "center", cellWidth: 18 },
        3: { halign: "center" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
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
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
    doc.text(
      "Généré par MyExploit",
      14,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  // Save
  const fileName = contractTitle
    ? `dimensionnement-${contractTitle.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`
    : `dimensionnement-marche-${new Date().toISOString().split("T")[0]}.pdf`;

  doc.save(fileName);
}
