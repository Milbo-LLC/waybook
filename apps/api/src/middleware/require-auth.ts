import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../types";

export const optionalAuthMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  try {
    const auth = c.get("auth");
    const session = await (auth as any).api.getSession({ headers: c.req.raw.headers });
    if (session?.user?.id) {
      c.set("user", {
        id: session.user.id,
        email: session.user.email ?? null
      });
    }
  } catch {
    // No-op for anonymous requests.
  }

  await next();
};

export const requireAuthMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  await optionalAuthMiddleware(c, async () => undefined);

  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "unauthorized", message: "Authentication required" }, 401);
  }

  await next();
};
