/**
 * Service de parsing PDF pour extraction de devis
 */

import { extractText } from "unpdf";

export interface ParsedQuote {
  reference: string | null;
  provider: string | null;
  client: string | null;
  siteAddress: string | null;
  siteName: string | null;
  siteCity: string | null;
  issueDate: Date | null;
  validUntil: Date | null;
  amountHT: number | null;
  amountTVA: number | null;
  amountTTC: number | null;
  items: ParsedQuoteItem[];
  rawText: string;
}

export interface ParsedQuoteItem {
  lineNumber: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalHT: number;
  tvaRate: number | null;
}

/**
 * Extraire le texte d'un PDF
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // unpdf needs Uint8Array, not Node Buffer
  const uint8Array = new Uint8Array(pdfBuffer);
  const { text } = await extractText(uint8Array, { mergePages: true });
  return text;
}

/**
 * Parser le texte extrait pour trouver les informations du devis
 */
export function parseQuoteFromText(text: string): ParsedQuote {
  const result: ParsedQuote = {
    reference: null,
    provider: null,
    client: null,
    siteAddress: null,
    siteName: null,
    siteCity: null,
    issueDate: null,
    validUntil: null,
    amountHT: null,
    amountTVA: null,
    amountTTC: null,
    items: [],
    rawText: text,
  };

  // Normaliser le texte
  const normalizedText = text.replace(/\s+/g, " ");

  // Extraire la référence du devis
  const refMatch = text.match(/DEVIS\s*N°?\s*([A-Z0-9\-]+)/i) ||
                   text.match(/Devis\s*n°?\s*:?\s*([A-Z0-9\-]+)/i) ||
                   text.match(/N°\s*:?\s*([A-Z0-9\-]+)/i);
  if (refMatch) {
    result.reference = refMatch[1].trim();
  }

  // Extraire le fournisseur (généralement en haut du document)
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length > 0) {
    // Le fournisseur est souvent la première ligne en gras/majuscules
    const firstLines = lines.slice(0, 5).join(" ");
    const providerMatch = firstLines.match(/^([A-Z][A-ZÀ-Ü\s\.\-\&]+)(?:\s|$)/m);
    if (providerMatch && providerMatch[1].length > 3) {
      result.provider = providerMatch[1].trim();
    }
  }

  // Extraire le client (après "Adresse de facturation" ou similaire)
  const clientMatch = normalizedText.match(/(?:Adresse de facturation|Facturer à|Client)\s*:?\s*([A-ZÀ-Ü][A-ZÀ-Ü\s\-]+?)(?:\s+\d|Arcs|Avenue|Rue|Boulevard)/i);
  if (clientMatch) {
    result.client = clientMatch[1].trim();
  }

  // Extraire l'adresse du site/chantier
  const siteMatch = normalizedText.match(/(?:Adresse de Chantier|Site|Lieu d'intervention)\s*:?\s*([^]*?)(?:Adresse de facturation|Descriptif|N°|Description)/i);
  if (siteMatch) {
    const siteInfo = siteMatch[1].trim();
    result.siteName = siteInfo.split(/\d/)[0]?.trim() || null;

    // Extraire la ville du site
    const cityMatch = siteInfo.match(/(\d{5})\s+([A-ZÀ-Ü\-\s]+)/i);
    if (cityMatch) {
      result.siteCity = cityMatch[2].trim().toUpperCase();
      result.siteAddress = siteInfo;
    }
  }

  // Extraire les dates
  const dateMatches = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g) || [];
  const firstDateMatch = dateMatches[0];
  if (firstDateMatch) {
    // Première date = date d'émission
    const parts1 = firstDateMatch.split(/[\/\-]/);
    const d1 = parts1[0] ? Number(parts1[0]) : 0;
    const m1 = parts1[1] ? Number(parts1[1]) : 1;
    const y1 = parts1[2] ? Number(parts1[2]) : 2000;
    result.issueDate = new Date(y1, m1 - 1, d1);

    // Chercher la date de validité
    const validMatch = normalizedText.match(/(?:validité|valide jusqu|expire)\s*:?\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
    if (validMatch) {
      result.validUntil = new Date(Number(validMatch[3]), Number(validMatch[2]) - 1, Number(validMatch[1]));
    } else {
      const secondDateMatch = dateMatches[1];
      if (secondDateMatch) {
        // Deuxième date = validité
        const parts2 = secondDateMatch.split(/[\/\-]/);
        const d2 = parts2[0] ? Number(parts2[0]) : 0;
        const m2 = parts2[1] ? Number(parts2[1]) : 1;
        const y2 = parts2[2] ? Number(parts2[2]) : 2000;
        result.validUntil = new Date(y2, m2 - 1, d2);
      }
    }
  }

  // Extraire les montants
  const htMatch = normalizedText.match(/Total\s*HT\s*:?\s*([\d\s,\.]+)\s*€?/i);
  if (htMatch) {
    result.amountHT = parseFloat(htMatch[1].replace(/\s/g, "").replace(",", "."));
  }

  const tvaMatch = normalizedText.match(/(?:Total\s*)?TVA\s*:?\s*([\d\s,\.]+)\s*€?/i);
  if (tvaMatch) {
    result.amountTVA = parseFloat(tvaMatch[1].replace(/\s/g, "").replace(",", "."));
  }

  const ttcMatch = normalizedText.match(/Total\s*TTC\s*:?\s*([\d\s,\.]+)\s*€?/i) ||
                   normalizedText.match(/Net\s*à\s*payer\s*:?\s*([\d\s,\.]+)\s*€?/i);
  if (ttcMatch) {
    result.amountTTC = parseFloat(ttcMatch[1].replace(/\s/g, "").replace(",", "."));
  }

  // Extraire les lignes de devis (plus complexe, format tableau)
  const itemsSection = text.match(/(?:Description|Désignation)\s*Qté[^]*?((?:\d+\s+.+?\s+[\d,\.]+\s+[\d,\.]+\s*)+)/i);
  if (itemsSection) {
    // Parser les lignes
    const itemLines = itemsSection[1].split("\n").filter(l => l.trim());
    let lineNumber = 1;

    for (const line of itemLines) {
      // Format typique: N° Description Qté Unité P.U. HT Montant HT TVA
      const itemMatch = line.match(/^(\d+)\s+(.+?)\s+([\d,\.]+)\s+(\w+)\s+([\d,\.]+)\s+([\d,\.]+)\s*([\d,\.]*)/);
      if (itemMatch) {
        result.items.push({
          lineNumber: lineNumber++,
          description: itemMatch[2].trim(),
          quantity: parseFloat(itemMatch[3].replace(",", ".")),
          unit: itemMatch[4],
          unitPrice: parseFloat(itemMatch[5].replace(",", ".")),
          totalHT: parseFloat(itemMatch[6].replace(",", ".")),
          tvaRate: itemMatch[7] ? parseFloat(itemMatch[7].replace(",", ".")) : null,
        });
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
    .replace(/[\u0300-\u036f]/g, "") // Supprimer accents
    .replace(/[^A-Z\s]/g, "") // Garder que lettres et espaces
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

    // Match par ville
    if (normalizedSearchCity && normalizedCity.includes(normalizedSearchCity)) {
      return { id: site.id, name: site.name };
    }

    // Match par nom partiel
    if (normalizedSearchName && normalizedName.includes(normalizedSearchName)) {
      return { id: site.id, name: site.name };
    }

    // Match inversé
    if (normalizedSearchCity && normalizedSearchCity.includes(normalizedCity)) {
      return { id: site.id, name: site.name };
    }
  }

  return null;
}
