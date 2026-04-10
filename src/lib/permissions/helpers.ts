// Labels lisibles pour les rôles
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrateur",
  EDITOR: "Éditeur",
  MANAGER: "Manager",
  READER: "Lecteur",
};

// Classes CSS Tailwind pour les badges de rôle
export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-800",
  ADMIN: "bg-blue-100 text-blue-800",
  EDITOR: "bg-green-100 text-green-800",
  MANAGER: "bg-yellow-100 text-yellow-800",
  READER: "bg-gray-100 text-gray-700",
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
