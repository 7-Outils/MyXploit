/**
 * GRDF ADICT API Service — v6
 * Conforme au Swagger GRDF_ADICT_BAS_V6 et à la collection Postman BAS v1.4
 *
 * Environnements :
 *   - BAS (Bac à Sable) : basePath = /adict/bas/v6, scope = /adict/bas/v6
 *   - Production         : basePath = /adict/v6,     scope = /adict/v6
 */

// ─── Configuration ───────────────────────────────────────────────────────────

export type GRDFEnvironment = "sandbox" | "production";

const GRDF_TOKEN_URL =
  "https://adict-connexion.grdf.fr/oauth2/aus5y2ta2uEHjCWIR417/v1/token";
const GRDF_API_HOST = "https://api.grdf.fr";

const ENV_CONFIG: Record<GRDFEnvironment, { basePath: string; scope: string }> = {
  sandbox: {
    basePath: "/adict/bas/v6",
    scope: "/adict/bas/v6",
  },
  production: {
    basePath: "/adict/v6",
    scope: "/adict/v6",
  },
};

export interface GRDFConfig {
  clientId: string;
  clientSecret: string;
  environment?: GRDFEnvironment;
}

// ─── Types réponse ───────────────────────────────────────────────────────────

export interface GRDFTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/** Ligne NDJSON de consommation (publiée ou informative) */
export interface GRDFConsommation {
  id_pce: string;
  date_debut_consommation: string;
  date_fin_consommation: string;
  consommation: number;
  energie: number;
  index_debut: number | null;
  index_fin: number | null;
  journee_gaziere: string | null;
  type_qualif_conso: string;
  frequence_releve: string;
  statut_restitution?: string;
  code_statut_restitution?: string;
}

/** Données contractuelles d'un PCE */
export interface GRDFDonneesContractuelles {
  id_pce: string;
  etat_contractuel: string;
  date_derniere_modification: string;
  adresse: {
    numero_voie: string;
    nom_voie: string;
    code_postal: string;
    commune: string;
  };
  cja?: {
    num_contrat: string;
    date_debut: string;
    date_fin: string;
  };
  car?: number;
}

/** Données techniques d'un PCE */
export interface GRDFDonneesTechniques {
  id_pce: string;
  compteur: {
    matricule: string;
    type_compteur: string;
    calibre: string;
  };
  profil: string;
  frequence_releve: string;
}

/** Droit d'accès */
export interface GRDFDroitAcces {
  id_droit_acces: string;
  id_pce: string;
  etat_droit_acces: string;
  role_tiers: string;
  raison_sociale: string;
  date_debut_droit_acces: string;
  date_fin_droit_acces: string;
  perim_donnees_conso_debut: string;
  perim_donnees_conso_fin: string;
  perim_donnees_contractuelles: string;
  perim_donnees_techniques: string;
  perim_donnees_informatives: string;
  perim_donnees_publiees: string;
}

// ─── Parsing NDJSON ──────────────────────────────────────────────────────────

/**
 * Parse une réponse NDJSON (application/x-ndjson) en tableau d'objets.
 * Chaque ligne est un JSON indépendant séparé par un saut de ligne.
 */
