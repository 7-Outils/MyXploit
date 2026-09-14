/**
 * Import de devis — forme des champs lus par l'IA et rapprochement du site.
 * Il n'y a volontairement pas de parser de secours : quand la lecture IA
 * échoue, le formulaire s'ouvre vide avec la cause, plutôt que pré-rempli de
 * valeurs devinées qui auraient l'air vraies.
 */

export interface ParsedQuote {
  reference: string | null;
  siteName: string | null;
  siteCity: string | null;
  objet: string | null;
  amountHT: number | null;
  issueDate: string | null; // ISO "YYYY-MM-DD"
  /** Seuls types connus de l'application ; tout ce qui n'est pas P3 est ramené à P5. */
  quoteType: "P3" | "P5" | null;
}

export function emptyParsedQuote(): ParsedQuote {
  return {
    reference: null,
    siteName: null,
    siteCity: null,
    objet: null,
    amountHT: null,
    issueDate: null,
    quoteType: null,
  };
}

function normalizeCity(city: string): string {
  return city
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z\s]/g, "")
    .trim();
}

// Mots génériques fréquents dans les noms de sites français — exclus du
// rapprochement, « école » ou « mairie » seul n'est pas distinctif.
const GENERIC_SITE_WORDS = new Set([
  "ecole", "école", "elementaire", "élémentaire", "maternelle", "primaire",
  "college", "collège", "lycee", "lycée", "groupe", "scolaire",
  "mairie", "hotel", "hôtel", "ville", "maison",
  "piscine", "gymnase", "stade", "complexe", "salle", "centre", "club",
  "eglise", "église", "cimetiere", "cimetière",
  "residence", "résidence", "foyer", "logement", "logements",
  "de", "la", "le", "du", "des", "les", "l", "d",
  "saint", "sainte", "st", "ste",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);
}

function distinctiveTokens(s: string): string[] {
  return tokenize(s).filter((w) => w.length >= 3 && !GENERIC_SITE_WORDS.has(w));
}

/**
 * Rapproche le site lu sur le devis d'un site en base. Ne rapproche par la
 * ville que si un nom de site est connu, pour ne pas confondre la mairie et
 * l'école d'une même commune.
 */
export function findSiteMatch(
  siteName: string | null,
  siteCity: string | null,
  sites: Array<{ id: string; name: string; city: string; address: string }>
): { id: string; name: string } | null {
  if (!siteName && !siteCity) return null;

  const searchDistinctive = siteName ? distinctiveTokens(siteName) : [];
  const normalizedSearchName = siteName ? siteName.toLowerCase().trim() : "";
  const normalizedSearchCity = siteCity ? normalizeCity(siteCity) : "";

  // Première passe : nom exact, ou contenu / contenant.
  if (normalizedSearchName) {
    for (const site of sites) {
      const normalizedName = site.name.toLowerCase().trim();
      if (normalizedName === normalizedSearchName) {
        return { id: site.id, name: site.name };
      }
      if (normalizedName.includes(normalizedSearchName) || normalizedSearchName.includes(normalizedName)) {
        return { id: site.id, name: site.name };
      }
    }
  }

  // Deuxième passe : au moins un token distinctif commun (nom propre, numéro),
  // confirmé par la ville quand on la connaît.
  if (searchDistinctive.length > 0) {
    for (const site of sites) {
      const siteDistinctive = new Set(distinctiveTokens(site.name));
      const hasDistinctiveMatch = searchDistinctive.some((t) => siteDistinctive.has(t));
      if (hasDistinctiveMatch) {
        if (normalizedSearchCity) {
          const normalizedCity = normalizeCity(site.city);
          if (normalizedCity.includes(normalizedSearchCity) || normalizedSearchCity.includes(normalizedCity)) {
            return { id: site.id, name: site.name };
          }
        } else {
          return { id: site.id, name: site.name };
        }
      }
    }
  }

  // Pas de rapprochement fiable — l'utilisateur choisit.
  return null;
}
