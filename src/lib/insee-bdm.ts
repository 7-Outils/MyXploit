/**
 * API publique Insee BDM (Banque de données macro-économiques).
 *
 * Aucune clé, aucune authentification :
 *   GET https://api.insee.fr/series/BDM/V1/data/SERIES_BDM/<id1>+<id2>?startPeriod=YYYY-MM
 *   Accept: application/xml  → SDMX StructureSpecificData
 *
 * Réponse utile :
 *   <Series IDBANK="001710973" FREQ="M" TITLE_FR="…" LAST_UPDATE="2026-08-14" …>
 *     <Obs TIME_PERIOD="2026-06" OBS_VALUE="133.0" OBS_QUAL="DEF" DATE_JO="2026-08-15"/>
 *   </Series>
 *
 * Le parsing est fait à la regex (pas de dépendance XML) : le format est plat,
 * les attributs sont tous entre guillemets doubles et l'ordre n'est pas supposé.
 */

const BDM_BASE = "https://api.insee.fr/series/BDM/V1/data/SERIES_BDM";
const TIMEOUT_MS = 15_000;
/** L'Insee plafonne une requête groupée à 400 séries. */
const MAX_SERIES_PER_REQUEST = 400;

export class InseeBdmError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "InseeBdmError";
  }
}

export interface BdmObservation {
  /** Mois de l'observation, normalisé « YYYY-MM ». */
  period: string;
  value: number;
  /** OBS_QUAL ≠ "DEF" → valeur provisoire / révisable. */
  provisional: boolean;
  /** Date de publication au Journal officiel, si fournie (« YYYY-MM-DD »). */
  dateJo: string | null;
}

export interface BdmSeries {
  idBank: string;
  titleFr: string | null;
  /** Périodicité Insee : M, T, A… */
  freq: string | null;
  /** Dernière mise à jour de la série (« YYYY-MM-DD »). */
  lastUpdate: string | null;
  /** Observations triées par période croissante. */
  observations: BdmObservation[];
}

// ------------------------------------------------------------------
// Parsing
// ------------------------------------------------------------------

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXml(value: string): string {
  return value
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
      String.fromCodePoint(parseInt(code, 16))
    );
}

/** Attributs d'une balise, indépendamment de leur ordre. */
function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const re = /([A-Za-z_][\w.-]*)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag)) !== null) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
}

/**
 * Normalise un TIME_PERIOD SDMX en « YYYY-MM ».
 * Mensuel « 2026-06 » tel quel ; trimestriel « 2026-Q2 » → premier mois du
 * trimestre ; annuel « 2026 » → janvier. Tout le reste est ignoré.
 */
function normalizePeriod(timePeriod: string): string | null {
  const monthly = /^(\d{4})-(\d{2})$/.exec(timePeriod);
  if (monthly) {
    const month = Number(monthly[2]);
    if (month < 1 || month > 12) return null;
    return `${monthly[1]}-${monthly[2]}`;
  }

  const quarterly = /^(\d{4})-Q([1-4])$/.exec(timePeriod);
  if (quarterly) {
    const firstMonth = (Number(quarterly[2]) - 1) * 3 + 1;
    return `${quarterly[1]}-${String(firstMonth).padStart(2, "0")}`;
  }

  const semester = /^(\d{4})-S([12])$/.exec(timePeriod);
  if (semester) {
    const firstMonth = (Number(semester[2]) - 1) * 6 + 1;
    return `${semester[1]}-${String(firstMonth).padStart(2, "0")}`;
  }

  const annual = /^(\d{4})$/.exec(timePeriod);
  if (annual) return `${annual[1]}-01`;

  return null;
}

