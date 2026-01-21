import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST /api/ghost-mode/exit - Quitter le mode fantôme
export async function POST() {
  try {
    const user = await requireAuth();

    // Supprimer toutes les sessions fantômes de l'utilisateur
    await prisma.ghostSession.deleteMany({
      where: { superAdminId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error exiting ghost mode:", error);
    return NextResponse.json(
      { error: "Erreur lors de la désactivation du mode fantôme" },
      { status: 500 }
    );
  }
}
