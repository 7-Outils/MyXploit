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
    rawText: text,
  };

  // 1. RÉFÉRENCE DU DEVIS
  const refPatterns = [
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

  // 2. SITE / CHANTIER - Arrêter à "Adresse de facturation"
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
    const cityMatch = siteInfo.match(/(\d{5})\s+([A-ZÀ-Üa-zà-ü][A-Za-zÀ-ü\s\-]+?)(?:\s|$)/);
    if (cityMatch) {
      result.siteCity = cityMatch[2].trim().toUpperCase();
    }
  }

  // 3. OBJET DES TRAVAUX - Chercher "Remplacement", "Installation", "Travaux" etc.
  const objetPatterns = [
    // Champ "Objet" explicite
    /Objet\s*(?:des\s*travaux)?\s*:?\s*([^\n]+)/i,
    /Nature\s*des\s*travaux\s*:?\s*([^\n]+)/i,
    // Lignes commençant par un numéro puis description de travaux
    /^\s*1\s+((?:Remplacement|Installation|Réparation|Maintenance|Fourniture|Travaux|Mise en place|Création|Modification)[^€\n]{10,80})/im,
    // Recherche directe de mots-clés de travaux (sans numéro)
    /((?:Remplacement|Installation|Réparation|Maintenance|Fourniture|Mise en place|Création|Modification)\s+(?:des?|du|de la|d')\s+[A-Za-zÀ-ü\s]+)/i,
  ];

  for (const pattern of objetPatterns) {
    const match = text.match(pattern);
    if (match) {
      let objet = match[1].trim();
      // Nettoyer - enlever les quantités/prix à la fin et caractères indésirables
      objet = objet.replace(/\s+\d+[\s,\.]*\d*\s*(€|EUR|U\.|Ens|Forf|ML|M2|M3|H)?.*$/i, "").trim();
      objet = objet.replace(/\s{2,}/g, " ").trim(); // Espaces multiples
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

  // Chercher spécifiquement "Total HT" suivi d'un montant (pas TTC!)
  // Format possible: "Total HT 57 551,00" ou "Total HT : 57551.00 €"
  const htMatch = text.match(/Total\s*HT\s*:?\s*([\d\s\u00A0]+[,\.]\d{2})/i);
  if (htMatch) {
    const amount = parseAmount(htMatch[1]);
    if (amount > 100) {
      result.amountHT = amount;
    }
  }

  // Fallback: chercher "Sous-total HT" ou "Montant HT"
  if (!result.amountHT) {
    const fallbackMatch = text.match(/(?:Sous[\s-]?total|Montant)\s*HT\s*:?\s*([\d\s\u00A0]+[,\.]\d{2})/i);
    if (fallbackMatch) {
      const amount = parseAmount(fallbackMatch[1]);
      if (amount > 100) {
        result.amountHT = amount;
      }
    }
  }

  // Dernier recours: chercher tous les montants et prendre le 2ème plus grand (HT < TTC)
  if (!result.amountHT) {
    const allAmounts: number[] = [];
    const matches = text.matchAll(/([\d]{1,3}[\s\u00A0]?\d{3}[,\.]\d{2})/g);
    for (const match of matches) {
      const amount = parseAmount(match[1]);
      if (amount > 100 && amount < 10000000) {
        allAmounts.push(amount);
      }
    }
    // Trier et prendre le 2ème (HT) au lieu du 1er (TTC)
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
 */
export function findSiteMatch(
  siteName: string | null,
  siteCity: string | null,
  sites: Array<{ id: string; name: string; city: string; address: string }>
): { id: string; name: string } | null {
  if (!siteName && !siteCity) return null;

  const normalizedSearchCity = siteCity ? normalizeCity(siteCity) : "";
  const normalizedSearchName = siteName ? siteName.toLowerCase() : "";

  for (const site of sites) {
    const normalizedCity = normalizeCity(site.city);
    const normalizedName = site.name.toLowerCase();

    // Match par nom partiel (priorité)
    if (normalizedSearchName && normalizedName.includes(normalizedSearchName)) {
      return { id: site.id, name: site.name };
    }
    if (normalizedSearchName && normalizedSearchName.includes(normalizedName)) {
      return { id: site.id, name: site.name };
    }

    // Match par ville
    if (normalizedSearchCity && normalizedCity.includes(normalizedSearchCity)) {
      return { id: site.id, name: site.name };
    }
    if (normalizedSearchCity && normalizedSearchCity.includes(normalizedCity)) {
      return { id: site.id, name: site.name };
    }
  }

  return null;
}
