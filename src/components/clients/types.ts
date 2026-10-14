// Types de la page Clients (/clients).
//
// Les payloads viennent du cache SWR persistant (localStorage) : tout champ
// autre que id/name est lu avec garde.

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
