import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSession } from "@/lib/auth";
import {
  rateLimit,
  getClientIdentifier,
  rateLimitExceeded,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      );
    }

    // Anti-bruteforce : par IP (toutes tentatives) et par compte ciblé
    const ip = getClientIdentifier(request);
    const [byIp, byEmail] = await Promise.all([
      rateLimit(`login:ip:${ip}`, "auth"),
      rateLimit(`login:email:${String(email).toLowerCase().trim()}`, "auth"),
    ]);
    if (!byIp.success || !byEmail.success) {
      return rateLimitExceeded();
    }

    const user = await authenticateUser(email, password);

    if (!user) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    await createSession(user.id, user.role);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organization: user.organization,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la connexion" },
      { status: 500 }
    );
  }
}
