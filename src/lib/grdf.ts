/**
 * GRDF ADICT API Service
 * Documentation: https://sites.grdf.fr/web/portail-api-grdf-adict
 *
 * API pour récupérer les données de consommation gaz via télérelève
 */

// Types de données disponibles
export type GRDFDataType =
  | "informatives"      // Données informatives du PCE
  | "consommations"     // Consommations (journalières, mensuelles)
  | "donnees_techniques"; // Données techniques du compteur

export interface GRDFConfig {
  clientId: string;
  clientSecret: string;
  apiUrl?: string;
}

export interface GRDFTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface GRDFConsommation {
  dateDebutConsommation: string;
  dateFinConsommation: string;
  energieConsommee: number; // kWh ou m³
  unite: string;
  statut: string;
}

export interface GRDFPCEInfo {
  pce: string;
  adresse: {
    numeroVoie: string;
    nomVoie: string;
    codePostal: string;
    commune: string;
  };
  etatContractuel: string;
}

const DEFAULT_API_URL = "https://api.grdf.fr";

/**
 * Obtenir un token d'accès OAuth2 (client_credentials)
 */
export async function getGRDFAccessToken(config: GRDFConfig): Promise<GRDFTokenResponse> {
  const { clientId, clientSecret, apiUrl = DEFAULT_API_URL } = config;

  const tokenUrl = `${apiUrl}/oauth2/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "adict", // Scope pour les données individuelles de consommation
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GRDF Auth Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Récupérer les informations d'un PCE
 */
export async function getGRDFPCEInfo(
  pce: string,
  accessToken: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<GRDFPCEInfo> {
  const response = await fetch(`${apiUrl}/adict/v1/pce/${pce}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GRDF PCE Info Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Récupérer les consommations journalières d'un PCE
 */
export async function getGRDFDailyConsumptions(
  pce: string,
  dateDebut: string, // Format: YYYY-MM-DD
  dateFin: string,   // Format: YYYY-MM-DD
  accessToken: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<GRDFConsommation[]> {
  const params = new URLSearchParams({
    date_debut: dateDebut,
    date_fin: dateFin,
  });

  const response = await fetch(
    `${apiUrl}/adict/v1/pce/${pce}/consommations/journalieres?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GRDF Daily Consumption Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.consommations || [];
}

/**
 * Récupérer les consommations mensuelles d'un PCE
 */
export async function getGRDFMonthlyConsumptions(
  pce: string,
  dateDebut: string, // Format: YYYY-MM-DD
  dateFin: string,   // Format: YYYY-MM-DD
  accessToken: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<GRDFConsommation[]> {
  const params = new URLSearchParams({
    date_debut: dateDebut,
    date_fin: dateFin,
  });

  const response = await fetch(
    `${apiUrl}/adict/v1/pce/${pce}/consommations/mensuelles?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GRDF Monthly Consumption Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.consommations || [];
}

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

    // Calculer la date d'expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

    return {
      success: true,
      expiresAt,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur de connexion GRDF",
    };
  }
}

/**
 * Synchroniser les consommations GRDF pour un PCE
 */
export async function syncGRDFConsumptions(
  pce: string,
  config: GRDFConfig,
  options: {
    startDate?: string;
    endDate?: string;
    type?: "daily" | "monthly";
  } = {}
): Promise<GRDFConsommation[]> {
  // Obtenir un token
  const tokenResponse = await getGRDFAccessToken(config);

  // Dates par défaut: 1 an en arrière
  const endDate = options.endDate || new Date().toISOString().split("T")[0];
  const startDate = options.startDate || (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split("T")[0];
  })();

  // Récupérer les données
  if (options.type === "daily") {
    return getGRDFDailyConsumptions(pce, startDate, endDate, tokenResponse.access_token);
  }

  return getGRDFMonthlyConsumptions(pce, startDate, endDate, tokenResponse.access_token);
}
