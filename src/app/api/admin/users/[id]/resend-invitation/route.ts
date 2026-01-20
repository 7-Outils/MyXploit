import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST /api/admin/users/[id]/resend-invitation - Renvoyer l'invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAuth();
    const { id } = await params;

    if (currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux super administrateurs" },
        { status: 403 }
      );
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    if (user.clerkId) {
      return NextResponse.json(
        { error: "Cet utilisateur est déjà activé" },
        { status: 400 }
      );
    }

    // Envoyer une nouvelle invitation Clerk
    const clerk = await clerkClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://myxploit.fr";
    await clerk.invitations.createInvitation({
      emailAddress: user.email,
      redirectUrl: `${appUrl}/overview`,
      publicMetadata: {
        dbUserId: user.id,
        role: user.role,
      },
    });

    return NextResponse.json({ success: true, message: "Invitation envoyée" });
  } catch (error) {
    console.error("Error resending invitation:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de l'invitation" },
      { status: 500 }
    );
  }
}
