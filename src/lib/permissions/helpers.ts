// Labels lisibles pour les rôles
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrateur",
  EDITOR: "Éditeur",
  MANAGER: "Manager",
  READER: "Lecteur",
};

// Rôles assignables (hors SUPER_ADMIN réservé à la plateforme)
export const ASSIGNABLE_ROLES = ["ADMIN", "EDITOR", "READER"] as const;

// Labels lisibles pour les modules
export const MODULE_LABELS: Record<string, string> = {
  ENERGY: "Énergie",
  FINANCIER: "Financier",
  ADMINISTRATIF: "Administratif",
  EXPLOITATION: "Exploitation",
  OUTILS: "Outils",
  CONTRACTS: "Contrats",
  PRICING: "Tarification",
};

// Vérifications de permissions par rôle
export function canEdit(role: string): boolean {
  return ["SUPER_ADMIN", "ADMIN", "EDITOR", "MANAGER"].includes(role);
}

export function canDelete(role: string): boolean {
  return ["SUPER_ADMIN", "ADMIN", "EDITOR", "MANAGER"].includes(role);
}

export function canCreate(role: string): boolean {
  return ["SUPER_ADMIN", "ADMIN", "EDITOR", "MANAGER"].includes(role);
}

export function canImport(role: string): boolean {
  return ["SUPER_ADMIN", "ADMIN", "EDITOR", "MANAGER"].includes(role);
}

export function canSync(role: string): boolean {
  return ["SUPER_ADMIN", "ADMIN", "EDITOR", "MANAGER"].includes(role);
}

export function canManageUsers(role: string): boolean {
  return ["SUPER_ADMIN", "ADMIN"].includes(role);
}

export function canUseGhostMode(role: string): boolean {
  return role === "SUPER_ADMIN";
}
