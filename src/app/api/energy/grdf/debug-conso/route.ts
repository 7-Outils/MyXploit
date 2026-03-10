import { NextResponse } from "next/server";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { getGRDFDroitsAcces } from "@/lib/grdf";
import { getGRDFProviderAndToken } from "@/lib/grdf-helpers";

const GRDF_API_HOST = "https://api.grdf.fr";

// GET /api/energy/grdf/debug-conso — Debug: test conso on all active BAS PCEs
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const grdf = await getGRDFProviderAndToken(effectiveOrgId);
    if (!grdf) {
      return NextResponse.json({ error: "GRDF non connecté" }, { status: 400 });
    }

    const { accessToken, environment } = grdf;
    const basePath = environment === "sandbox" ? "/adict/bas/v6" : "/adict/v6";

    // Get all droits d'accès with their perimeters
    const droits = await getGRDFDroitsAcces(accessToken, environment);
    const activeDroits = droits.filter((d) => d.etat_droit_acces === "Active");

    const results: Record<string, unknown> = {
      environment,
      basePath,
      totalDroits: droits.length,
      activeDroits: activeDroits.length,
    };

    // Show perimeter details for each active droit
    results.droitsDetails = activeDroits.map((d) => ({
      id_pce: d.id_pce,
      perim_donnees_publiees: d.perim_donnees_publiees,
      perim_donnees_informatives: d.perim_donnees_informatives,
      perim_donnees_conso_debut: d.perim_donnees_conso_debut,
      perim_donnees_conso_fin: d.perim_donnees_conso_fin,
      perim_donnees_contractuelles: d.perim_donnees_contractuelles,
      perim_donnees_techniques: d.perim_donnees_techniques,
    }));

    // Test each active PCE with publiees + informatives
    const pceResults: Record<string, unknown> = {};

    for (const droit of activeDroits) {
      const pce = droit.id_pce;
      const pceResult: Record<string, unknown> = {};

      // Test publiées with periode matching perim dates
      const consoDebut = droit.perim_donnees_conso_debut;
      const consoFin = droit.perim_donnees_conso_fin;
      const yearDebut = consoDebut ? consoDebut.substring(0, 4) : "2023";

      const endpoints = [
        {
          label: "publiees_periode",
          path: `/pce/${pce}/donnees_consos_publiees?periode=${yearDebut}`,
        },
        {
          label: "publiees_dates",
          path: `/pce/${pce}/donnees_consos_publiees?date_debut=${consoDebut || "2023-01-01"}&date_fin=${consoFin || "2024-12-31"}`,
        },
        {
          label: "informatives_periode",
          path: `/pce/${pce}/donnees_consos_informatives?periode=${yearDebut}`,
        },
        {
          label: "donnees_contractuelles",
          path: `/pce/${pce}/donnees_contractuelles`,
        },
        {
          label: "donnees_techniques",
          path: `/pce/${pce}/donnees_techniques`,
        },
      ];

      for (const ep of endpoints) {
        try {
          const url = `${GRDF_API_HOST}${basePath}${ep.path}`;
          const accept = ep.label.includes("consos") ? "application/x-ndjson" : "application/json";
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: accept,
            },
          });

          const rawText = await response.text();
          pceResult[ep.label] = {
            status: response.status,
            rawLength: rawText.length,
            raw: rawText.substring(0, 800),
          };
        } catch (err) {
          pceResult[ep.label] = {
            error: err instanceof Error ? err.message : "Unknown",
          };
        }
      }

      pceResults[pce] = pceResult;
    }

    results.pceResults = pceResults;

    return NextResponse.json(results);
  } catch (error) {
    console.error("Debug conso error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur debug conso" },
      { status: 500 }
    );
  }
}