function parseNDJSON<T>(text: string): T[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEnvConfig(env: GRDFEnvironment = "production") {
  return ENV_CONFIG[env];
}

function buildApiUrl(env: GRDFEnvironment, path: string): string {
  const { basePath } = getEnvConfig(env);
  return `${GRDF_API_HOST}${basePath}${path}`;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Obtenir un access_token via OAuth2 client_credentials
 */
export async function getGRDFAccessToken(
  config: GRDFConfig
): Promise<GRDFTokenResponse> {
  const { clientId, clientSecret, environment = "production" } = config;
  const { scope } = getEnvConfig(environment);

  const response = await fetch(GRDF_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      errorDetail = parsed.errorSummary || parsed.error_description || errorText;
    } catch {
      // Keep raw text
    }
    throw new Error(`Erreur authentification GRDF: ${errorDetail}`);
  }

  return response.json();
}

// ─── Consommations ───────────────────────────────────────────────────────────

/**
 * Consulter les consommations publiées d'un PCE (NDJSON)
 */
export async function getGRDFConsosPubliees(
  pce: string,
  accessToken: string,
  options: { dateDebut?: string; dateFin?: string; periode?: string } = {},
  environment: GRDFEnvironment = "production"
): Promise<GRDFConsommation[]> {
  const params = new URLSearchParams();
  if (options.periode) {
    params.set("periode", options.periode);
  } else {
    if (options.dateDebut) params.set("date_debut", options.dateDebut);
    if (options.dateFin) params.set("date_fin", options.dateFin);
  }

  const url = buildApiUrl(environment, `/pce/${pce}/donnees_consos_publiees?${params}`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/x-ndjson",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GRDF Consos Publiées (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  return parseNDJSON<GRDFConsommation>(text);
}

/**
 * Consulter les consommations informatives d'un PCE (NDJSON)
 */
export async function getGRDFConsosInformatives(
  pce: string,
  accessToken: string,
  options: { dateDebut?: string; dateFin?: string; periode?: string } = {},
  environment: GRDFEnvironment = "production"
): Promise<GRDFConsommation[]> {
  const params = new URLSearchParams();
  if (options.periode) {
    params.set("periode", options.periode);
  } else {
    if (options.dateDebut) params.set("date_debut", options.dateDebut);
    if (options.dateFin) params.set("date_fin", options.dateFin);
  }

  const url = buildApiUrl(environment, `/pce/${pce}/donnees_consos_informatives?${params}`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/x-ndjson",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GRDF Consos Informatives (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  return parseNDJSON<GRDFConsommation>(text);
}

// ─── Données contractuelles & techniques ─────────────────────────────────────

/**
 * Consulter les données contractuelles d'un PCE
 */
export async function getGRDFDonneesContractuelles(
  pce: string,
  accessToken: string,
  environment: GRDFEnvironment = "production"
): Promise<GRDFDonneesContractuelles> {
  const url = buildApiUrl(environment, `/pce/${pce}/donnees_contractuelles`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GRDF Données Contractuelles (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Consulter les données techniques d'un PCE
 */
export async function getGRDFDonneesTechniques(
  pce: string,
  accessToken: string,
  environment: GRDFEnvironment = "production"
): Promise<GRDFDonneesTechniques> {
  const url = buildApiUrl(environment, `/pce/${pce}/donnees_techniques`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GRDF Données Techniques (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ─── Droits d'accès ──────────────────────────────────────────────────────────

/**
 * Consulter tous les droits d'accès (NDJSON)
 */
export async function getGRDFDroitsAcces(
  accessToken: string,
  environment: GRDFEnvironment = "production"
): Promise<GRDFDroitAcces[]> {
  const url = buildApiUrl(environment, "/droits_acces");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/x-ndjson",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GRDF Droits d'accès (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  return parseNDJSON<GRDFDroitAcces>(text);
}

/**
 * Déclarer un droit d'accès sur un PCE
 */
export async function declareGRDFDroitAcces(
  pce: string,
  accessToken: string,
  droitAcces: {
    role_tiers: string;
    raison_sociale: string;
    nom_titulaire: string;
    code_postal: string;
    courriel_titulaire: string;
    numero_telephone_mobile_titulaire: string;
    date_debut_droit_acces: string;
    date_fin_droit_acces: string;
    perim_donnees_conso_debut: string;
    perim_donnees_conso_fin: string;
    perim_donnees_contractuelles: string;
    perim_donnees_techniques: string;
    perim_donnees_informatives: string;
    perim_donnees_publiees: string;
  },
  environment: GRDFEnvironment = "production"
): Promise<GRDFDroitAcces> {
  const url = buildApiUrl(environment, `/pce/${pce}/droit_acces`);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(droitAcces),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GRDF Déclaration Droit d'accès (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ─── Helpers haut niveau ─────────────────────────────────────────────────────

/**
 * Tester la connexion GRDF avec les credentials
 */
export async function testGRDFConnection(config: GRDFConfig): Promise<{
  success: boolean;
  error?: string;
  expiresAt?: Date;
}> {
  try {
    const tokenResponse = await getGRDFAccessToken(config);
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

    return { success: true, expiresAt };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur de connexion GRDF",
    };
  }
}

/**
 * Synchroniser les consommations publiées d'un PCE
 */
export async function syncGRDFConsumptions(
  pce: string,
  config: GRDFConfig,
  options: { dateDebut?: string; dateFin?: string } = {}
): Promise<GRDFConsommation[]> {
  const env = config.environment || "production";
  const tokenResponse = await getGRDFAccessToken(config);

  const dateFin = options.dateFin || new Date().toISOString().split("T")[0];
  const dateDebut = options.dateDebut || (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split("T")[0];
  })();

  return getGRDFConsosPubliees(
    pce,
    tokenResponse.access_token,
    { dateDebut, dateFin },
    env
  );
}
