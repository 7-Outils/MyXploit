/**
 * Geocoding utilities using API Adresse data.gouv.fr (free, France only)
 */

interface GeocodingResult {
  latitude: number;
  longitude: number;
  label: string;
  score: number;
}

interface AddresseGeoJSONResponse {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "Point";
      coordinates: [number, number]; // [longitude, latitude]
    };
    properties: {
      label: string;
      score: number;
      housenumber?: string;
      street?: string;
      postcode?: string;
      city?: string;
    };
  }>;
}

/**
 * Geocode an address using API Adresse data.gouv.fr
 * @param address Street address
 * @param city City name
 * @param postalCode Postal code
 * @returns Coordinates or null if not found
 */
export async function geocodeAddress(
  address: string,
  city: string,
  postalCode: string
): Promise<GeocodingResult | null> {
  try {
    // Build query string
    const queryParts = [address, postalCode, city].filter(Boolean);
    const query = queryParts.join(" ");

    if (!query.trim()) {
      return null;
    }

    const url = new URL("https://api-adresse.data.gouv.fr/search/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "1");

    // Add postcode for better precision if available
    if (postalCode) {
      url.searchParams.set("postcode", postalCode);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status}`);
      return null;
    }

    const data: AddresseGeoJSONResponse = await response.json();

    if (data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    const [longitude, latitude] = feature.geometry.coordinates;

    return {
      latitude,
      longitude,
      label: feature.properties.label,
      score: feature.properties.score,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Batch geocode multiple addresses
 * @param addresses Array of address objects
 * @returns Map of index to coordinates
 */
export async function batchGeocode(
  addresses: Array<{ address: string; city: string; postalCode: string }>
): Promise<Map<number, GeocodingResult>> {
  const results = new Map<number, GeocodingResult>();

  // Process in batches to avoid rate limiting
  const BATCH_SIZE = 5;
  const DELAY_MS = 200;

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);

    const promises = batch.map((addr, batchIndex) =>
      geocodeAddress(addr.address, addr.city, addr.postalCode)
        .then((result) => ({ index: i + batchIndex, result }))
    );

    const batchResults = await Promise.all(promises);

    for (const { index, result } of batchResults) {
      if (result) {
        results.set(index, result);
      }
    }

    // Wait between batches to avoid rate limiting
    if (i + BATCH_SIZE < addresses.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  return results;
}
