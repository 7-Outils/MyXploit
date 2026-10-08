import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface GeocodePlace {
  id: number;
  name: string;
  department: string | null;
  postcode: string | null;
  lat: number;
  lon: number;
}

/**
 * GET /api/heating/geocode?q=Lyon
 * Recherche de communes françaises (nom ou code postal) via le géocodage
 * Open-Meteo, même fournisseur que la météo, gratuit et sans clé.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return NextResponse.json({ places: [] });

    const url =
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}` +
      `&count=8&language=fr&countryCode=FR&format=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json({ error: "Recherche de ville indisponible" }, { status: 502 });
    const json = await res.json();

    const places: GeocodePlace[] = (json?.results ?? []).map(
      (r: { id: number; name: string; admin2?: string; postcodes?: string[]; latitude: number; longitude: number }) => ({
        id: r.id,
        name: r.name,
        department: r.admin2 ?? null,
        postcode: r.postcodes?.find((p) => /^\d{5}$/.test(p)) ?? null,
        lat: r.latitude,
        lon: r.longitude,
      })
    );
    return NextResponse.json({ places });
  } catch (error) {
    console.error("Error geocoding city:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
