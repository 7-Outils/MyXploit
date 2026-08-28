import { z } from "zod";
import { EquipmentType } from "@/generated/prisma/enums";

// Common validation patterns
const MAX_STRING_LENGTH = 500;
const MAX_TEXT_LENGTH = 5000;

// Caractéristiques d'équipement : objet plat, valeurs texte ou booléen.
export const equipmentCharacteristicsSchema = z
  .record(z.string().max(100), z.union([z.string().max(MAX_STRING_LENGTH), z.boolean()]))
  .nullable()
  .optional();

// Equipment validation
export const equipmentCreateSchema = z.object({
  siteId: z.string().uuid("ID de site invalide"),
  type: z.enum(EquipmentType, "Type d'équipement invalide"),
  name: z.string().max(MAX_STRING_LENGTH).optional(),
  brand: z.string().max(MAX_STRING_LENGTH).optional(),
  model: z.string().max(MAX_STRING_LENGTH).optional(),
  serialNumber: z.string().max(MAX_STRING_LENGTH).optional(),
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  power: z.coerce.number().min(0).max(1000000).optional(),
  quantity: z.coerce.number().int().min(1).max(10000).optional(),
  location: z.string().max(MAX_STRING_LENGTH).optional(),
  level: z.string().max(100).optional(),
  serviceArea: z.string().max(MAX_STRING_LENGTH).optional(),
  inContractList: z.boolean().optional(),
  presentOnSite: z.boolean().optional(),
  theoreticalLifespan: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(["OPERATIONNEL", "MAINTENANCE", "PANNE", "HORS_SERVICE"]).optional(),
  installDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  warrantyEnd: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  // Caractéristiques propres au type : dictionnaire libre (le vocabulaire vit
  // dans le formulaire), stocké tel quel. null efface la valeur existante.
  characteristics: equipmentCharacteristicsSchema,
  // Topologie : les rattachements sont vérifiés côté route (même site, type de
  // source), ici on ne contrôle que la forme.
  roomId: z.string().max(MAX_STRING_LENGTH).nullish(),
  circuitId: z.string().max(MAX_STRING_LENGTH).nullish(),
  parentEquipmentId: z.string().max(MAX_STRING_LENGTH).nullish(),
});

export const equipmentUpdateSchema = equipmentCreateSchema.partial().omit({ siteId: true });

// Site validation
export const siteCreateSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(MAX_STRING_LENGTH),
  address: z.string().max(MAX_STRING_LENGTH).optional(),
  city: z.string().max(MAX_STRING_LENGTH).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  surface: z.coerce.number().min(0).max(10000000).optional(),
  constructionYear: z.coerce.number().int().min(1800).max(new Date().getFullYear() + 5).optional(),
});

export const siteUpdateSchema = siteCreateSchema.partial();

// Contract validation
export const contractCreateSchema = z.object({
  reference: z.string().min(1, "La référence est requise").max(100),
  title: z.string().min(1, "Le titre est requis").max(MAX_STRING_LENGTH),
  provider: z.string().min(1, "Le fournisseur est requis").max(MAX_STRING_LENGTH),
  type: z.enum(["P1", "P2", "P3", "P1P2", "P1P2P3", "MT", "CP", "AUTRE"]),
  status: z.enum(["ACTIF", "TERMINE", "EN_ATTENTE", "RESILIE"]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
  annualAmount: z.coerce.number().min(0).max(100000000).optional(),
  description: z.string().max(MAX_TEXT_LENGTH).optional(),
});

export const contractUpdateSchema = contractCreateSchema.partial();

// Quote validation
export const quoteCreateSchema = z.object({
  reference: z.string().min(1).max(100),
  title: z.string().max(MAX_STRING_LENGTH).optional(),
  quoteType: z.enum(["P3", "TRAVAUX", "AMELIORATION", "AUTRE"]),
  amountHT: z.coerce.number().min(0).max(100000000),
  amountTTC: z.coerce.number().min(0).max(100000000).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(MAX_TEXT_LENGTH).optional(),
  status: z.enum(["BROUILLON", "EN_ATTENTE", "ACCEPTE", "REFUSE", "COMMANDE", "FACTURE"]).optional(),
  siteId: z.string().uuid().optional(),
  contractId: z.string().uuid(),
});

// Audit validation (simple audit)
export const auditCreateSchema = z.object({
  auditDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  auditor: z.string().max(MAX_STRING_LENGTH).optional(),
  // Les axes de l'évaluation rapide ne sont plus tous envoyés par le front
  // (performance / compliance ont disparu du formulaire) : tout est optionnel.
  visualState: z.enum(["NON_EVALUE", "CRITIQUE", "MAUVAIS", "MOYEN", "BON", "EXCELLENT"]).optional(),
  performance: z.enum(["NON_EVALUE", "CRITIQUE", "MAUVAIS", "MOYEN", "BON", "EXCELLENT"]).optional(),
  security: z.enum(["NON_EVALUE", "CRITIQUE", "MAUVAIS", "MOYEN", "BON", "EXCELLENT"]).optional(),
  accessibility: z.enum(["NON_EVALUE", "CRITIQUE", "MAUVAIS", "MOYEN", "BON", "EXCELLENT"]).optional(),
  compliance: z.enum(["NON_EVALUE", "CRITIQUE", "MAUVAIS", "MOYEN", "BON", "EXCELLENT"]).optional(),
  generalNotes: z.string().max(MAX_TEXT_LENGTH).optional(),
  status: z.enum(["OPERATIONNEL", "MAINTENANCE", "PANNE", "HORS_SERVICE"]).optional(),
});

// Technical audit validation (checklist-based audit for site)
const checklistItemResultSchema = z.object({
  equipmentType: z.string(),  // Type d'equipement (ex: "CHAUDIERE")
  itemId: z.string(),
  label: z.string(),
  category: z.string(),
  result: z.enum(["CONFORME", "NON_CONFORME", "NA", "NON_VERIFIE"]),
  notes: z.string().max(MAX_TEXT_LENGTH).optional(),
});

export const technicalAuditCreateSchema = z.object({
  auditDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  auditor: z.string().max(MAX_STRING_LENGTH).optional(),
  checklistItems: z.array(checklistItemResultSchema).min(1),
  globalResult: z.enum(["NON_VERIFIE", "CONFORME", "NON_CONFORME", "PARTIEL"]).optional(),
  generalNotes: z.string().max(MAX_TEXT_LENGTH).optional(),
  photos: z.array(z.string().url()).optional(),
});

// Meeting validation
export const meetingCreateSchema = z.object({
  type: z.enum(["EXPLOITATION", "TRAVAUX", "BILAN_ANNUEL", "URGENCE", "AUTRE"]),
  title: z.string().min(1).max(MAX_STRING_LENGTH),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  duration: z.coerce.number().int().min(15).max(480).optional(),
  location: z.string().max(MAX_STRING_LENGTH).optional(),
  attendees: z.string().max(MAX_TEXT_LENGTH).optional(),
  notes: z.string().max(MAX_TEXT_LENGTH).optional(),
  contractId: z.string().uuid(),
});

// Import validation (for bulk imports)
export const importRowsSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(10000),
  contractId: z.string().uuid().optional(),
  preview: z.boolean().optional(),
});

// Helper function to validate and return typed result
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const firstError = result.error.issues[0];
    const path = firstError.path.join(".");
    const message = firstError.message;
    return {
      success: false,
      error: path ? `${path}: ${message}` : message,
    };
  }

  return { success: true, data: result.data };
}
