import prisma from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import type { AiConfig, AiProvider } from "@/lib/ai-client";

const PROVIDERS: AiProvider[] = ["GEMINI", "OPENAI", "ANTHROPIC"];

// Configuration IA effective d'une organisation : son fournisseur + sa clé
// (chiffrée en base, saisie dans Paramètres), sinon la clé plateforme
// GEMINI_API_KEY si elle est encore définie dans l'environnement.
export async function getOrgAi(organizationId: string): Promise<AiConfig | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { aiProvider: true, aiApiKey: true },
  });
  if (org?.aiApiKey) {
    try {
      const apiKey = decryptSecret(org.aiApiKey);
      const provider = PROVIDERS.includes(org.aiProvider as AiProvider)
        ? (org.aiProvider as AiProvider)
        : "GEMINI";
      if (apiKey) return { provider, apiKey };
    } catch {
      // TOKEN_ENCRYPTION_KEY absente ou valeur corrompue : secours plateforme
    }
  }
  if (process.env.GEMINI_API_KEY) {
    return { provider: "GEMINI", apiKey: process.env.GEMINI_API_KEY };
  }
  return null;
}
