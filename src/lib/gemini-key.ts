import prisma from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";

// Clé API Gemini effective pour une organisation : sa propre clé (chiffrée
// en base via crypto.ts, saisie dans Paramètres), sinon la clé plateforme
// GEMINI_API_KEY si elle est encore définie dans l'environnement.
export async function getGeminiApiKey(organizationId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { geminiApiKey: true },
  });
  if (org?.geminiApiKey) {
    try {
      const key = decryptSecret(org.geminiApiKey);
      if (key) return key;
    } catch {
      // TOKEN_ENCRYPTION_KEY absente ou valeur corrompue : on retombe sur la clé plateforme
    }
  }
  return process.env.GEMINI_API_KEY || null;
}
