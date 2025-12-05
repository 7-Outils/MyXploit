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

  // 2. SITE / CHANTIER - Arrêter à "Adresse de facturation" ou mots-clés similaires
  const siteMatch = text.match(/Adresse\s*de\s*Chantier\s*:?\s*([\s\S]*?)(?:Adresse\s*de\s*facturation|ADRESSE\s*DE\s*FACTURATION|Facturer\s*[àa]|Client|Description|Descriptif|N°\s*Description|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);

  if (siteMatch) {
    const siteInfo = siteMatch[1].trim();
    const lines = siteInfo.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length > 0) {
      // Première ligne = nom du site
      result.siteName = lines[0];

      // Chercher la ville (code postal + nom)
      for (const line of lines) {
        const cityMatch = line.match(/(\d{5})\s+([A-ZÀ-Üa-zà-ü\s\-]+)/);
        if (cityMatch) {
          result.siteCity = cityMatch[2].trim().toUpperCase();
          break;
        }
      }
    }
  }

  // 3. OBJET DES TRAVAUX - Chercher "Remplacement", "Installation", "Travaux" etc.
  // Pattern pour lignes de devis typiques: "1 Remplacement des pompes..."
  const objetPatterns = [
    // Lignes commençant par un numéro puis description de travaux
    /^\s*1\s+((?:Remplacement|Installation|Réparation|Maintenance|Fourniture|Travaux|Mise en place|Création|Modification)[^€\n]{10,80})/im,
    // Champ "Objet" explicite
    /Objet\s*(?:des\s*travaux)?\s*:?\s*([^\n]+)/i,
    /Nature\s*des\s*travaux\s*:?\s*([^\n]+)/i,
  ];

  for (const pattern of objetPatterns) {
    const match = text.match(pattern);
    if (match) {
      let objet = match[1].trim();
      // Nettoyer - enlever les quantités/prix à la fin
      objet = objet.replace(/\s+\d+[\s,\.]*\d*\s*(€|EUR|U\.|Ens|Forf|ML|M2|M3|H)?.*$/i, "").trim();
      if (objet.length > 5 && objet.length < 150) {
        result.objet = objet;
        break;
      }
    }
  }

  // 4. MONTANT TOTAL HT
  const parseAmount = (str: string): number => {
    // Nettoyer: espaces, remplacer virgule par point
    const cleaned = str.replace(/\s/g, "").replace(",", ".").replace(/€/g, "").replace(/EUR/gi, "");
    return parseFloat(cleaned) || 0;
  };

  // Patterns pour montant HT - chercher les plus gros montants
  const htPatterns = [
    /Total\s*HT\s*:?\s*([\d\s]+[,\.]\d{2})/i,
    /Montant\s*HT\s*:?\s*([\d\s]+[,\.]\d{2})/i,
    /TOTAL\s*HORS\s*TAXE[S]?\s*:?\s*([\d\s]+[,\.]\d{2})/i,
    /Total\s*HT\s*([\d\s]+[,\.]\d{2})\s*€?/i,
    /HT\s*:?\s*([\d\s]+[,\.]\d{2})\s*€/i,
  ];

  for (const pattern of htPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount > 100) { // Montant minimum raisonnable
        result.amountHT = amount;
        break;
      }
    }
  }

  // Fallback: chercher un pattern plus large pour les montants
  if (!result.amountHT) {
    // Chercher "57 551,00" ou "57551.00" format
    const amountMatch = text.match(/Total\s*HT[\s\S]{0,30}?([\d]{1,3}(?:[\s\.]?\d{3})*[,\.]\d{2})/i);
    if (amountMatch) {
      const amount = parseAmount(amountMatch[1]);
      if (amount > 100) {
        result.amountHT = amount;
      }
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
