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

    // Try both endpoints
    const results: Record<string, unknown> = {};

    for (const endpoint of ["donnees_consos_publiees", "donnees_consos_informatives"]) {
      const url = `${GRDF_API_HOST}${basePath}/pce/${pce}/${endpoint}?periode=${year}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${grdf.accessToken}`,
          Accept: "application/x-ndjson",
        },
      });

      const rawText = await response.text();
      results[endpoint] = {
        url,
        status: response.status,
        contentType: response.headers.get("content-type"),
        rawText: rawText.substring(0, 2000),
        lines: rawText.split("\n").filter((l) => l.trim()).length,
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
