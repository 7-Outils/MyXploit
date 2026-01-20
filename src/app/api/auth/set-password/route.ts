import { NextRequest, NextResponse } from "next/server";
import {
  verifyInvitationToken,
  activateUserAccount,
  createSession,
} from "@/lib/auth";

// GET - Verify invitation token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token manquant" },
        { status: 400 }
      );
    }

    const user = await verifyInvitationToken(token);

    if (!user) {
      return NextResponse.json(
        { error: "Token invalide ou expiré" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification" },
      { status: 500 }
    );
  }
}

// POST - Set password and activate account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token et mot de passe requis" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 8 caractères" },
        { status: 400 }
      );
    }

    const user = await verifyInvitationToken(token);

    if (!user) {
      return NextResponse.json(
        { error: "Token invalide ou expiré" },
        { status: 400 }
      );
    }

    // Activate account
    const activatedUser = await activateUserAccount(user.id, password);

    // Create session
    await createSession(activatedUser.id);

    return NextResponse.json({
      success: true,
      user: {
        id: activatedUser.id,
        email: activatedUser.email,
        firstName: activatedUser.firstName,
        lastName: activatedUser.lastName,
        role: activatedUser.role,
      },
    });
  } catch (error) {
    console.error("Set password error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'activation du compte" },
      { status: 500 }
    );
  }
}
