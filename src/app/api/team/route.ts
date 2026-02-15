import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId, generateInvitationData } from "@/lib/auth";
import { sendInvitationEmail } from "@/lib/email";

// GET /api/team - Liste des membres de l'organisation
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const members = await prisma.user.findMany({
      where: {
        organizationId: effectiveOrgId,
        role: { not: "SUPER_ADMIN" },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        password: true, // Pour determiner le statut (null = en attente)
        createdAt: true,
        _count: {
          select: {
            contractAssignments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Masquer le champ password, retourner un statut
    const result = members.map((m) => ({
      id: m.id,
      email: m.email,
      firstName: m.firstName,
      lastName: m.lastName,
      role: m.role,
      isActive: !!m.password,
      contractsCount: m._count.contractAssignments,
      createdAt: m.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation de l'equipe" },
      { status: 500 }
    );
  }
}

// POST /api/team - Inviter un membre dans l'organisation
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le dirigeant peut inviter des membres" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, firstName, lastName, role } = body;

    if (!email) {
      return NextResponse.json(
        { error: "L'email est requis" },
        { status: 400 }
      );
    }

    // Verifier les roles autorisés (pas ADMIN ni SUPER_ADMIN)
    const allowedRoles = ["EDITOR", "READER"];
    const userRole = role && allowedRoles.includes(role) ? role : "READER";

    // Verifier que l'email n'existe pas deja
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Cet email est deja utilise" },
        { status: 400 }
      );
    }

    // Generer le token d'invitation
    const { token, expires } = generateInvitationData();

    // Creer l'utilisateur
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        firstName: firstName || null,
        lastName: lastName || null,
        role: userRole,
        organizationId: effectiveOrgId,
        invitationToken: token,
        invitationExpires: expires,
      },
    });

    // Envoyer l'email d'invitation
    let emailSent = true;
    try {
      await sendInvitationEmail(newUser.email, newUser.firstName || "", token);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      emailSent = false;
    }

    return NextResponse.json(
      {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        isActive: false,
        emailSent,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error inviting team member:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'invitation" },
      { status: 500 }
    );
  }
}
