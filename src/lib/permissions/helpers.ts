import { UserRole, Module } from "@/generated/prisma";

// ============================================
// Vérifications de rôle (sans accès DB)
// ============================================

export const isSuperAdmin = (role: UserRole): boolean => role === "SUPER_ADMIN";
export const isAdmin = (role: UserRole): boolean => role === "ADMIN";
export const isEditor = (role: UserRole): boolean => role === "EDITOR";
export const isManager = (role: UserRole): boolean => role === "MANAGER"; // @deprecated
export const isReader = (role: UserRole): boolean => role === "READER";

// Peut créer/modifier/supprimer (EDITOR+)
export const canEdit = (role: UserRole): boolean =>
  role === "SUPER_ADMIN" || role === "ADMIN" || role === "EDITOR" || role === "MANAGER";

// Peut supprimer (EDITOR+)
export const canDelete = (role: UserRole): boolean =>
  role === "SUPER_ADMIN" || role === "ADMIN" || role === "EDITOR" || role === "MANAGER";

// Peut créer (EDITOR+)
export const canCreate = (role: UserRole): boolean =>
  role === "SUPER_ADMIN" || role === "ADMIN" || role === "EDITOR" || role === "MANAGER";

// Peut importer (EDITOR+)
export const canImport = (role: UserRole): boolean =>
  role === "SUPER_ADMIN" || role === "ADMIN" || role === "EDITOR" || role === "MANAGER";

// Peut exporter (tous)
export const canExport = (role: UserRole): boolean => true;

// Peut synchroniser (EDITOR+)
export const canSync = (role: UserRole): boolean =>
  role === "SUPER_ADMIN" || role === "ADMIN" || role === "EDITOR" || role === "MANAGER";

// Peut gérer les utilisateurs de son org (ADMIN+)
export const canManageUsers = (role: UserRole): boolean =>
  role === "SUPER_ADMIN" || role === "ADMIN";

// Peut gérer les organisations (SUPER_ADMIN uniquement)
export const canManageOrganizations = (role: UserRole): boolean =>
  role === "SUPER_ADMIN";

// Peut gérer les modules des orgs (SUPER_ADMIN uniquement)
export const canManageModules = (role: UserRole): boolean =>
  role === "SUPER_ADMIN";

// Peut utiliser le mode fantôme (SUPER_ADMIN uniquement)
export const canUseGhostMode = (role: UserRole): boolean =>
  role === "SUPER_ADMIN";

// ============================================
// Labels des rôles
// ============================================

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Administrateur",
  ADMIN: "Administrateur",
  EDITOR: "Éditeur",
  MANAGER: "Manager", // @deprecated
  READER: "Lecteur",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  SUPER_ADMIN: "Accès complet à toutes les organisations",
  ADMIN: "Gère les utilisateurs de son organisation",
  EDITOR: "Peut créer, modifier et supprimer",
  MANAGER: "Peut créer, modifier et supprimer", // @deprecated
  READER: "Consultation et export uniquement",
};

// ============================================
// Labels des modules
// ============================================

export const MODULE_LABELS: Record<Module, string> = {
  ENERGY: "Suivi énergétique",
  FINANCIER: "Suivi financier",
  ADMINISTRATIF: "Suivi administratif",
  EXPLOITATION: "Suivi exploitation",
  OUTILS: "Boîte à outils",
  CONTRACTS: "Gestion contrats",
  PRICING: "Tarification",
};

export const MODULE_DESCRIPTIONS: Record<Module, string> = {
  ENERGY: "Consommations, DJU, alertes, synchronisation Enedis",
  FINANCIER: "Factures, devis, budget, décompte P3",
  ADMINISTRATIF: "Contrats, réunions, documents",
  EXPLOITATION: "Équipements, audits techniques",
  OUTILS: "Calculateurs, dimensionnement",
  CONTRACTS: "Gestion avancée des contrats",
  PRICING: "Grilles tarifaires, import devis",
};

// Tous les modules disponibles
export const ALL_MODULES: Module[] = [
  "ENERGY",
  "FINANCIER",
  "ADMINISTRATIF",
  "EXPLOITATION",
  "OUTILS",
  "CONTRACTS",
  "PRICING",
];
