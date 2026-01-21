import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/meetings - List all meetings
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const meetings = await prisma.meeting.findMany({
      where: { organizationId: effectiveOrgId },
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(meetings);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des réunions" },
      { status: 500 }
    );
  }
}

// POST /api/meetings - Create a new meeting
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer une réunion" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const meeting = await prisma.meeting.create({
      data: {
        title: body.title,
        type: body.type,
        date: new Date(body.date),
        location: body.location,
        attendees: body.attendees || [],
        agenda: body.agenda,
        notes: body.notes,
        siteId: body.siteId,
        organizationId: effectiveOrgId,
      },
    });

    return NextResponse.json(meeting, { status: 201 });
  } catch (error) {
    console.error("Error creating meeting:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la réunion" },
      { status: 500 }
    );
  }
}
