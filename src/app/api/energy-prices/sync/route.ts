import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * Sync endpoint to automatically fetch and update energy prices
 * This endpoint can be called:
 * 1. Manually via the UI
 * 2. By a cron job (Vercel Cron, external scheduler, etc.)
 * 3. On a schedule using Vercel's cron feature
 */
export async function POST(request: NextRequest) {
  try {
    // Check for cron secret or require auth
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (authHeader !== `Bearer ${cronSecret}`) {
      // If not from cron, require user auth
      const user = await requireAuth();
      if (user.role === "READER") {
        return NextResponse.json(
          { error: "Vous n'avez pas les droits pour synchroniser les prix" },
          { status: 403 }
        );
      }
    }

    const results = {
      updated: [] as string[],
      failed: [] as string[],
      errors: [] as string[],
    };

    // 1. Fetch CEE price from EMMY
    try {
      const ceePrice = await fetchCEEPrice();
      await prisma.energyPrice.create({
        data: {
          type: "CEE",
          value: ceePrice.value,
          date: ceePrice.date,
          source: ceePrice.source || "EMMY (automatique)",
          notes: ceePrice.notes || "Mis à jour automatiquement",
        },
      });
      results.updated.push("CEE");
    } catch (error) {
      console.error("Error fetching CEE price:", error);
      results.failed.push("CEE");
      results.errors.push(`CEE: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    // 2. Fetch PEG price
    try {
      const pegPrice = await fetchPEGPrice();
      await prisma.energyPrice.create({
        data: {
          type: "PEG",
          value: pegPrice.value,
          date: pegPrice.date,
          source: pegPrice.source || "JeChange.fr (automatique)",
          notes: pegPrice.notes || "Mis à jour automatiquement",
        },
      });
      results.updated.push("PEG");
    } catch (error) {
      console.error("Error fetching PEG price:", error);
      results.failed.push("PEG");
      results.errors.push(`PEG: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    // 3. Update TICGN if needed (check if current period's value exists)
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12

      // TICGN changes on February 1st each year
      // Before Feb 1: use previous year's rate
      // After Feb 1: use current year's rate
      const isBeforeFeb1 = currentMonth === 1;

      // Check if we already have a price for the current period
      const periodStart = isBeforeFeb1
        ? new Date(`${currentYear}-01-01`)
        : new Date(`${currentYear}-02-01`);

      const existingTICGN = await prisma.energyPrice.findFirst({
        where: {
          type: "TICGN",
          date: {
            gte: periodStart,
          },
        },
        orderBy: { date: "desc" },
      });

      if (!existingTICGN) {
        // TICGN values by period
        // Format: { year: { beforeFeb: value, afterFeb: value } }
        const ticgnSchedule: Record<number, { current: number; next?: number }> = {
          2024: { current: 16.37 },
          2025: { current: 16.37, next: 15.43 }, // Changed to 15.43 on Aug 1, 2025
          2026: { current: 15.43, next: 19.83 }, // Will change to 19.83 on Feb 1, 2026
        };

        const yearSchedule = ticgnSchedule[currentYear];
        if (yearSchedule) {
          const value = isBeforeFeb1 ? yearSchedule.current : (yearSchedule.next || yearSchedule.current);
          const effectiveDate = isBeforeFeb1
            ? new Date(`${currentYear}-01-01`)
            : new Date(`${currentYear}-02-01`);

          await prisma.energyPrice.create({
            data: {
              type: "TICGN",
              value,
              date: effectiveDate,
              source: "Gouvernement (automatique)",
              notes: `Tarif en vigueur ${isBeforeFeb1 ? 'jusqu\'au 31 janvier' : 'à partir du 1er février'} ${currentYear}`,
            },
          });
          results.updated.push("TICGN");
        }
      }
    } catch (error) {
      console.error("Error updating TICGN:", error);
      results.failed.push("TICGN");
      results.errors.push(`TICGN: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    return NextResponse.json({
      success: true,
      message: "Synchronisation des prix terminée",
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error syncing energy prices:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la synchronisation des prix",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch CEE price from EMMY public data
 * https://www.emmy.fr/public/donnees-mensuelles
 */
async function fetchCEEPrice(): Promise<{ value: number; date: Date; source?: string; notes?: string }> {
  try {
    // EMMY provides monthly data in a specific format
    // We'll try to fetch the latest available price
    const response = await fetch("https://www.emmy.fr/public/donnees-mensuelles", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MyXploit/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`EMMY API returned ${response.status}`);
    }

    const html = await response.text();

    // Parse HTML to extract latest CEE price
    // EMMY shows prices in a table format
    // Pattern: look for prix moyen or prix spot
    const priceMatch = html.match(/prix.*?(\d+[,.]?\d*)\s*€\/MWh/i);
    const dateMatch = html.match(/(\d{2})\/(\d{2})\/(\d{4})/);

    if (priceMatch && dateMatch) {
      const value = parseFloat(priceMatch[1].replace(",", "."));
      const [, day, month, year] = dateMatch;
      const date = new Date(`${year}-${month}-${day}`);

      return { value, date };
    }

    // Fallback: use a reasonable default if parsing fails
    console.warn("Could not parse EMMY data, using fallback");
    return {
      value: 8.49,
      date: new Date(),
      source: "Estimation (scraping échoué)",
      notes: "Valeur de fallback - vérifier manuellement",
    };
  } catch (error) {
    console.error("Error fetching CEE from EMMY:", error);
    // Return fallback even on error
    return {
      value: 8.49,
      date: new Date(),
      source: "Estimation (erreur réseau)",
      notes: "Valeur de fallback - vérifier manuellement",
    };
  }
}

/**
 * Fetch PEG price from JeChange.fr or similar source
 */
async function fetchPEGPrice(): Promise<{ value: number; date: Date; source?: string; notes?: string }> {
  try {
    // JeChange.fr provides gas prices in their articles/pages
    const response = await fetch("https://www.jechange.fr/energie/gaz/guides/prix-peg", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MyXploit/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`JeChange returned ${response.status}`);
    }

    const html = await response.text();

    // Parse HTML to extract PEG price
    // Pattern: look for prix or PEG followed by a number
    const priceMatch = html.match(/PEG.*?(\d+[,.]?\d*)\s*€\/MWh/i) ||
                      html.match(/(\d+[,.]?\d*)\s*€\/MWh/i);

    if (priceMatch) {
      const value = parseFloat(priceMatch[1].replace(",", "."));
      return {
        value,
        date: new Date(),
      };
    }

    // Fallback: use a reasonable default if parsing fails
    console.warn("Could not parse PEG data, using fallback");
    return {
      value: 27.0,
      date: new Date(),
      source: "Estimation (scraping échoué)",
      notes: "Valeur de fallback - vérifier manuellement",
    };
  } catch (error) {
    console.error("Error fetching PEG from JeChange:", error);
    // Return fallback even on error
    return {
      value: 27.0,
      date: new Date(),
      source: "Estimation (erreur réseau)",
      notes: "Valeur de fallback - vérifier manuellement",
    };
  }
}
