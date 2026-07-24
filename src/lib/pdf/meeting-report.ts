import jsPDF from "jspdf";

/**
 * Compte rendu de réunion — PDF éditorial (typographie + filets, pas de boîtes).
 * Généré côté client à partir du payload de /api/meetings/[id]/generate-report.
 */

export interface MeetingReportData {
  title: string;
  type: string;
  date: string;
  location: string | null;
  contract: string | null;
  site: string | null;
  attendees: string[];
  notes: string | null;
  agendaItems: Array<{
    title: string;
    notes: string | null;
    decision: string | null;
    ticket: {
      reference: string;
      status: string;
      responsible: string | null;
      site: string | null;
    } | null;
  }>;
}

const INK = "#0F1E33";
const GRAY = "#6b7280";
const ACCENT = "#2563EB";
const MARGIN = 20;
const WIDTH = 210 - MARGIN * 2;

export function generateMeetingReportPdf(data: MeetingReportData): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const checkPage = (needed: number) => {
    if (y + needed > 277) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const hairline = (yy: number, color = "#d1d5db") => {
    doc.setDrawColor(color);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, yy, MARGIN + WIDTH, yy);
  };

  const label = (text: string, x: number, yy: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(GRAY);
    doc.text(text.toUpperCase(), x, yy, { charSpace: 0.4 });
  };

  // ── En-tête ────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(GRAY);
  doc.text("COMPTE RENDU", MARGIN, y, { charSpace: 0.6 });
  doc.text(data.type.toUpperCase(), MARGIN + WIDTH, y, {
    align: "right",
    charSpace: 0.6,
  });
  y += 3;
  doc.setDrawColor(INK);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + WIDTH, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(INK);
  const titleLines = doc.splitTextToSize(data.title, WIDTH);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 8 + 6;

  // ── Cartouche méta (colonnes, filets fins) ─────────────────
  const dateStr = new Date(data.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const meta: Array<[string, string]> = [["Date", dateStr]];
  if (data.location) meta.push(["Lieu", data.location]);
  if (data.contract) meta.push(["Contrat", data.contract]);
  if (data.site) meta.push(["Site", data.site]);
  if (data.attendees.length > 0)
    meta.push(["Participants", data.attendees.join(", ")]);

  hairline(y);
  y += 5;
  for (const [k, v] of meta) {
    label(k, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(INK);
    const lines = doc.splitTextToSize(v, WIDTH - 35);
    doc.text(lines, MARGIN + 35, y);
    y += lines.length * 4.5 + 2.5;
  }
  y += 1;
  hairline(y);
  y += 12;

  // ── Ordre du jour ──────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text("Ordre du jour", MARGIN, y);
  y += 8;

  if (data.agendaItems.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(GRAY);
    doc.text("Aucun point à l'ordre du jour.", MARGIN, y);
    y += 8;
  }

  data.agendaItems.forEach((item, index) => {
    checkPage(30);

    // Numéro + titre
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(ACCENT);
    doc.text(String(index + 1).padStart(2, "0"), MARGIN, y);
    doc.setTextColor(INK);
    const itemTitle = doc.splitTextToSize(item.title, WIDTH - 12);
    doc.text(itemTitle, MARGIN + 12, y);
    y += itemTitle.length * 5 + 2;

    // Référence ticket
    if (item.ticket) {
      checkPage(8);
      const parts = [
        `Ticket ${item.ticket.reference}`,
        item.ticket.site,
        item.ticket.responsible,
        item.ticket.status,
      ].filter(Boolean);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(GRAY);
      doc.text(parts.join("  ·  "), MARGIN + 12, y);
      y += 5;
    }

    // Notes
    if (item.notes) {
      const lines = doc.splitTextToSize(item.notes, WIDTH - 12);
      checkPage(lines.length * 4.2 + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(INK);
      doc.text(lines, MARGIN + 12, y);
      y += lines.length * 4.2 + 2;
    }

    // Décision (mise en avant, filet accent à gauche)
    if (item.decision) {
      const lines = doc.splitTextToSize(item.decision, WIDTH - 18);
      checkPage(lines.length * 4.2 + 8);
      doc.setDrawColor(ACCENT);
      doc.setLineWidth(0.6);
      doc.line(MARGIN + 12, y - 3, MARGIN + 12, y + lines.length * 4.2);
      label("Décision", MARGIN + 16, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(INK);
      doc.text(lines, MARGIN + 16, y);
      y += lines.length * 4.2 + 3;
    }

    y += 3;
    hairline(y - 2, "#e5e7eb");
    y += 5;
  });

  // ── Notes complémentaires ──────────────────────────────────
  if (data.notes) {
    checkPage(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(INK);
    doc.text("Notes complémentaires", MARGIN, y);
    y += 7;
    const lines = doc.splitTextToSize(data.notes, WIDTH);
    checkPage(lines.length * 4.2 + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(lines, MARGIN, y);
    y += lines.length * 4.2;
  }

  // ── Pied de page sur chaque page ───────────────────────────
  const pageCount = doc.getNumberOfPages();
  const generatedStr = `Compte rendu généré le ${new Date().toLocaleDateString("fr-FR")} — MyXploit`;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    hairline(285);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(GRAY);
    doc.text(generatedStr, MARGIN, 290);
    doc.text(`${i} / ${pageCount}`, MARGIN + WIDTH, 290, { align: "right" });
  }

  const datePart = new Date(data.date).toISOString().split("T")[0];
  const safeTitle = data.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .slice(0, 40);
  doc.save(`CR_${datePart}_${safeTitle}.pdf`);
}
