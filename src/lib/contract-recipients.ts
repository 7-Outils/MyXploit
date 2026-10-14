import prisma from "@/lib/prisma";

export interface ContractRecipient {
  name: string;
  email: string;
  role: string | null;
  side: "EXPLOITANT" | "CLIENT";
}

/**
 * Candidats à l'envoi d'un email pour un contrat : carnet de contacts du
 * contrat, complété par le champ historique email exploitant du contrat,
 * dédoublonnés par adresse.
 */
export async function getContractRecipients(contractId: string): Promise<ContractRecipient[]> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      provider: true,
      providerEmail: true,
    },
  });
  if (!contract) return [];

  const contacts = await prisma.contractContact.findMany({
    where: { contractId },
    orderBy: [{ side: "asc" }, { name: "asc" }],
  });

  const recipients: ContractRecipient[] = contacts.map((c) => ({
    name: c.name,
    email: c.email,
    role: c.role,
    side: c.side,
  }));
  const seen = new Set(recipients.map((r) => r.email.toLowerCase()));

  const legacyProvider = contract.providerEmail;
  if (legacyProvider && !seen.has(legacyProvider.toLowerCase())) {
    seen.add(legacyProvider.toLowerCase());
    recipients.push({
      name: contract.provider || "Exploitant",
      email: legacyProvider,
      role: "Contrat",
      side: "EXPLOITANT",
    });
  }
  return recipients;
}
