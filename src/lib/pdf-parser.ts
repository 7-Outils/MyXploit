/**
 * Service de parsing PDF pour extraction de devis
 * Champs extraits: référence, site, objet des travaux, montant HT
 */

import { extractText } from "unpdf";

export interface ParsedQuote {
  reference: string | null;
  siteName: string | null;
  siteCity: string | null;
  objet: string | null;
  amountHT: number | null;
  quoteType: "P3" | "P5" | "TRAVAUX" | "AMELIORATION" | "AUTRE" | null;
  rawText: string;
}

/**
 * Extraire le texte d'un PDF
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(pdfBuffer);
  const { text } = await extractText(uint8Array, { mergePages: true });
  return text;
}

/**
 * Parser le texte extrait pour trouver les informations clés du devis
 */
export function parseQuoteFromText(text: string): ParsedQuote {
  const result: ParsedQuote = {
    reference: null,
    siteName: null,
    siteCity: null,
    objet: null,
    amountHT: null,
    quoteType: null,
    rawText: text,
  };

  // 0. TYPE DE DEVIS (P3, P5, etc.)
  const typeMatch = text.match(/Devis\s+(P3|P5)\s+/i) || text.match(/\b(P3|P5)\b/);
  if (typeMatch) {
    result.quoteType = typeMatch[1].toUpperCase() as "P3" | "P5";
  }

  // 1. RÉFÉRENCE DU DEVIS
  const refPatterns = [
    // Format IDEX: "Devis P3 DD251202778-A1"
    /Devis\s+P\d\s+([A-Z]{2}\d+(?:-[A-Z0-9]+)?)/i,
    // Format standard avec N°
    /DEVIS\s*N°?\s*:?\s*([A-Z0-9\-]+)/i,
    /Devis\s*n°?\s*:?\s*([A-Z0-9\-]+)/i,
    /N°\s*(?:devis)?\s*:?\s*([A-Z]{2}\d+)/i,
  ];
  for (const pattern of refPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.reference = match[1].trim();
      break;
    }
  }

  // 2. SITE / CHANTIER
  // Format IDEX: "Site ECOLE ELEMENTAIRE CHARLES PEGUY - GONESSE" suivi de "Adresse ..."
  // IMPORTANT: Exclure les noms de clients (VILLE DE, MAIRIE, etc.)
  const idexSiteMatch = text.match(/Site\s+([A-ZÀ-Ü][A-Za-zÀ-ü\s'''\-]+?)(?:\s*[\-\n]|\s+Adresse)/i);
  if (idexSiteMatch) {
    const potentialSite = idexSiteMatch[1].trim().replace(/\s*-\s*$/, "");
    // Exclure les noms de clients typiques (mairie, ville de, etc.)
    if (!potentialSite.match(/^(VILLE\s+DE|MAIRIE|COMMUNE\s+DE|COMMUNAUTE)/i)) {
      result.siteName = potentialSite;
    }
  }

  // Si pas de site trouvé ou exclu, chercher un établissement spécifique
  if (!result.siteName) {
    // Chercher "Site" suivi d'un nom d'établissement (école, collège, lycée, etc.)
    const etablissementMatch = text.match(/Site\s+((?:ECOLE|COLLEGE|LYCEE|CRECHE|GYMNASE|STADE|CENTRE|MAISON|GROUPE\s+SCOLAIRE)[A-Za-zÀ-ü\s'''\-]+?)(?:\s*[\-\n]|\s+Adresse)/i);
    if (etablissementMatch) {
      result.siteName = etablissementMatch[1].trim().replace(/\s*-\s*$/, "");
    }
  }

  // Chercher la ville dans "Adresse" IDEX: "93550 GONESSE CEDEX"
  const idexCityMatch = text.match(/Adresse[\s\S]{0,100}?(\d{5})\s+([A-ZÀ-Ü][A-Za-zÀ-ü\s\-]+?)(?:\s+CEDEX|\s*\n)/i);
  if (idexCityMatch) {
    result.siteCity = idexCityMatch[2].trim().toUpperCase().replace(/\s+CEDEX/i, "");
  }

  // Fallback: Format standard "Adresse de Chantier"
  if (!result.siteName) {
    const siteMatch = text.match(/Adresse\s*de\s*Chantier\s*:?\s*([\s\S]*?)(?:Adresse\s*de\s*facturation|ADRESSE\s*DE\s*FACTURATION|Facturer\s*[àa]|Client\s*:|Description|Descriptif|N°\s*Description)/i);

    if (siteMatch) {
      const siteInfo = siteMatch[1].trim();

      // Extraire le nom du site - couper avant les mots d'adresse
      const nameMatch = siteInfo.match(/^([A-ZÀ-Üa-zà-ü][A-Za-zÀ-ü\s'''-]+?)(?:\s+(?:\d+\s*)?(?:Allée|Rue|Avenue|Boulevard|Place|Chemin|Impasse|Route|Cours|Passage|Quai)\s)/i);
      if (nameMatch) {
        result.siteName = nameMatch[1].trim();
      } else {
        // Fallback: prendre jusqu'au premier nombre ou code postal
        const fallbackMatch = siteInfo.match(/^([A-ZÀ-Üa-zà-ü][A-Za-zÀ-ü\s'''-]+?)(?:\s+\d)/);
        if (fallbackMatch) {
          result.siteName = fallbackMatch[1].trim();
        } else {
          // Dernier recours: premiers mots significatifs
          result.siteName = siteInfo.split(/\s{2,}|\n/)[0]?.trim().substring(0, 50) || null;
        }
      }

      // Extraire la ville (code postal + nom)
      if (!result.siteCity) {
        const cityMatch = siteInfo.match(/(\d{5})\s+([A-ZÀ-Üa-zà-ü][A-Za-zÀ-ü\s\-]+?)(?:\s|$)/);
        if (cityMatch) {
          result.siteCity = cityMatch[2].trim().toUpperCase();
        }
      }
    }
  }

  // 3. OBJET DES TRAVAUX - Chercher "Remplacement", "Installation", "Travaux" etc.
  // D'abord chercher les lignes encadrées (format IDEX avec bordure)
  // Le pattern cherche une ligne isolée commençant par un mot-clé de travaux
  const objetPatterns = [
    // Format IDEX: ligne isolée avec travaux (avant "Travaux réalisés le")
    /\n([Rr]emplacement[^\n]{5,60})\n(?:\s*Travaux\s*réalisés|Référence|MAT|MO)/,
    // Champ "Objet" explicite
    /Objet\s*(?:des\s*travaux)?\s*:?\s*([^\n]+)/i,
    /Nature\s*des\s*travaux\s*:?\s*([^\n]+)/i,
    // Lignes commençant par un numéro puis description de travaux
    /^\s*1\s+((?:Remplacement|Installation|Réparation|Maintenance|Fourniture|Travaux|Mise en place|Création|Modification)[^€\n]{10,80})/im,
    // Format IDEX: "Remplacement ballon ecs en cuisine" (sans préposition obligatoire)
    /((?:Remplacement|Installation|Réparation|Maintenance|Fourniture|Mise en place|Création|Modification)\s+[A-Za-zÀ-ü\s]{5,50})/i,
    // Recherche directe de mots-clés de travaux avec préposition
    /((?:Remplacement|Installation|Réparation|Maintenance|Fourniture|Mise en place|Création|Modification)\s+(?:des?|du|de la|d'un|d'une)\s+[A-Za-zÀ-ü\s]{3,40})/i,
  ];

  for (const pattern of objetPatterns) {
    const match = text.match(pattern);
    if (match) {
      let objet = match[1].trim();
      // Nettoyer - enlever les quantités/prix à la fin et caractères indésirables
      objet = objet.replace(/\s+\d+[\s,\.]*\d*\s*(€|EUR|U\.|Ens|Forf|ML|M2|M3|H)?.*$/i, "").trim();
      objet = objet.replace(/\s{2,}/g, " ").trim(); // Espaces multiples
      // Ignorer si c'est clairement des CGV (contient "génie climatique" sans contexte travaux)
      if (objet.toLowerCase().includes("génie climatique") && !objet.toLowerCase().includes("remplacement")) {
        continue;
      }
      // Couper si trop long (garder la partie principale)
      if (objet.length > 80) {
        const shortened = objet.match(/^(.{20,80}?)(?:\s+(?:avec|et|pour|sur|dans|en)\s|,|\.|$)/);
        if (shortened) objet = shortened[1].trim();
      }
      if (objet.length > 5 && objet.length < 150) {
        result.objet = objet;
        break;
      }
    }
  }

  // 4. MONTANT TOTAL HT
  const parseAmount = (str: string): number => {
    // Nettoyer: espaces insécables, espaces normaux, remplacer virgule par point
    let cleaned = str.replace(/[\s\u00A0\u202F]/g, ""); // Tous types d'espaces
    cleaned = cleaned.replace(",", ".").replace(/€/g, "").replace(/EUR/gi, "");
    return parseFloat(cleaned) || 0;
  };

  // Format IDEX: tableau avec "Total HT" comme en-tête et montant en dessous
  // "Base HT TVA% Montant TVA Total HT Total TVA Total TTC"
  // "1 068,06 20 213,61 1 068,06 213,61 1 281,67 €"
  // Chercher "Total TTC" suivi d'un montant avec €, puis extraire le Total HT (avant-dernier montant)
  const ttcMatch = text.match(/Total\s*TTC[^\d]*([\d\s\u00A0]+[,\.]\d{2})\s*€/i);
  if (ttcMatch) {
    const ttcAmount = parseAmount(ttcMatch[1]);
    // Chercher tous les montants proches du HT attendu (~83% du TTC pour TVA 20%)
    const matches = text.matchAll(/([\d\s\u00A0]+[,\.]\d{2})/g);
    for (const match of matches) {
      const amount = parseAmount(match[1]);
      // Le HT doit être entre 75% et 95% du TTC (TVA entre 5% et 33%)
      if (amount > ttcAmount * 0.75 && amount < ttcAmount * 0.95) {
        result.amountHT = amount;
        break;
      }
    }
  }

  // Fallback: Chercher spécifiquement "Total HT" suivi directement d'un montant
  if (!result.amountHT) {
    const htMatch = text.match(/Total\s*HT\s*:?\s*([\d\s\u00A0]+[,\.]\d{2})\s*(?:€|$)/i);
    if (htMatch) {
      const amount = parseAmount(htMatch[1]);
      if (amount > 10) {
        result.amountHT = amount;
      }
    }
  }

  // Fallback: chercher "Sous-total HT" ou "Montant HT"
  if (!result.amountHT) {
    const fallbackMatch = text.match(/(?:Sous[\s-]?total|Montant)\s*HT\s*:?\s*([\d\s\u00A0]+[,\.]\d{2})/i);
    if (fallbackMatch) {
      const amount = parseAmount(fallbackMatch[1]);
      if (amount > 10) {
        result.amountHT = amount;
      }
    }
  }

  // Dernier recours: chercher ligne "Récapitulatif du devis" et extraire les montants
  if (!result.amountHT) {
    // Format IDEX: après "Récapitulatif du devis", première ligne de données
    const recapMatch = text.match(/Récapitulatif\s*du\s*devis[\s\S]{0,200}?([\d\s\u00A0]+[,\.]\d{2})\s+\d+\s+([\d\s\u00A0]+[,\.]\d{2})\s+([\d\s\u00A0]+[,\.]\d{2})/i);
    if (recapMatch) {
      // Le 3ème montant est "Total HT" dans le tableau IDEX
      const amount = parseAmount(recapMatch[3]);
      if (amount > 10) {
        result.amountHT = amount;
      }
    }
  }

  // Dernier recours absolu: chercher le montant juste avant "€" dans le total
  if (!result.amountHT) {
    const allAmounts: number[] = [];
    const matches = text.matchAll(/([\d]{1,3}[\s\u00A0]?\d{3}[,\.]\d{2})/g);
    for (const match of matches) {
      const amount = parseAmount(match[1]);
      if (amount > 100 && amount < 10000000) {
        allAmounts.push(amount);
      }
    }
    // Trier et prendre le 2ème plus grand (HT < TTC)
    allAmounts.sort((a, b) => b - a);
    if (allAmounts.length >= 2) {
      result.amountHT = allAmounts[1]; // 2ème plus grand = HT
    } else if (allAmounts.length === 1) {
      result.amountHT = allAmounts[0];
    }
  }

  return result;
}

