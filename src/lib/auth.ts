import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import prisma from "./prisma";
import crypto from "crypto";

// CRITICAL: JWT_SECRET must be defined in environment variables
const SESSION_COOKIE_NAME = "myxploit_session";

// Lazy initialization of JWT_SECRET - validates on first use
let JWT_SECRET: Uint8Array | null = null;

function getJWTSecret(): Uint8Array {
  if (JWT_SECRET) return JWT_SECRET;

  const JWT_SECRET_STRING = process.env.JWT_SECRET;

  if (!JWT_SECRET_STRING) {
    throw new Error(
      "FATAL ERROR: JWT_SECRET environment variable is not defined!\n" +
      "Generate a secure secret with: openssl rand -base64 32\n" +
      "Then add it to your .env file: JWT_SECRET=your_generated_secret"
    );
  }

  JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING);
  return JWT_SECRET;
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Token utilities
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function generateSessionToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(getJWTSecret());
}

export async function verifySessionToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

// Session management
export async function createSession(userId: string) {
  const token = await generateSessionToken(userId);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });

  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  const payload = await verifySessionToken(sessionCookie.value);
  return payload?.userId || null;
}

// User utilities
export async function getCurrentUser() {
  const userId = await getSessionUserId();

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });

  // Only return user if they have a password set (account activated)
  if (!user?.password) {
    return null;
  }

  return user;
}

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

// Authentication
export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { organization: true },
  });

  if (!user || !user.password) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password);

  if (!isValid) {
    return null;
  }

  return user;
}

// Invitation
export function generateInvitationData() {
  const token = generateInvitationToken();
  const expires = new Date();
  expires.setDate(expires.getDate() + 7); // 7 days
  return { token, expires };
}

export async function createInvitationToken(userId: string) {
  const { token, expires } = generateInvitationData();

  await prisma.user.update({
    where: { id: userId },
    data: {
      invitationToken: token,
      invitationExpires: expires,
    },
  });

  return token;
}

export async function verifyInvitationToken(token: string) {
  const user = await prisma.user.findUnique({
    where: { invitationToken: token },
    include: { organization: true },
  });

  if (!user) {
    return null;
  }

  if (user.invitationExpires && user.invitationExpires < new Date()) {
    return null; // Token expired
  }

  return user;
}

export async function activateUserAccount(
  userId: string,
  password: string
) {
  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      invitationToken: null,
      invitationExpires: null,
    },
    include: { organization: true },
  });

  return user;
}

// Ghost mode utilities
export async function getGhostSession(userId: string) {
  const ghostSession = await prisma.ghostSession.findFirst({
    where: {
      superAdminId: userId,
      expiresAt: { gt: new Date() },
    },
    include: {
      targetOrganization: true,
    },
  });

  return ghostSession;
}

/**
 * Retourne l'ID de l'organisation effective
 * Si en mode fantôme, retourne l'org cible, sinon l'org de l'user
 */
export async function getEffectiveOrganizationId(userId: string, userOrgId: string): Promise<string> {
  const ghostSession = await getGhostSession(userId);
  return ghostSession?.targetOrganizationId || userOrgId;
}

/**
 * Retourne l'utilisateur avec son contexte (incluant mode fantôme)
 */
export async function getCurrentUserWithContext() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const ghostSession = await getGhostSession(user.id);
  const effectiveOrganizationId = ghostSession?.targetOrganizationId || user.organizationId;

  return {
    ...user,
    effectiveOrganizationId,
    isGhostMode: !!ghostSession,
    ghostOrgId: ghostSession?.targetOrganizationId || null,
    ghostOrgName: ghostSession?.targetOrganization?.name || null,
  };
}
