import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../types.js";
import { env } from "../lib/env.js";

const hits = new Map<string, { count: number; resetAt: number }>();

export const rateLimitMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;

  const current = hits.get(ip);
  if (!current || current.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + windowMs });
  } else {
    current.count += 1;
    hits.set(ip, current);

    if (current.count > env.RATE_LIMIT_MAX) {
      return c.json(
        {
          error: "rate_limit_exceeded",
          message: "Too many requests"
        },
        429
      );
    }
  }

  await next();
};
