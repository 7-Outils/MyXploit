import { NextRequest, NextResponse } from "next/server";
import { getContractRecipients } from "@/lib/contract-recipients";
import { computeHeatingSignal, dateToSeason, type HeatingWeather } from "@/lib/heating-season";
import { contractCoordinates, fetchDailyTemps } from "@/lib/heating-weather";
import { authorizeContract, findOpenRequest, loadContractSitesHeating, todayParisIso } from "@/lib/heating-status";

// GET /api/contracts/[id]/heating-status
// État de chauffe des sites du contrat + signal météo allumage/arrêt +
// demande en cours (allumage/arrêt envoyée à l'exploitant).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contractId } = await params;
    const auth = await authorizeContract(contractId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const todayIso = todayParisIso();
    const [sites, openRequest, recipients] = await Promise.all([
      loadContractSitesHeating(contractId, todayIso),
      findOpenRequest(contractId),
      getContractRecipients(contractId),
    ]);

    // Météo : jamais bloquante, null si pas de coordonnées ou API en échec.
    let weather: HeatingWeather | null = null;
    const coords = contractCoordinates(sites);
    if (coords) {
      try {
        const daily = await fetchDailyTemps(coords.lat, coords.lon);
        weather = computeHeatingSignal(daily, todayIso);
      } catch (e) {
        console.warn("[heating-status] météo indisponible:", e instanceof Error ? e.message : e);
      }
    }

    const counts = {
      total: sites.length,
      enChauffe: sites.filter((s) => s.status === "EN_CHAUFFE").length,
      arrete: sites.filter((s) => s.status === "ARRETE").length,
      allumagePrevu: sites.filter((s) => s.status === "ALLUMAGE_PREVU").length,
      arretPrevu: sites.filter((s) => s.status === "ARRET_PREVU").length,
    };

    let pendingRequest = null;
    if (openRequest) {
      const linked = sites.filter((s) =>
        openRequest.type === "ALLUMAGE"
          ? s.period?.startRequestId === openRequest.id
          : s.period?.endRequestId === openRequest.id
      );
      const remaining = linked.filter((s) =>
        openRequest.type === "ALLUMAGE" ? s.period?.startProvisional : s.period?.endProvisional
      );
      pendingRequest = {
        id: openRequest.id,
        type: openRequest.type,
        requestedDate: openRequest.requestedDate.toISOString().slice(0, 10),
        sentAt: openRequest.sentAt.toISOString(),
        sentTo: openRequest.sentTo,
        total: linked.length,
        confirmed: linked.length - remaining.length,
        pendingSiteIds: remaining.map((s) => s.id),
      };
    }

    return NextResponse.json({
      season: dateToSeason(new Date(todayIso + "T12:00:00")),
      today: todayIso,
      weather,
      sites: sites.map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        status: s.status,
        period: s.period
          ? {
              id: s.period.id,
              startDate: s.period.startDate.toISOString().slice(0, 10),
              endDate: s.period.endDate ? s.period.endDate.toISOString().slice(0, 10) : null,
              startProvisional: s.period.startProvisional,
              endProvisional: s.period.endProvisional,
            }
          : null,
      })),
      counts,
      pendingRequest,
      recipients,
    });
  } catch (error) {
    console.error("Error fetching heating status:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
