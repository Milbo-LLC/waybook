import { Hono } from "hono";
import { auth } from "../lib/auth.js";
import type { AppBindings } from "../types.js";

export const authRoutes = new Hono<AppBindings>();

authRoutes.all("/auth/*", async (c) => {
  return (auth as any).handler(c.req.raw);
});
