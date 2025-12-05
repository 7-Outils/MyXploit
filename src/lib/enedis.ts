/**
 * Enedis SGE API Service
 * Documentation: https://datahub-enedis.fr/
 *
 * API pour récupérer les données de consommation électrique via télérelève
 * Flux OAuth2 authorization_code avec consentement utilisateur
 */

export interface EnedisConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiUrl?: string;
  authUrl?: string;
}

export interface EnedisTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
  usage_points_id?: string; // PDL associé au consentement
}

export interface EnedisConsommation {
  date: string;
  value: number; // Wh
}

export interface EnedisMeteringData {
  usage_point_id: string;
  start: string;
  end: string;
  quality: string;
  reading_type: {
    measurement_kind: string;
    unit: string;
    aggregate: string;
  };
  interval_reading: EnedisConsommation[];
}

const DEFAULT_API_URL = "https://gw.prd.api.enedis.fr";
const DEFAULT_AUTH_URL = "https://mon-compte-particulier.enedis.fr";

/**
 * Générer l'URL d'autorisation OAuth2 Enedis
 */
export function getEnedisAuthorizationUrl(
  config: EnedisConfig,
  state: string,
  duration: string = "P6M" // 6 mois par défaut
): string {
  const { clientId, redirectUri, authUrl = DEFAULT_AUTH_URL } = config;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state: state,
    duration: duration, // Durée du consentement (ISO 8601)
  });

  return `${authUrl}/dataconnect/v1/oauth2/authorize?${params}`;
}

/**
 * Échanger le code d'autorisation contre un token d'accès
 */
export async function exchangeEnedisCodeForToken(
  code: string,
  config: EnedisConfig
): Promise<EnedisTokenResponse> {
  const { clientId, clientSecret, redirectUri, apiUrl = DEFAULT_API_URL } = config;

  const response = await fetch(`${apiUrl}/oauth2/v3/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Enedis Token Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Rafraîchir un token d'accès expiré
 */
export async function refreshEnedisToken(
  refreshToken: string,
  config: EnedisConfig
): Promise<EnedisTokenResponse> {
  const { clientId, clientSecret, apiUrl = DEFAULT_API_URL } = config;

  const response = await fetch(`${apiUrl}/oauth2/v3/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Enedis Refresh Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Récupérer les consommations journalières d'un PDL
 */
export async function getEnedisDailyConsumptions(
  pdl: string,
  dateDebut: string, // Format: YYYY-MM-DD
  dateFin: string,   // Format: YYYY-MM-DD
  accessToken: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<EnedisMeteringData> {
  const params = new URLSearchParams({
    start: dateDebut,
    end: dateFin,
    usage_point_id: pdl,
  });

  const response = await fetch(
    `${apiUrl}/metering_data_dc/v5/daily_consumption?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Enedis Daily Consumption Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.meter_reading;
}

/**
 * Récupérer les consommations horaires d'un PDL (si disponible)
 */
export async function getEnedisLoadCurve(
  pdl: string,
  dateDebut: string,
  dateFin: string,
  accessToken: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<EnedisMeteringData> {
  const params = new URLSearchParams({
    start: dateDebut,
    end: dateFin,
    usage_point_id: pdl,
  });

  const response = await fetch(
    `${apiUrl}/metering_data_clc/v5/consumption_load_curve?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Enedis Load Curve Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.meter_reading;
}

/**
 * Récupérer les informations du PDL
 */
export async function getEnedisPDLInfo(
  pdl: string,
  accessToken: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<{
  usage_point_id: string;
  usage_point_status: string;
  meter_type: string;
}> {
  const params = new URLSearchParams({
    usage_point_id: pdl,
  });

  const response = await fetch(
    `${apiUrl}/customers_upc/v5/usage_points/contracts?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Enedis PDL Info Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.customer?.usage_points?.[0] || null;
}

/**
 * Agréger les données journalières en données mensuelles
 */
export function aggregateToMonthly(
  dailyData: EnedisConsommation[]
): Array<{ month: string; value: number }> {
  const monthly: Record<string, number> = {};

  for (const day of dailyData) {
    const month = day.date.substring(0, 7); // YYYY-MM
    monthly[month] = (monthly[month] || 0) + day.value;
  }

  return Object.entries(monthly).map(([month, value]) => ({
    month: month + "-01", // First day of month
    value,
  }));
}

/**
 * Convertir Wh en kWh
 */
export function whToKwh(wh: number): number {
  return wh / 1000;
}
