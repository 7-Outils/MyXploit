import { NextResponse } from "next/server";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { getGRDFProviderAndToken } from "@/lib/grdf-helpers";
import { GRDFEnvironment } from "@/lib/grdf";

const GRDF_API_HOST = "https://api.grdf.fr";
const ENV_BASE_PATH: Record<GRDFEnvironment, string> = {
  sandbox: "/adict/bas/v6",
  production: "/adict/v6",
};

// GET /api/energy/grdf/debug?pce=09999999900617&year=2022
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user.role === "READER") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const grdf = await getGRDFProviderAndToken(effectiveOrgId);
    if (!grdf) {
      return NextResponse.json({ error: "GRDF non connecté" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const pce = searchParams.get("pce") || "09999999900617";
    const year = searchParams.get("year") || "2022";

    const basePath = ENV_BASE_PATH[grdf.environment];

    // Try multiple parameter variants to find what works
    const variants = [
      { label: "no_params", qs: "" },
      { label: "periode_no_accent", qs: `periode=${year}` },
      { label: "periode_accent", qs: `période=${year}` },
      { label: "date_debut_fin", qs: `date_debut=${year}-01-01&date_fin=${year}-12-31` },
      { label: "date_debut_only", qs: `date_debut=${year}-01-01` },
    ];

    const results: Record<string, unknown> = {};
    const endpoint = "donnees_consos_publiees";

    for (const v of variants) {
      const url = `${GRDF_API_HOST}${basePath}/pce/${pce}/${endpoint}${v.qs ? `?${v.qs}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${grdf.accessToken}`,
          Accept: "application/x-ndjson",
        },
      });

      const rawText = await response.text();
      results[v.label] = {
        url,
        status: response.status,
        rawText: rawText.substring(0, 500),
      };
    }

    return NextResponse.json({
      environment: grdf.environment,
      pce,
      year,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
