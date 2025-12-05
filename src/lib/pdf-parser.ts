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

  const normalizedText = text.replace(/\s+/g, " ");

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

  // 2. SITE / CHANTIER
  // Chercher "Adresse de Chantier" ou "Site" ou "Lieu"
  const sitePatterns = [
    /Adresse\s*de\s*Chantier\s*:?\s*([^\n]+(?:\n[^\n]+)?)/i,
    /Chantier\s*:?\s*([^\n]+)/i,
    /Site\s*:?\s*([^\n]+)/i,
    /Lieu\s*(?:d['']intervention)?\s*:?\s*([^\n]+)/i,
  ];

  for (const pattern of sitePatterns) {
    const match = text.match(pattern);
    if (match) {
      const siteInfo = match[1].trim();
      // Extraire le nom du site (première partie avant l'adresse)
      // Ex: "Piscine de l'Agora 123 rue..." -> "Piscine de l'Agora"
      const nameMatch = siteInfo.match(/^([A-ZÀ-Ü][A-Za-zÀ-ü\s''-]+?)(?:\s+\d|\s+[Rr]ue|\s+[Aa]venue|\s+[Bb]oulevard|\s+[Pp]lace|$)/);
      if (nameMatch) {
        result.siteName = nameMatch[1].trim();
      } else {
        result.siteName = siteInfo.split(/\d/)[0]?.trim() || siteInfo;
      }

      // Extraire la ville (code postal + ville)
      const cityMatch = siteInfo.match(/(\d{5})\s+([A-ZÀ-Ü][A-Za-zÀ-ü\s\-]+)/i);
      if (cityMatch) {
        result.siteCity = cityMatch[2].trim().toUpperCase();
      }
      break;
    }
  }

  // 3. OBJET DES TRAVAUX
  const objetPatterns = [
    /Objet\s*(?:des\s*travaux)?\s*:?\s*([^\n]+)/i,
    /Descriptif\s*(?:des\s*travaux)?\s*:?\s*([^\n]+)/i,
    /Nature\s*des\s*travaux\s*:?\s*([^\n]+)/i,
    /Intitul[ée]\s*:?\s*([^\n]+)/i,
    /Travaux\s*:?\s*([^\n]+)/i,
  ];

  for (const pattern of objetPatterns) {
    const match = text.match(pattern);
    if (match) {
      const objet = match[1].trim();
      // Nettoyer l'objet (enlever les références de ligne, etc.)
      if (objet.length > 3 && objet.length < 200) {
        result.objet = objet;
        break;
      }
    }
  }

  // Fallback: chercher dans les premières lignes de description
  if (!result.objet) {
    // Chercher après "Description" ou dans la section des lignes
    const descMatch = normalizedText.match(/(?:Description|Désignation)[^]*?(\d+\s+([A-ZÀ-Ü][A-Za-zÀ-ü\s''\-]+?)(?:\s+\d|U\.|Ens\.|Forf))/i);
    if (descMatch && descMatch[2]) {
      result.objet = descMatch[2].trim();
    }
  }

  // 4. MONTANT TOTAL HT
  const parseAmount = (str: string): number => {
    const cleaned = str.replace(/\s/g, "").replace(",", ".").replace(/€/g, "");
    return parseFloat(cleaned) || 0;
  };

  const htPatterns = [
    /Total\s*HT\s*:?\s*([\d\s,\.]+)/i,
    /Montant\s*HT\s*:?\s*([\d\s,\.]+)/i,
    /TOTAL\s*HORS\s*TAXE[S]?\s*:?\s*([\d\s,\.]+)/i,
    /Sous[\s\-]?total\s*HT\s*:?\s*([\d\s,\.]+)/i,
    /HT\s*:?\s*([\d\s,\.]+)\s*€/i,
  ];

  for (const pattern of htPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount > 0) {
        result.amountHT = amount;
        break;
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