/**
 * Parser complet: PDF buffer -> données structurées
 */
export async function parseQuotePDF(pdfBuffer: Buffer): Promise<ParsedQuote> {
  const text = await extractTextFromPDF(pdfBuffer);
  return parseQuoteFromText(text);
}

/**
 * Normaliser un nom de ville pour la recherche
 */
export function normalizeCity(city: string): string {
  return city
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z\s]/g, "")
    .trim();
}

/**
 * Chercher un site par nom ou ville
 * IMPORTANT: Ne match par ville que si un nom de site a été trouvé dans le PDF
 * pour éviter de matcher le mauvais site (ex: Mairie au lieu de l'école)
 */
// Mots génériques fréquents dans les noms de sites français — exclus du matching
// car "école" ou "mairie" tout seul n'est pas distinctif
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
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);
}

function distinctiveTokens(s: string): string[] {
  return tokenize(s).filter((w) => w.length >= 3 && !GENERIC_SITE_WORDS.has(w));
}

export function findSiteMatch(
  siteName: string | null,
  siteCity: string | null,
  sites: Array<{ id: string; name: string; city: string; address: string }>
): { id: string; name: string } | null {
  if (!siteName && !siteCity) return null;

  const searchDistinctive = siteName ? distinctiveTokens(siteName) : [];
  const normalizedSearchName = siteName ? siteName.toLowerCase().trim() : "";
  const normalizedSearchCity = siteCity ? normalizeCity(siteCity) : "";

  // PREMIÈRE PASSE: Match exact (nom contenant ou contenu dans nom BDD)
  // On garde cette passe car si Gemini renvoie le nom exact d'un site, on veut matcher.
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

  // DEUXIÈME PASSE: Match par tokens distinctifs (exclut mots génériques type "école")
  // Il faut qu'AU MOINS UN TOKEN DISTINCTIF matche (nom propre, numéro, etc.)
  if (searchDistinctive.length > 0) {
    for (const site of sites) {
      const siteDistinctive = new Set(distinctiveTokens(site.name));
      const hasDistinctiveMatch = searchDistinctive.some((t) => siteDistinctive.has(t));
      if (hasDistinctiveMatch) {
        // Si on a aussi la ville, on la confirme
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

  // Pas de match fiable trouvé — on laisse l'utilisateur choisir
  return null;
}
