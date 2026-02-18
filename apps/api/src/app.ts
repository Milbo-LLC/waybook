import { cors } from "hono/cors";
import { Hono } from "hono";
import { auth } from "./lib/auth";
import { db } from "./lib/db";
import { env } from "./lib/env";
import { redis } from "./lib/redis";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { authRoutes } from "./routes/auth";
import { entryRoutes } from "./routes/entries";
import { meRoutes } from "./routes/me";
import { mediaRoutes } from "./routes/media";
import { waybookRoutes } from "./routes/waybooks";
import type { AppBindings } from "./types";

export const app = new Hono<AppBindings>();

app.use("*", cors({
  origin: env.CORS_ORIGIN,
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
