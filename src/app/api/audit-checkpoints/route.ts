import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  CATEGORIES,
  getAllCheckpointsSorted,
  filterCheckpointsByConditions,
  type CheckpointDefinition,
} from "@/lib/audit/checklist-data";

// Convert CheckpointDefinition to the format expected by the frontend
function convertToApiFormat(checkpoint: CheckpointDefinition) {
  return {
    id: checkpoint.id,
    label: checkpoint.label,
    category: checkpoint.category,
    description: checkpoint.description || null,
    responseType: checkpoint.responseType,
    findings: checkpoint.findings.map((f) => ({
      id: f.id,
      label: f.label,
      isConform: f.isConform,
      recommendationId: f.recommendationId || null,
      reportText: f.reportText || null,
    })),
    valueFields: checkpoint.valueFields || null,
    regulatoryRef: checkpoint.regulatoryRef || null,
    periodicity: checkpoint.periodicity || null,
    sortOrder: checkpoint.sortOrder,
    isActive: true,
    applicableConditions: checkpoint.applicableConditions || null,
  };
}

// GET /api/audit-checkpoints - Get all active checkpoints for audit
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const conditionsParam = searchParams.get("conditions");
    const activeConditions = conditionsParam ? conditionsParam.split(",") : [];

    // Get all checkpoints from hardcoded data
    let checkpoints = getAllCheckpointsSorted();

    // Filter by conditions if provided
    if (activeConditions.length > 0) {
      checkpoints = filterCheckpointsByConditions(checkpoints, activeConditions);
    }

    // Convert to API format
    const formattedCheckpoints = checkpoints.map(convertToApiFormat);

    // Also fetch recommendations from database for linking (if they exist)
    let recommendations: {
      id: string;
      title: string;
      description: string | null;
      price: number | null;
      priceUnit: string;
      priority: number;
      category: string | null;
    }[] = [];

    try {
      recommendations = await prisma.recommendationLibrary.findMany({
        where: {
          organizationId: user.organizationId,
          isActive: true,
        },
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          priceUnit: true,
          priority: true,
          category: true,
        },
      });
    } catch {
      // If recommendations table doesn't exist or is empty, continue without them
      console.log("No recommendations found or table not available");
    }

    // Include categories for frontend grouping
    const categories = CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description || null,
      sortOrder: c.sortOrder,
    }));

    return NextResponse.json({
      checkpoints: formattedCheckpoints,
      categories,
      recommendations,
    });
  } catch (error) {
    console.error("Error fetching audit checkpoints:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des points de contrôle" },
      { status: 500 }
    );
  }
}
