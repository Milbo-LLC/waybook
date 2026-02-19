import { cors } from "hono/cors";
import { Hono } from "hono";
import { auth } from "./lib/auth.js";
import { db } from "./lib/db.js";
import { env } from "./lib/env.js";
import { redis } from "./lib/redis.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { authRoutes } from "./routes/auth.js";
import { entryRoutes } from "./routes/entries.js";
import { meRoutes } from "./routes/me.js";
import { mediaRoutes } from "./routes/media.js";
import { waybookRoutes } from "./routes/waybooks.js";
import type { AppBindings } from "./types.js";

export const app = new Hono<AppBindings>();

const allowedCorsOrigins = new Set([env.CORS_ORIGIN, ...env.AUTH_TRUSTED_ORIGINS]);

app.use("*", cors({
  origin: (origin) => {
    if (!origin) return env.CORS_ORIGIN;
    return allowedCorsOrigins.has(origin) ? origin : "";
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"]
}));

app.use("/v1/*", rateLimitMiddleware);

app.use("*", async (c, next) => {
  c.set("db", db);
  c.set("auth", auth);
  c.set("redis", redis);
  await next();
});

app.get("/health", (c) => c.json({ ok: true }));

app.route("/v1", authRoutes);
app.route("/v1", meRoutes);
app.route("/v1", waybookRoutes);
app.route("/v1", entryRoutes);
app.route("/v1", mediaRoutes);

app.notFound((c) => c.json({ error: "not_found" }, 404));
