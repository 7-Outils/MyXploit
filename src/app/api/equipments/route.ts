import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { rateLimit, getClientIdentifier, rateLimitExceeded } from "@/lib/rate-limit";
import { equipmentCreateSchema, validateInput } from "@/lib/validations";
import { TYPE_TO_DOMAIN } from "@/lib/equipment-domain";
import { resolveTopology } from "@/lib/equipment-topology";
import { Prisma } from "@/generated/prisma/client";
import { EquipmentType } from "@/generated/prisma/enums";
// Durées de vie théoriques : source unique, partagée avec le chiffrage P3.
import { LIFESPAN_BY_TYPE } from "@/lib/pricing/equipment-pricing";

/**
 * Colonnes servies aux écrans (liste, cartes, matrice, export PDF, fiche
 * d'édition). `select` explicite plutôt qu'`include` : les colonnes que
 * personne ne lit — installDate, quantity, theoreticalLifespan, serviceArea,
 * createdAt/updatedAt, organizationId — pesaient sur chaque ligne d'un parc de
 * plusieurs milliers d'organes.
 */
const EQUIPMENT_SELECT = {
  id: true,
  name: true,
  domain: true,
  type: true,
  brand: true,
  model: true,
  year: true,
  power: true,
  status: true,
  imageUrl: true,
  characteristics: true,
  // Topologie
  roomId: true,
  circuitId: true,
  parentEquipmentId: true,
  siteId: true,
  // Repérage terrain, lu par l'export PDF du patrimoine
  location: true,
  level: true,
  // Lus par la fiche d'édition (EquipmentModal)
  serialNumber: true,
  warrantyEnd: true,
  inContractList: true,
  presentOnSite: true,
  // Signature de la dernière écriture, affichée en tête de la fiche
  updatedAt: true,
  updatedByUser: {
    select: { firstName: true, lastName: true, email: true },
  },
  site: {
    select: { id: true, name: true, city: true },
  },
  // Topologie : le local et le circuit s'affichent sur la fiche et la liste,
  // le parent sert à regrouper les organes sous leur source.
  room: { select: { id: true, name: true } },
  circuit: { select: { id: true, name: true } },
  audits: {
    orderBy: [{ auditDate: "desc" }, { createdAt: "desc" }],
    take: 1, // Only latest audit
    // Seuls ces champs sont lus (matrice, tableau, export PDF). Les 5 blocs de
    // notes par critère et le tableau `photos` pesaient sur chaque ligne sans
    // jamais être affichés.
    select: {
      id: true,
      auditDate: true,
      auditor: true,
      visualState: true,
      performance: true,
      security: true,
      accessibility: true,
      compliance: true,
      generalNotes: true,
      auditedByUser: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  },
} as const satisfies Prisma.EquipmentSelect;

const EQUIPMENT_ORDER_BY: Prisma.EquipmentOrderByWithRelationInput[] = [
  { domain: "asc" },
  { type: "asc" },
  { createdAt: "desc" },
];

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/** Comparaison tolérante aux accents, à la casse et aux séparateurs. */
function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * `type` est une enum : Postgres ne sait pas y faire un `contains`. On résout
 * donc les codes correspondants côté serveur et on les passe en `in`.
 */
function matchingTypes(query: string): EquipmentType[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  return (Object.values(EquipmentType) as EquipmentType[]).filter((type) =>
    normalizeSearch(type).includes(q)
  );
}

// GET /api/equipments - List all equipments (optionally filter by siteId, contractId, domain)
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const { success } = await rateLimit(clientId);
    if (!success) return rateLimitExceeded();

    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const contractId = searchParams.get("contractId");
    const domain = searchParams.get("domain");
    const statsOnly = searchParams.get("stats") === "1";
    const pageParam = searchParams.get("page");
    const search = (searchParams.get("search") ?? "").trim();

    // Build where clause
    const where: Record<string, unknown> = {
      organizationId: effectiveOrgId,
    };

    if (siteId) {
      where.siteId = siteId;
    } else if (contractId) {
      // Get all sites for this contract
      const contractSites = await prisma.contractSite.findMany({
        where: { contractId, contract: { organizationId: effectiveOrgId } },
        select: { siteId: true },
      });
      where.siteId = { in: contractSites.map((cs) => cs.siteId) };
    }

    if (domain) {
      where.domain = domain;
    }

    // Mode « tuiles portefeuille » : quelques octets par équipement (son site
    // et l'état visuel du dernier audit), de quoi compter par site sans jamais
    // rapatrier le parc.
    if (statsOnly) {
      const rows = await prisma.equipment.findMany({
        where,
        select: {
          id: true,
          siteId: true,
          audits: {
            orderBy: [{ auditDate: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: { visualState: true },
          },
        },
      });
      return NextResponse.json(
        rows.map((row) => ({
          id: row.id,
          siteId: row.siteId,
          visualState: row.audits[0]?.visualState ?? null,
        }))
      );
    }

    // Mode paginé : le tableau ne demande que sa page, la recherche est
    // résolue en SQL (le libellé français d'un type n'existant qu'au front,
    // seul le code enum est comparé — voir matchingTypes).
    if (pageParam !== null) {
      const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
      const pageSize = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "", 10) || DEFAULT_PAGE_SIZE)
      );

      if (search) {
        const types = matchingTypes(search);
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { brand: { contains: search, mode: "insensitive" } },
          { model: { contains: search, mode: "insensitive" } },
          ...(types.length > 0 ? [{ type: { in: types } }] : []),
        ];
      }

      const [data, total] = await Promise.all([
        prisma.equipment.findMany({
          where,
          select: EQUIPMENT_SELECT,
          orderBy: EQUIPMENT_ORDER_BY,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.equipment.count({ where }),
      ]);

      return NextResponse.json({ data, total, page, pageSize });
    }

    // Liste complète : un site retenu (maître-détail, export PDF), ou le
    // comportement historique sans filtre de pagination.
    const equipments = await prisma.equipment.findMany({
      where,
      select: EQUIPMENT_SELECT,
      orderBy: EQUIPMENT_ORDER_BY,
    });

    return NextResponse.json(equipments);
  } catch (error) {
    console.error("Error fetching equipments:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des équipements" },
      { status: 500 }
    );
  }
}

