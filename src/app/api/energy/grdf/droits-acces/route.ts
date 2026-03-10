import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import {
  getGRDFDroitsAcces,
  declareGRDFDroitAcces,
} from "@/lib/grdf";
import { getGRDFProviderAndToken } from "@/lib/grdf-helpers";

// GET /api/energy/grdf/droits-acces — Consulter tous les droits d'accès
export async function GET() {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    const grdf = await getGRDFProviderAndToken(effectiveOrgId);
    if (!grdf) {
      return NextResponse.json(
        { error: "GRDF non connecté" },
        { status: 400 }
      );
    }

    const droits = await getGRDFDroitsAcces(grdf.accessToken, grdf.environment);

    return NextResponse.json({
      droits,
      total: droits.length,
      actifs: droits.filter((d) => d.etat_droit_acces === "Active").length,
    });
  } catch (error) {
    console.error("Error fetching GRDF droits d'accès:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des droits d'accès" },
      { status: 500 }
    );
  }
}

// POST /api/energy/grdf/droits-acces — Déclarer un droit d'accès sur un PCE
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour déclarer un droit d'accès" },
        { status: 403 }
      );
    }

    const grdf = await getGRDFProviderAndToken(effectiveOrgId);
    if (!grdf) {
      return NextResponse.json(
        { error: "GRDF non connecté" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { pce, ...droitAccesData } = body;

    if (!pce) {
      return NextResponse.json(
        { error: "Le numéro de PCE est requis" },
        { status: 400 }
      );
    }

    // Validate PCE format: 14 digits or GI + 6 digits
    const pcePattern = /^(GI\d{6}|\d{14})$/;
    if (!pcePattern.test(pce)) {
      return NextResponse.json(
        { error: "Format PCE invalide (14 chiffres ou GI + 6 chiffres)" },
        { status: 400 }
      );
    }

    const requiredFields = [
      "role_tiers",
      "raison_sociale",
      "nom_titulaire",
      "code_postal",
      "courriel_titulaire",
      "date_debut_droit_acces",
      "date_fin_droit_acces",
      "perim_donnees_conso_debut",
      "perim_donnees_conso_fin",
    ];

    const missing = requiredFields.filter((f) => !droitAccesData[f]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Champs manquants : ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const payload = {
      role_tiers: droitAccesData.role_tiers,
      raison_sociale: droitAccesData.raison_sociale,
      nom_titulaire: droitAccesData.nom_titulaire,
      code_postal: droitAccesData.code_postal,
      courriel_titulaire: droitAccesData.courriel_titulaire,
      numero_telephone_mobile_titulaire: droitAccesData.numero_telephone_mobile_titulaire || "",
      date_debut_droit_acces: droitAccesData.date_debut_droit_acces,
      date_fin_droit_acces: droitAccesData.date_fin_droit_acces,
      perim_donnees_conso_debut: droitAccesData.perim_donnees_conso_debut,
      perim_donnees_conso_fin: droitAccesData.perim_donnees_conso_fin,
      perim_donnees_contractuelles: droitAccesData.perim_donnees_contractuelles || "Vrai",
      perim_donnees_techniques: droitAccesData.perim_donnees_techniques || "Vrai",
      perim_donnees_informatives: droitAccesData.perim_donnees_informatives || "Vrai",
      perim_donnees_publiees: droitAccesData.perim_donnees_publiees || "Vrai",
    };

    const result = await declareGRDFDroitAcces(
      pce,
      grdf.accessToken,
      payload,
      grdf.environment
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error declaring GRDF droit d'accès:", error);
    const message = error instanceof Error ? error.message : "Erreur lors de la déclaration du droit d'accès";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
