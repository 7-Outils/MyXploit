import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "myxploit_session";

// Routes publiques (accessibles sans connexion)
const publicRoutes = [
  "/",
  "/sign-in",
  "/set-password",
  "/api/auth/login",
  "/api/auth/set-password",
];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/uploadthing") ||
    pathname.includes(".") // Static files
  ) {
    return NextResponse.next();
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    // No session, redirect to sign-in
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Verify JWT token using jose (Edge-compatible)
  try {
    if (!process.env.JWT_SECRET) {
      console.error("FATAL: JWT_SECRET not defined in middleware");
      throw new Error("JWT_SECRET not configured");
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(sessionCookie.value, secret);
    return NextResponse.next();
  } catch (error) {
    // Invalid session, redirect to sign-in
    console.error("JWT verification failed:", error);
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(signInUrl);
    // Clear invalid cookie
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
