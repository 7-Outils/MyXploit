/**
 * Statut d'un contrat : déduit, jamais saisi.
 *  - RESILIE : une date de résiliation est renseignée (seule saisie manuelle)
 *  - EXPIRE  : la date de fin est passée
 *  - ACTIF   : sinon (y compris sans dates : un contrat créé est actif)
 */
export type DerivedStatus = "ACTIF" | "EXPIRE" | "RESILIE";

export function deriveStatus(
  c: { endDate: Date | string | null; terminatedAt?: Date | string | null },
  today = new Date()
): DerivedStatus {
  if (c.terminatedAt) return "RESILIE";
  if (c.endDate) {
    const end = new Date(c.endDate);
    if (!Number.isNaN(end.getTime()) && end < today) return "EXPIRE";
  }
  return "ACTIF";
}

export function isClosed(c: { endDate: Date | string | null; terminatedAt?: Date | string | null }): boolean {
  return deriveStatus(c) !== "ACTIF";
}

/** Remplace le statut stocké par le statut déduit dans un objet contrat. */
export function withDerivedStatus<T extends { endDate: Date | string | null; terminatedAt?: Date | string | null }>(c: T): T & { status: DerivedStatus } {
  return { ...c, status: deriveStatus(c) };
}
