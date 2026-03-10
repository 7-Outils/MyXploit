import { NextResponse } from "next/server";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { getGRDFProviderAndToken } from "@/lib/grdf-helpers";
import { GRDFEnvironment } from "@/lib/grdf";

const GRDF_API_HOST = "https://api.grdf.fr";
const ENV_BASE_PATH: Record<GRDFEnvironment, string> = {
  sandbox: "/adict/bas/v6",
  production: "/adict/v6",
};

// GET /api/energy/grdf/debug — Raw GRDF droits_acces response (temporary)
export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const grdf = await getGRDFProviderAndToken(effectiveOrgId);
    if (!grdf) {
      return NextResponse.json({ error: "GRDF non connecté" }, { status: 400 });
    }

    const basePath = ENV_BASE_PATH[grdf.environment];
    const url = `${GRDF_API_HOST}${basePath}/droits_acces`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${grdf.accessToken}`,
        Accept: "application/x-ndjson",
      },
    });

    const rawText = await response.text();

    // Parse NDJSON and return raw objects with their keys
    const lines = rawText.split("\n").filter((l) => l.trim().length > 0);
    const parsed = lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { _raw_line: line };
      }
    });

    return NextResponse.json({
      environment: grdf.environment,
      status: response.status,
      totalLines: lines.length,
      sampleKeys: parsed.length > 0 ? Object.keys(parsed[0]) : [],
      firstDroit: parsed[0] || null,
      allDroits: parsed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
