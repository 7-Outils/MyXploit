import prisma from "@/lib/prisma";

/**
 * Suivi de la consommation IA : une ligne par appel, et un plafond mensuel
 * par organisation vérifié AVANT d'émettre l'appel. La clé IA est celle de
 * la plateforme par défaut : sans plafond, une boucle d'import se paie sur
 * la facture du bureau d'études.
 */

export interface AiUsageEntry {
  organizationId: string;
  clientId?: string | null;
  contractId?: string | null;
  quoteId?: string | null;
  userId?: string | null;
  /** QUOTE_IMPORT | KEY_TEST */
  feature: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  ok: boolean;
  error?: string | null;
}

/**
 * Enregistre un appel IA. Ne jette jamais : perdre une ligne de suivi ne
 * doit pas faire échouer l'import de devis qui vient de réussir.
 */
export async function recordAiUsage(entry: AiUsageEntry): Promise<string | null> {
  try {
    const row = await prisma.aiUsage.create({
      data: {
        organizationId: entry.organizationId,
        clientId: entry.clientId ?? null,
        contractId: entry.contractId ?? null,
        quoteId: entry.quoteId ?? null,
        userId: entry.userId ?? null,
        feature: entry.feature,
        provider: entry.provider,
        model: entry.model,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        costUsd: entry.costUsd,
        durationMs: entry.durationMs,
        ok: entry.ok,
        error: entry.error ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (error) {
    console.error("Error recording AI usage:", error);
    return null;
  }
}

/** Début du mois calendaire courant, en UTC. */
export function startOfCurrentMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Somme des coûts IA de l'organisation depuis le 1er du mois courant (UTC). */
export async function monthUsageUsd(organizationId: string): Promise<number> {
  const result = await prisma.aiUsage.aggregate({
    where: { organizationId, createdAt: { gte: startOfCurrentMonthUtc() } },
    _sum: { costUsd: true },
  });
  return result._sum.costUsd ?? 0;
}

export interface AiBudgetCheck {
  allowed: boolean;
  usedUsd: number;
  budgetUsd: number;
  /** Message affichable quand allowed vaut false. */
  message?: string;
}

/**
 * Vérifie qu'il reste du budget IA ce mois-ci. À appeler avant l'appel au
 * fournisseur : une fois l'appel émis, il est facturé.
 */
export async function checkAiBudget(organizationId: string): Promise<AiBudgetCheck> {
  const [org, usedUsd] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { aiMonthlyBudgetUsd: true },
    }),
    monthUsageUsd(organizationId),
  ]);

  const budgetUsd = org?.aiMonthlyBudgetUsd ?? 0;
  if (usedUsd < budgetUsd) return { allowed: true, usedUsd, budgetUsd };

  return {
    allowed: false,
    usedUsd,
    budgetUsd,
    message: `plafond IA mensuel atteint (${usedUsd.toFixed(2).replace(".", ",")} $ sur ${budgetUsd} $)`,
  };
}
