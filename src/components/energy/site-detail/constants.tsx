export const SITE_TYPE_LABELS: Record<string, string> = {
  LYCEE: "Lycée",
  COLLEGE: "Collège",
  ECOLE: "École",
  MAIRIE: "Mairie",
  HOPITAL: "Hôpital",
  GYMNASE: "Gymnase",
  PISCINE: "Piscine",
  MEDIATHEQUE: "Médiathèque",
  AUTRE: "Autre",
};

export const ENERGY_TYPE_LABELS: Record<string, string> = {
  GAZ: "Gaz",
  ELECTRICITE: "Électricité",
  FIOUL: "Fioul",
  BOIS: "Bois",
  RESEAU_CHALEUR: "RCU",
  EAU: "Eau",
  AUTRE: "Autre",
};

export function formatMonthLabel(month: string): string {
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const [, m] = month.split("-");
  return months[parseInt(m) - 1] || month;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

export function toMWh(kWh: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(kWh / 1000);
}

export function getStatusBadge(status: string): JSX.Element {
  const base = "px-2 py-1 rounded-full text-xs font-medium";
  switch (status) {
    case "ECONOMIE":
      return <span className={`${base} bg-green-100 text-green-800`}>Économie</span>;
    case "DEPASSEMENT":
      return <span className={`${base} bg-red-100 text-red-800`}>Dépassement</span>;
    default:
      return <span className={`${base} bg-blue-100 text-blue-800`}>Objectif atteint</span>;
  }
}
