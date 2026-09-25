/**
 * Chargement côté serveur de l'état de chauffe des sites d'un contrat
 * (dernière période par site + statut dérivé). Partagé par les routes
 * heating-status et heating-requests.
 */
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { getUserAssignedContractIds } from "@/lib/portfolio";
import { siteHeatingStatus, type SiteHeatingStatus } from "@/lib/heating-season";

export function todayParisIso(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

export interface SitePeriodInfo {
  id: string;
  startDate: Date;
  endDate: Date | null;
  startProvisional: boolean;
  endProvisional: boolean;
  startRequestId: string | null;
  endRequestId: string | null;
}

export interface SiteHeatingInfo {
  id: string;
  name: string;
  city: string;
  address: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  stationMeteo: string | null;
  status: SiteHeatingStatus;
  period: SitePeriodInfo | null;
}

export async function loadContractSitesHeating(contractId: string, todayIso: string): Promise<SiteHeatingInfo[]> {
  const contractSites = await prisma.contractSite.findMany({
    where: { contractId },
    select: {
      site: {
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
          postalCode: true,
          latitude: true,
          longitude: true,
          stationMeteo: true,
          heatingPeriods: {
            orderBy: { startDate: "desc" },
            take: 1,
            select: {
              id: true,
              startDate: true,
              endDate: true,
              startProvisional: true,
              endProvisional: true,
              startRequestId: true,
              endRequestId: true,
            },
          },
        },
      },
    },
  });

  return contractSites
    .map(({ site }) => {
      const period = site.heatingPeriods[0] ?? null;
      return {
        id: site.id,
        name: site.name,
        city: site.city,
        address: site.address,
        postalCode: site.postalCode,
        latitude: site.latitude,
        longitude: site.longitude,
        stationMeteo: site.stationMeteo,
        status: siteHeatingStatus(period, todayIso),
        period,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function findOpenRequest(contractId: string) {
  return prisma.heatingSwitchRequest.findFirst({
    where: { contractId, closedAt: null, cancelledAt: null },
    orderBy: { sentAt: "desc" },
  });
}

/**
 * Auth + contrôle d'accès au contrat (org effective + portefeuille).
 * Renvoie soit le contexte, soit le code d'erreur HTTP à retourner.
 */
export async function authorizeContract(contractId: string): Promise<
  | { ok: true; user: Awaited<ReturnType<typeof requireAuth>>; effectiveOrgId: string; contract: { id: string; title: string; reference: string; provider: string; client: { name: string } | null } }
  | { ok: false; status: number; error: string }
> {
  const user = await requireAuth();
  const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
  const assigned = await getUserAssignedContractIds(user.id, user.role, effectiveOrgId);
  if (assigned !== null && !assigned.includes(contractId)) {
    return { ok: false, status: 404, error: "Contrat non trouvé" };
  }
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, organizationId: effectiveOrgId },
    select: { id: true, title: true, reference: true, provider: true, client: { select: { name: true } } },
  });
  if (!contract) return { ok: false, status: 404, error: "Contrat non trouvé" };
  return { ok: true, user, effectiveOrgId, contract };
}
