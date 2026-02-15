import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/client";

/**
 * Retourne les IDs de contrats que l'utilisateur peut voir.
 * Retourne null si l'utilisateur voit tout (ADMIN, SUPER_ADMIN, ou pas d'assignation).
 */
export async function getUserAssignedContractIds(
  userId: string,
  userRole: UserRole,
  organizationId: string
): Promise<string[] | null> {
  // SUPER_ADMIN (SaaS master) et ADMIN (dirigeant) voient tout
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") return null;

  const assignments = await prisma.userContractAssignment.findMany({
    where: { userId, organizationId },
    select: { contractId: true },
  });

  // Pas d'assignation = voir tout (rétro-compatible)
  if (assignments.length === 0) return null;

  return assignments.map((a) => a.contractId);
}

/**
 * Retourne les IDs de sites visibles (= sites des contrats assignés).
 * Retourne null si l'utilisateur voit tout.
 */
export async function getUserVisibleSiteIds(
  userId: string,
  userRole: UserRole,
  organizationId: string
): Promise<string[] | null> {
  const contractIds = await getUserAssignedContractIds(userId, userRole, organizationId);
  if (contractIds === null) return null;

  const contractSites = await prisma.contractSite.findMany({
    where: { contractId: { in: contractIds } },
    select: { siteId: true },
    distinct: ["siteId"],
  });

  return contractSites.map((cs) => cs.siteId);
}
