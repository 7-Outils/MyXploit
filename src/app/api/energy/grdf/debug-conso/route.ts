import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { getGRDFDroitsAcces } from "@/lib/grdf";
import { getGRDFProviderAndToken } from "@/lib/grdf-helpers";

// GET /api/energy/grdf/debug-conso — Debug: test raw conso calls on BAS PCEs
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const grdf = await getGRDFProviderAndToken(effectiveOrgId);
    if (!grdf) {
      return NextResponse.json({ error: "GRDF non connecté" }, { status: 400 });
    }

    const { accessToken, environment } = grdf;

    // Get active PCEs from droits d'accès
    const droits = await getGRDFDroitsAcces(accessToken, environment);
    const activePCEs = droits
      .filter((d) => d.etat_droit_acces === "Active")
      .map((d) => d.id_pce);

    const searchParams = request.nextUrl.searchParams;
    const testPce = searchParams.get("pce") || activePCEs[0];

    if (!testPce) {
      return NextResponse.json({ error: "Aucun PCE actif trouvé", droits }, { status: 400 });
    }

    const results: Record<string, unknown> = {
      environment,
      testPce,
      activePCEs,
      totalDroits: droits.length,
    };

    // Test multiple host + basePath + param combinations
    const hostConfigs = [
      { label: "api.grdf.fr/v6", host: "https://api.grdf.fr", basePath: "/adict/bas/v6" },
      { label: "api.grdf.fr/v1", host: "https://api.grdf.fr", basePath: "/adict/bas/v1" },
      { label: "mock/v1", host: "https://mock.api-digiconnect.grdf.fr", basePath: "/adict/bas/v1" },
      { label: "mock/v6", host: "https://mock.api-digiconnect.grdf.fr", basePath: "/adict/bas/v6" },
    ];

    const paramSets = [
      { label: "periode_2024", params: "periode=2024" },
      { label: "dates_2018_2019", params: "date_debut=2018-01-01&date_fin=2019-12-31" },
      { label: "no_params", params: "" },
    ];

    for (const hc of hostConfigs) {
      const hostResults: Record<string, unknown> = {};

      for (const ps of paramSets) {
        try {
          const url = `${hc.host}${hc.basePath}/pce/${testPce}/donnees_consos_publiees${ps.params ? `?${ps.params}` : ""}`;
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/x-ndjson",
            },
          });

          const rawText = await response.text();
          hostResults[ps.label] = {
            url,
            status: response.status,
            contentType: response.headers.get("content-type"),
            rawLength: rawText.length,
            raw: rawText.substring(0, 1500),
          };
        } catch (err) {
          hostResults[ps.label] = {
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      }

      results[hc.label] = hostResults;
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Debug conso error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur debug conso" },
      { status: 500 }
    );
  }
}
