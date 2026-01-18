import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  TECHNICAL_CHECKLISTS,
  COMMON_CHECKLIST,
  CATEGORY_LABELS,
} from "@/lib/audit/technical-checklists";

/**
 * Génère un texte professionnel pour le rapport si CONFORME
 */
function generateConformeText(label: string): string {
  const normalizedLabel = label.toLowerCase();

  // Adapter le texte selon le contexte
  if (normalizedLabel.includes("présent") || normalizedLabel.includes("disponible")) {
    return `Point vérifié et conforme : ${label.replace(/\(.*\)/, "").trim()}.`;
  }
  if (normalizedLabel.includes("conforme") || normalizedLabel.includes("fonctionnel")) {
    return `Contrôle effectué : ${label.replace(/\(.*\)/, "").trim()}. Aucune anomalie détectée.`;
  }
  if (normalizedLabel.includes("état")) {
    return `${label.replace(/\(.*\)/, "").trim()} : état satisfaisant.`;
  }
  if (normalizedLabel.includes("absence") || normalizedLabel.includes("pas de")) {
    return `Vérification effectuée : ${label.replace(/\(.*\)/, "").trim()}. Situation conforme.`;
  }

  return `Point de contrôle validé : ${label.replace(/\(.*\)/, "").trim()}.`;
}

/**
 * Génère un texte d'alerte pour le rapport si NON_CONFORME
 */
function generateNonConformeText(label: string): string {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("présent") || normalizedLabel.includes("disponible")) {
    return `Non-conformité constatée : ${label.replace(/\(.*\)/, "").trim()} - Élément manquant ou non accessible.`;
  }
  if (normalizedLabel.includes("conforme") || normalizedLabel.includes("fonctionnel")) {
    return `Non-conformité détectée : ${label.replace(/\(.*\)/, "").trim()} - Anomalie à corriger.`;
  }
  if (normalizedLabel.includes("état")) {
    return `Non-conformité relevée : ${label.replace(/\(.*\)/, "").trim()} - État dégradé nécessitant intervention.`;
  }

  return `Non-conformité identifiée : ${label.replace(/\(.*\)/, "").trim()}. Action corrective requise.`;
}

// POST /api/admin/migration - Migrer les checklists hardcodées vers la base de données
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Seul ADMIN peut effectuer la migration
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    // Vérifier si déjà migré
    const existingTemplates = await prisma.checklistTemplate.count({
      where: { organizationId: user.organizationId },
    });

    if (existingTemplates > 0) {
      return NextResponse.json(
        { error: "La migration a déjà été effectuée. Supprimez les templates existants pour recommencer." },
        { status: 400 }
      );
    }

    const results = {
      categories: 0,
      templates: 0,
      items: 0,
    };

    // 1. Créer toutes les catégories
    for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
      await prisma.checklistCategory.create({
        data: {
          organizationId: user.organizationId,
          key,
          label,
          sortOrder: results.categories,
        },
      });
      results.categories++;
    }

    // 2. Créer le template commun (Documentation et Conformité)
    const commonTemplate = await prisma.checklistTemplate.create({
      data: {
        organizationId: user.organizationId,
        name: COMMON_CHECKLIST.name,
        domain: COMMON_CHECKLIST.domain,
        equipmentTypes: COMMON_CHECKLIST.types,
        description: "Checklist commune à tous les audits - Documentation et conformité administrative",
        sortOrder: 0,
      },
    });
    results.templates++;

    // Créer les items du template commun
    for (let i = 0; i < COMMON_CHECKLIST.items.length; i++) {
      const item = COMMON_CHECKLIST.items[i];
      await prisma.checklistTemplateItem.create({
        data: {
          templateId: commonTemplate.id,
          itemKey: item.id,
          label: item.label,
          category: item.category,
          description: item.description || null,
          conformeText: generateConformeText(item.label),
          nonConformeText: generateNonConformeText(item.label),
          sortOrder: i,
        },
      });
      results.items++;
    }

    // 3. Créer les templates par type d'équipement
    for (let t = 0; t < TECHNICAL_CHECKLISTS.length; t++) {
      const checklist = TECHNICAL_CHECKLISTS[t];

      const template = await prisma.checklistTemplate.create({
        data: {
          organizationId: user.organizationId,
          name: checklist.name,
          domain: checklist.domain,
          equipmentTypes: checklist.types,
          description: `Checklist technique pour ${checklist.name}`,
          sortOrder: t + 1,
        },
      });
      results.templates++;

      // Créer les items de ce template
      for (let i = 0; i < checklist.items.length; i++) {
        const item = checklist.items[i];
        await prisma.checklistTemplateItem.create({
          data: {
            templateId: template.id,
            itemKey: item.id,
            label: item.label,
            category: item.category,
            description: item.description || null,
            conformeText: generateConformeText(item.label),
            nonConformeText: generateNonConformeText(item.label),
            sortOrder: i,
          },
        });
        results.items++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migration réussie",
      results,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la migration" },
      { status: 500 }
    );
  }
}

// GET /api/admin/migration - Vérifier le statut de migration
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs" },
        { status: 403 }
      );
    }

    const [templatesCount, categoriesCount, itemsCount] = await Promise.all([
      prisma.checklistTemplate.count({
        where: { organizationId: user.organizationId },
      }),
      prisma.checklistCategory.count({
        where: { organizationId: user.organizationId },
      }),
      prisma.checklistTemplateItem.count({
        where: {
          template: { organizationId: user.organizationId },
        },
      }),
    ]);

    return NextResponse.json({
      migrated: templatesCount > 0,
      counts: {
        templates: templatesCount,
        categories: categoriesCount,
        items: itemsCount,
      },
      hardcodedCounts: {
        templates: TECHNICAL_CHECKLISTS.length + 1, // +1 pour COMMON_CHECKLIST
        categories: Object.keys(CATEGORY_LABELS).length,
        items: COMMON_CHECKLIST.items.length +
               TECHNICAL_CHECKLISTS.reduce((sum, c) => sum + c.items.length, 0),
      },
    });
  } catch (error) {
    console.error("Error checking migration status:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification" },
      { status: 500 }
    );
  }
}
