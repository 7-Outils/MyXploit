import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// In-memory fallback for development (when Upstash is not configured)
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();

// Create rate limiter - uses Upstash if configured, otherwise in-memory
function createRateLimiter() {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    // Production: Use Upstash Redis
    const redis = new Redis({
      url: upstashUrl,
      token: upstashToken,
    });

    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
      analytics: true,
    });
  }

  // Development: In-memory rate limiter
  return null;
}

const rateLimiter = createRateLimiter();

// In-memory rate limiting function
function inMemoryRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();
  const record = inMemoryStore.get(identifier);

  if (!record || now > record.resetTime) {
    inMemoryStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  record.count++;
  return { success: true, remaining: limit - record.count };
}

// Configuration for different endpoint types
type RateLimitConfig = {
  requests: number;
  windowMs: number;
};

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  default: { requests: 100, windowMs: 60000 }, // 100 req/min
  import: { requests: 10, windowMs: 60000 }, // 10 req/min for imports
  sync: { requests: 5, windowMs: 60000 }, // 5 req/min for external syncs
  auth: { requests: 10, windowMs: 60000 }, // 10 req/min for auth endpoints
};

export type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS;

/**
 * Rate limit check for API routes
 * @param identifier - Unique identifier (usually IP or user ID)
 * @param type - Type of rate limit to apply
 * @returns Object with success status and remaining requests
 */
export async function rateLimit(
  identifier: string,
  type: RateLimitType = "default"
): Promise<{ success: boolean; remaining: number; limit: number }> {
  const config = RATE_LIMIT_CONFIGS[type] || RATE_LIMIT_CONFIGS.default;

  if (rateLimiter) {
    // Use Upstash
    const result = await rateLimiter.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      limit: result.limit,
    };
  }

  // Use in-memory fallback
  const result = inMemoryRateLimit(identifier, config.requests, config.windowMs);
  return {
    ...result,
    limit: config.requests,
  };
}

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(request: Request): string {
  // Try various headers for the real IP
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  // Fallback
  return "unknown";
}

/**
 * Helper to return 429 response
 */
export function rateLimitExceeded(remaining: number = 0): NextResponse {
  return NextResponse.json(
    { error: "Trop de requêtes. Veuillez réessayer plus tard." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Remaining": remaining.toString(),
        "Retry-After": "60",
      },
    }
  );
}
