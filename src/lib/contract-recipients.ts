import prisma from "@/lib/prisma";

export interface ContractRecipient {
  name: string;
  email: string;
  role: string | null;
  side: "EXPLOITANT" | "CLIENT";
}

/**
 * Candidats à l'envoi d'un email pour un contrat : le carnet de contacts
 * du contrat (onglet Contacts), seule source.
 */
export async function getContractRecipients(contractId: string): Promise<ContractRecipient[]> {
  const contract = await prisma.contract.findUnique({ where: { id: contractId }, select: { id: true } });
  if (!contract) return [];

  const contacts = await prisma.contractContact.findMany({
    where: { contractId },
    orderBy: [{ side: "asc" }, { name: "asc" }],
  });

  return contacts.map((c) => ({
    name: c.name,
    email: c.email,
    role: c.role,
    side: c.side,
  }));
}