// POST /api/equipments - Create a new equipment
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const { success } = await rateLimit(clientId);
    if (!success) return rateLimitExceeded();

    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour créer un équipement" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = validateInput(equipmentCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Verify the site belongs to the user's organization
    const site = await prisma.site.findFirst({
      where: {
        id: body.siteId,
        organizationId: effectiveOrgId,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    // Get type and infer domain
    const type = body.type || "AUTRE";
    const domain = body.domain || TYPE_TO_DOMAIN[type] || "AUTRE";

    // Pas de repère inventé : un repère terrain vide reste vide,
    // l'affichage se rabat sur le libellé du type.
    const name = body.name || null;

    // Get default lifespan based on type if not provided
    const theoreticalLifespan = body.theoreticalLifespan
      ? parseInt(body.theoreticalLifespan)
      : LIFESPAN_BY_TYPE[type] || 15;

    // Topologie : local / circuit doivent appartenir au site visé, et seul un
    // organe rattachable peut désigner une source.
    const topology = await resolveTopology(body, body.siteId, type);
    if (!topology.ok) {
      return NextResponse.json({ error: topology.error }, { status: 400 });
    }

    const equipment = await prisma.equipment.create({
      data: {
        name,
        domain,
        type,
        brand: body.brand || null,
        model: body.model || null,
        serialNumber: body.serialNumber || null,
        year: body.year ? parseInt(body.year) : null,
        power: body.power ? parseFloat(body.power) : null,
        quantity: body.quantity ? parseInt(body.quantity) : null,
        location: body.location || null,
        level: body.level || null,
        serviceArea: body.serviceArea || null,
        inContractList: body.inContractList ?? true,
        presentOnSite: body.presentOnSite ?? true,
        theoreticalLifespan,
        status: body.status || "OPERATIONNEL",
        installDate: body.installDate ? new Date(body.installDate) : null,
        warrantyEnd: body.warrantyEnd ? new Date(body.warrantyEnd) : null,
        // Caractéristiques propres au type : stockées telles quelles (validées
        // par equipmentCreateSchema). Absentes = colonne NULL.
        characteristics: validation.data.characteristics ?? Prisma.DbNull,
        ...topology.data,
        siteId: body.siteId,
        organizationId: effectiveOrgId,
        // Signature : l'auteur de la saisie
        updatedById: user.id,
      },
      include: {
        site: {
          select: { id: true, name: true },
        },
        room: { select: { id: true, name: true } },
        circuit: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(equipment, { status: 201 });
  } catch (error) {
    console.error("Error creating equipment:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'équipement" },
      { status: 500 }
    );
  }
}
