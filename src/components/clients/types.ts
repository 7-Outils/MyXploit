// Types et helpers du portefeuille clients (/clients).
//
// Les payloads viennent du cache SWR persistant (localStorage) : un cache
// antérieur à l'enrichissement de GET /api/clients n'a ni `contracts` ni
// parfois `_count`. Tout accès passe par les helpers ci-dessous, gardés.

export interface ClientContractSummary {
  id: string;
  reference: string;
  title: string;
  provider: string;
  status: string;
  startDate: string;
  endDate: string;
  _count?: { contractSites: number };
}

export interface ClientListItem {
  id: string;
  name: string;
  contracts?: ClientContractSummary[];
  _count?: { sites: number; contracts: number };
}

export interface ClientSite {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
  energyType: string;
  surface: number | null;
  _count?: { equipments: number; alerts: number };
}

export interface ClientDetail {
  id: string;
  name: string;
  sites?: ClientSite[];
  contracts?: ClientContractSummary[];
  _count?: { sites: number; contracts: number };
}

export const STATUS_LABELS: Record<string, string> = {
  ACTIF: "Actif",
  EN_ATTENTE: "En attente",
  EXPIRE: "Expiré",
  RESILIE: "Résilié",
};

// Texte seul, pas de pastille : seule la couleur porte le statut.
export const STATUS_TEXT: Record<string, string> = {
  ACTIF: "text-ink",
  EN_ATTENTE: "text-ink/50",
  EXPIRE: "text-red-700",
  RESILIE: "text-ink/40",
};

/** Seuil « échéance proche » : un renouvellement de marché se prépare un an avant. */
export const EXPIRING_SOON_DAYS = 365;

const DAY_MS = 86_400_000;

export function daysUntil(dateIso: string | null | undefined, now = Date.now()): number | null {
  if (!dateIso) return null;
  const t = new Date(dateIso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now) / DAY_MS);
}

/** « 23 j », « 8 mois », « 2,4 ans », « échu ». */
export function formatRemaining(days: number | null): string {
  if (days === null) return "—";
  if (days < 0) return "échu";
  if (days < 62) return `${days} j`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} mois`;
  return `${(days / 365.25).toFixed(1).replace(".", ",")} ans`;
}

/** Couleur d'une échéance : rouge si échue, accent si proche, neutre sinon. */
export function remainingTone(days: number | null): string {
  if (days === null) return "text-ink/30";
  if (days < 0) return "text-red-700";
  if (days <= EXPIRING_SOON_DAYS) return "text-accent";
  return "text-ink/60";
}

export function formatDate(dateIso: string | null | undefined): string {
  if (!dateIso) return "—";
  const d = new Date(dateIso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
}

export function formatMonthYear(dateIso: string | null | undefined): string {
  if (!dateIso) return "—";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export interface ClientDigest {
  contracts: ClientContractSummary[];
  contractCount: number;
  activeCount: number;
  siteCount: number;
  providers: string[];
  /** Contrat actif dont l'échéance est la plus proche (échus compris). */
  nextContract: ClientContractSummary | null;
  nextDays: number | null;
}

/** Synthèse d'un client pour la liste maître et les totaux. */
export function digestClient(client: ClientListItem | ClientDetail, now = Date.now()): ClientDigest {
  const contracts = Array.isArray(client.contracts) ? client.contracts : [];
  const active = contracts.filter((c) => c.status === "ACTIF");
  let nextContract: ClientContractSummary | null = null;
  let nextDays: number | null = null;
  for (const c of active) {
    const d = daysUntil(c.endDate, now);
    if (d === null) continue;
    if (nextDays === null || d < nextDays) {
      nextDays = d;
      nextContract = c;
    }
  }
  const providers = Array.from(
    new Set(contracts.map((c) => (c.provider || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "fr"));

  return {
    contracts,
    contractCount: client._count?.contracts ?? contracts.length,
    activeCount: active.length,
    siteCount: client._count?.sites ?? 0,
    providers,
    nextContract,
    nextDays,
  };
}
