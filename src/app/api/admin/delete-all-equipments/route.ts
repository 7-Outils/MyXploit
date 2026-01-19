import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// DELETE /api/admin/delete-all-equipments - Delete all equipment for the organization
export async function DELETE() {
  try {
    const user = await requireAuth();

    // Only allow admin users
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès refusé. Réservé aux administrateurs." },
        { status: 403 }
      );
    }

    // Delete all equipment for this organization
    const result = await prisma.equipment.deleteMany({
      where: {
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `${result.count} équipement(s) supprimé(s)`,
    });
  } catch (error) {
    console.error("Error deleting all equipment:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression des équipements" },
      { status: 500 }
    );
  }
}
