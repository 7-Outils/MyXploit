/**
 * Écriture de la répartition site par site d'une facture, et apprentissage des
 * alias de facturation.
 *
 * Les factures d'exploitant détaillent en pages 2..N un bloc par site. Chaque
 * bloc devient une ligne ; le rapprochement au site est proposé à l'import,
 * corrigé par l'utilisateur, puis mémorisé sous forme d'alias : l'import
 * suivant du même exploitant se rapproche tout seul.
 *
 * Partagé par POST /api/invoices et PUT /api/invoices/[id] pour que création
 * et modification apprennent exactement la même chose.
 */

import type { Prisma } from "@/generated/prisma/client";
import { normalizeBillingAlias } from "@/lib/invoice-import";

export interface InvoiceSiteLineInput {
  label: string;
  amountHT: number;
  siteId?: string | null;
  sortOrder: number;
}

/**
 * Remplace intégralement les lignes d'une facture et met à jour les alias.
 * À appeler dans une transaction : facture et lignes doivent apparaître
 * ensemble, une facture à moitié répartie fausserait le solde P3.
 *
 * Les siteId qui n'appartiennent pas au contrat (ou à l'organisation quand la
 * facture n'est rattachée à aucun contrat) sont ramenés à null plutôt que
 * refusés : la ligne reste lisible, simplement non rattachée.
 */
export async function replaceInvoiceSiteLines(
  tx: Prisma.TransactionClient,
  params: {
    invoiceId: string;
    contractId: string | null;
    organizationId: string;
    lines: InvoiceSiteLineInput[];
  }
): Promise<void> {
  const { invoiceId, contractId, organizationId, lines } = params;

  await tx.invoiceSiteLine.deleteMany({ where: { invoiceId } });
  if (lines.length === 0) return;

  const requestedSiteIds = [...new Set(lines.map((l) => l.siteId).filter((id): id is string => !!id))];
  let allowedSiteIds = new Set<string>();
  if (requestedSiteIds.length > 0) {
    const sites = contractId
      ? await tx.contractSite.findMany({
          where: {
            contractId,
            siteId: { in: requestedSiteIds },
            contract: { organizationId },
          },
          select: { siteId: true },
        })
      : await tx.site
          .findMany({
            where: { id: { in: requestedSiteIds }, organizationId },
            select: { id: true },
          })
          .then((rows) => rows.map((r) => ({ siteId: r.id })));
    allowedSiteIds = new Set(sites.map((s) => s.siteId));
  }

  const resolved = lines.map((line) => ({
    label: line.label,
    amountHT: line.amountHT,
    sortOrder: line.sortOrder,
    siteId: line.siteId && allowedSiteIds.has(line.siteId) ? line.siteId : null,
  }));

  await tx.invoiceSiteLine.createMany({
    data: resolved.map((line) => ({ ...line, invoiceId })),
  });

  // Apprentissage des alias : un rapprochement validé vaut pour tous les
  // imports suivants du même contrat. Sans contrat, rien à mémoriser — l'alias
  // n'aurait pas de portée.
  if (!contractId) return;
  const aliasBySite = new Map<string, string>();
  for (const line of resolved) {
    if (!line.siteId) continue;
    const alias = normalizeBillingAlias(line.label);
    if (!alias) continue;
    aliasBySite.set(alias, line.siteId);
  }
  for (const [alias, siteId] of aliasBySite) {
    await tx.contractSiteAlias.upsert({
      where: { contractId_alias: { contractId, alias } },
      // Le dernier choix de l'utilisateur fait foi : un libellé réaffecté à un
      // autre site doit déplacer l'alias, pas en créer un second.
      update: { siteId, organizationId },
      create: { contractId, alias, siteId, organizationId },
    });
  }
}