/** Extrait les séries d'une réponse SDMX. Exporté pour les tests. */
export function parseBdmXml(xml: string): BdmSeries[] {
  // <Series …>…</Series> ou <Series …/> (série sans observation)
  const seriesRe = /<Series\b([^>]*?)(\/>|>([\s\S]*?)<\/Series\s*>)/g;
  const series: BdmSeries[] = [];

  let match: RegExpExecArray | null;
  while ((match = seriesRe.exec(xml)) !== null) {
    const attributes = parseAttributes(match[1]);
    const idBank = attributes.IDBANK;
    if (!idBank) continue;

    const body = match[3] ?? "";
    const observations: BdmObservation[] = [];

    const obsRe = /<Obs\b([^>]*?)\/?>/g;
    let obsMatch: RegExpExecArray | null;
    while ((obsMatch = obsRe.exec(body)) !== null) {
      const obs = parseAttributes(obsMatch[1]);
      const period = obs.TIME_PERIOD ? normalizePeriod(obs.TIME_PERIOD) : null;
      if (!period) continue;

      // OBS_VALUE absent ou non numérique = donnée non disponible → ignorée.
      const raw = obs.OBS_VALUE;
      if (raw === undefined || raw === "") continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;

      observations.push({
        period,
        value,
        provisional: obs.OBS_QUAL !== "DEF",
        dateJo: obs.DATE_JO || null,
      });
    }

    observations.sort((a, b) => a.period.localeCompare(b.period));

    series.push({
      idBank,
      titleFr: attributes.TITLE_FR || null,
      freq: attributes.FREQ || null,
      lastUpdate: attributes.LAST_UPDATE || null,
      observations,
    });
  }

  return series;
}

/** Message d'erreur SDMX (<com:Text>…</com:Text>), si présent. */
function parseErrorMessage(xml: string): string | null {
  const match = /<(?:\w+:)?Text\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Text\s*>/.exec(xml);
  return match ? decodeXml(match[1]).trim() || null : null;
}

// ------------------------------------------------------------------
// Appel
// ------------------------------------------------------------------

/**
 * Récupère une ou plusieurs séries BDM par idBank.
 *
 * Les séries introuvables sont simplement absentes du résultat : c'est à
 * l'appelant de comparer avec `idBanks` pour signaler les identifiants
 * inconnus. Les requêtes de plus de 400 séries sont découpées.
 */
export async function fetchBdmSeries(
  idBanks: string[],
  opts?: { startPeriod?: string }
): Promise<BdmSeries[]> {
  const unique = Array.from(
    new Set(idBanks.map((id) => id.trim()).filter(Boolean))
  );
  if (unique.length === 0) return [];

  for (const id of unique) {
    if (!/^[A-Za-z0-9_]+$/.test(id)) {
      throw new InseeBdmError(`Identifiant Insee invalide : « ${id} »`);
    }
  }

  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += MAX_SERIES_PER_REQUEST) {
    batches.push(unique.slice(i, i + MAX_SERIES_PER_REQUEST));
  }

  const results: BdmSeries[] = [];
  for (const batch of batches) {
    results.push(...(await fetchBatch(batch, opts?.startPeriod)));
  }
  return results;
}

async function fetchBatch(
  idBanks: string[],
  startPeriod?: string
): Promise<BdmSeries[]> {
  const url = new URL(`${BDM_BASE}/${idBanks.join("+")}`);
  if (startPeriod) url.searchParams.set("startPeriod", startPeriod);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/xml" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new InseeBdmError(
        "L'API Insee n'a pas répondu dans les 15 secondes"
      );
    }
    throw new InseeBdmError("Impossible de joindre l'API Insee");
  }

  const body = await response.text();

  // 404 = aucune des séries demandées n'existe : ce n'est pas une panne,
  // l'appelant signalera chaque identifiant comme inconnu.
  if (response.status === 404) return [];

  if (!response.ok) {
    const detail = parseErrorMessage(body);
    throw new InseeBdmError(
      detail
        ? `API Insee (${response.status}) : ${detail}`
        : `API Insee : réponse ${response.status}`,
      response.status
    );
  }

  return parseBdmXml(body);
}
