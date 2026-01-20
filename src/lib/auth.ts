import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import prisma from "./prisma";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const SESSION_COOKIE_NAME = "myxploit_session";

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

export function generateSessionToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifySessionToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

// Session management
export async function createSession(userId: string) {
  const token = generateSessionToken(userId);
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

  const payload = verifySessionToken(sessionCookie.value);
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
