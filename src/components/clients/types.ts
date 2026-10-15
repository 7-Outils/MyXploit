// Types de la page Clients (/clients).
//
// Les payloads viennent du cache SWR persistant (localStorage) : tout champ
// autre que id/name est lu avec garde.

export interface ClientContractSummary {
  id: string;
  reference: string | null;
  title: string | null;
  provider: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  _count?: { contractSites: number };
}

export interface ClientListItem {
  id: string;
  name: string;
  _count?: { sites: number; contracts: number };
}

export interface ClientDetail {
  id: string;
  name: string;
  contracts?: ClientContractSummary[];
  _count?: { sites: number; contracts: number };
}

export const STATUS_LABELS: Record<string, string> = {
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  RESILIE: "Résilié",
};

// Texte seul, pas de pastille : seule la couleur porte le statut.
export const STATUS_TEXT: Record<string, string> = {
  ACTIF: "text-ink",
  EXPIRE: "text-red-700",
  RESILIE: "text-ink/40",
};
