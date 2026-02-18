import { Hono } from "hono";
import { requireAuthMiddleware } from "../middleware/require-auth.js";
import type { AppBindings } from "../types.js";

export const meRoutes = new Hono<AppBindings>();

meRoutes.get("/me", requireAuthMiddleware, async (c) => {
  const user = c.get("user");
  return c.json({ userId: user.id, email: user.email });
});
