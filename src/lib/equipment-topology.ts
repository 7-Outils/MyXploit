import prisma from "@/lib/prisma";

/**
 * Topologie d'un équipement (modèle MyXploit App) : local technique, circuit
 * desservi, et rattachement à un équipement « source ».
 */

/** Équipements de production auxquels on peut rattacher un organe. */
export const SOURCE_EQUIPMENT_TYPES = new Set([
  "CHAUDIERE",
  "CHAUDIERE_CONDENSATION",
  "PAC",
  "PAC_AIR_EAU",
  "GROUPE_FROID",
  "ECHANGEUR_ECS",
  "STATION_SOLAIRE",
  "BALLON_ECS",
  "BALLON_THERMODYNAMIQUE",
]);

/** Seuls ces organes se rattachent à une source (pompe de charge, vanne 2V). */
export const ATTACHABLE_EQUIPMENT_TYPES = new Set([
  "POMPE_CHARGE",
  "VANNE_2V_MOTORISEE",
]);

export interface TopologyInput {
  roomId?: unknown;
  circuitId?: unknown;
  parentEquipmentId?: unknown;
}

export type TopologyResult =
  | { ok: true; data: Record<string, string | null> }
  | { ok: false; error: string };

function asId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Valide les trois rattachements contre le site (et le type) de l'équipement.
 * `undefined` = champ absent de la charge utile, on n'y touche pas.
 *
 * @param siteId site auquel appartiendra l'équipement après l'opération
 * @param type type de l'équipement après l'opération
 * @param selfId id de l'équipement en cours de modification (interdit d'être son propre parent)
 */
export async function resolveTopology(
  body: TopologyInput,
  siteId: string,
  type: string | undefined,
  selfId?: string
): Promise<TopologyResult> {
  const data: Record<string, string | null> = {};

  if (body.roomId !== undefined) {
    const roomId = asId(body.roomId);
    if (roomId) {
      const room = await prisma.technicalRoom.findFirst({
        where: { id: roomId, siteId },
        select: { id: true },
      });
      if (!room) {
        return { ok: false, error: "Local technique introuvable sur ce site" };
      }
    }
    data.roomId = roomId;
  }

  if (body.circuitId !== undefined) {
    const circuitId = asId(body.circuitId);
    if (circuitId) {
      const circuit = await prisma.circuit.findFirst({
        where: { id: circuitId, siteId },
        select: { id: true },
      });
      if (!circuit) {
        return { ok: false, error: "Circuit introuvable sur ce site" };
      }
    }
    data.circuitId = circuitId;
  }

  if (body.parentEquipmentId !== undefined) {
    const parentId = asId(body.parentEquipmentId);
    if (parentId) {
      if (!type || !ATTACHABLE_EQUIPMENT_TYPES.has(type)) {
        return {
          ok: false,
          error:
            "Seules les pompes de charge et vannes 2 voies motorisées se rattachent à une source",
        };
      }
      if (selfId && parentId === selfId) {
        return { ok: false, error: "Un équipement ne peut pas se rattacher à lui-même" };
      }
      const parent = await prisma.equipment.findFirst({
        where: { id: parentId, siteId },
        select: { type: true },
      });
      if (!parent) {
        return { ok: false, error: "Équipement source introuvable sur ce site" };
      }
      if (!SOURCE_EQUIPMENT_TYPES.has(parent.type)) {
        return { ok: false, error: "L'équipement de rattachement n'est pas une source" };
      }
    }
    data.parentEquipmentId = parentId;
  }

  return { ok: true, data };
}
