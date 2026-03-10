import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { GRDFEnvironment } from "@/lib/grdf";
import { getGRDFProviderAndToken } from "@/lib/grdf-helpers";

const GRDF_API_HOST = "https://api.grdf.fr";

const ENV_BASE_PATH: Record<GRDFEnvironment, string> = {
  sandbox: "/adict/bas/v6",
  production: "/adict/v6",
};

// PUT /api/energy/grdf/droits-acces/[idDroitAcces]/preuves
// Transmet les preuves de consentement pour un droit d'accès
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ idDroitAcces: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour transmettre des preuves" },
        { status: 403 }
      );
    }

    const grdf = await getGRDFProviderAndToken(effectiveOrgId);
    if (!grdf) {
      return NextResponse.json(
        { error: "GRDF non connecté" },
        { status: 400 }
      );
    }

    const { idDroitAcces } = await params;

    // Parse the incoming multipart form
    const formData = await request.formData();
    const files = formData.getAll("preuves");

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Au moins une preuve est requise" },
        { status: 400 }
      );
    }

    if (files.length > 3) {
      return NextResponse.json(
        { error: "Maximum 3 preuves autorisées" },
        { status: 400 }
      );
    }

    // Validate file sizes (max 4MB each)
    for (const file of files) {
      if (file instanceof File && file.size > 4 * 1024 * 1024) {
        return NextResponse.json(
          { error: `Le fichier "${file.name}" dépasse la taille maximale de 4 Mo` },
          { status: 400 }
        );
      }
    }

    // Forward to GRDF API
    const grdfFormData = new FormData();
    for (const file of files) {
      grdfFormData.append("preuves", file);
    }

    const basePath = ENV_BASE_PATH[grdf.environment];
    const url = `${GRDF_API_HOST}${basePath}/droit_acces/${idDroitAcces}/preuves`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${grdf.accessToken}`,
      },
      body: grdfFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Erreur GRDF (${response.status})`;
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed.message || parsed.error || errorMessage;
      } catch {
        // Keep default
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error uploading GRDF preuves:", error);
    return NextResponse.json(
      { error: "Erreur lors de la transmission des preuves" },
      { status: 500 }
    );
  }
}
