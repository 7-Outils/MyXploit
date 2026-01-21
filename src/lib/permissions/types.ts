import { UserRole, Module } from "@/generated/prisma";

// Actions possibles sur les ressources
export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "import"
  | "export"
  | "sync";

// Ressources du système
export type Resource =
  | "site"
  | "contract"
  | "equipment"
  | "invoice"
  | "quote"
  | "consumption"
  | "alert"
  | "meeting"
  | "user"
  | "organization"
  | "module";

// Contexte utilisateur pour les vérifications
export interface PermissionContext {
  userId: string;
  userRole: UserRole;
  organizationId: string;
  isGhostMode?: boolean;
  targetOrganizationId?: string;
  enabledModules?: Module[];
}

// Résultat d'une vérification de permission
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

// Mapping modules -> routes
export const MODULE_ROUTES: Record<Module, string[]> = {
  ENERGY: ["/energy"],
  FINANCIER: ["/financier"],
  ADMINISTRATIF: ["/administratif"],
  EXPLOITATION: ["/exploitation"],
  OUTILS: ["/outils"],
  CONTRACTS: ["/contracts"],
  PRICING: ["/pricing"],
};

// Modules toujours actifs (non désactivables)
export const ALWAYS_ENABLED_ROUTES = ["/overview", "/settings"];
