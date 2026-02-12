import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * GET /api/meetings/[id]/generate-report
 * Génère un compte-rendu Markdown structuré
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );
    const { id: meetingId } = await params;

    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, organizationId: effectiveOrgId },
      include: {
        site: { select: { name: true } },
        contract: { select: { reference: true, title: true } },
        agendaItems: {
          include: {
            ticket: {
              select: {
                reference: true,
                status: true,
                responsible: true,
                site: { select: { name: true } },
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: "Réunion non trouvée" },
        { status: 404 }
      );
    }

    const MEETING_TYPE_LABELS: Record<string, string> = {
      EXPLOITATION: "Réunion d'exploitation",
      TRAVAUX: "Réunion travaux",
      BILAN_ANNUEL: "Bilan annuel",
      URGENCE: "Réunion d'urgence",
      AUTRE: "Réunion",
    };

    const STATUS_LABELS: Record<string, string> = {
      OPEN: "Ouvert",
      IN_PROGRESS: "En cours",
      RESOLVED: "Résolu",
      CLOSED: "Clôturé",
    };

    const dateStr = new Date(meeting.date).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    let md = `# ${MEETING_TYPE_LABELS[meeting.type] || "Réunion"} - ${meeting.title}\n\n`;
    md += `**Date** : ${dateStr}\n`;
    if (meeting.location) md += `**Lieu** : ${meeting.location}\n`;
    if (meeting.contract)
      md += `**Contrat** : ${meeting.contract.reference} - ${meeting.contract.title}\n`;
    if (meeting.site) md += `**Site** : ${meeting.site.name}\n`;
    if (meeting.attendees.length > 0)
      md += `**Participants** : ${meeting.attendees.join(", ")}\n`;

    md += `\n---\n\n## Ordre du jour\n\n`;

    if (meeting.agendaItems.length === 0) {
      md += `_Aucun point à l'ordre du jour._\n`;
    } else {
      meeting.agendaItems.forEach((item, index) => {
        md += `### ${index + 1}. ${item.title}\n\n`;

        if (item.ticket) {
          md += `> **Ticket** : ${item.ticket.reference}`;
          if (item.ticket.site) md += ` | **Site** : ${item.ticket.site.name}`;
          if (item.ticket.responsible)
            md += ` | **Responsable** : ${item.ticket.responsible}`;
          md += ` | **Statut** : ${STATUS_LABELS[item.ticket.status] || item.ticket.status}`;
          md += `\n\n`;
        }

        if (item.notes) {
          md += `${item.notes}\n\n`;
        }

        if (item.decision) {
          md += `**Décision** : ${item.decision}\n\n`;
        }

        md += `---\n\n`;
      });
    }

    // Notes libres legacy
    if (meeting.notes) {
      md += `## Notes complémentaires\n\n${meeting.notes}\n\n`;
    }

    md += `\n_Compte-rendu généré le ${new Date().toLocaleDateString("fr-FR")} via MyXploit_\n`;

    return NextResponse.json({ markdown: md });
  } catch (error) {
    console.error("GET /api/meetings/[id]/generate-report error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
