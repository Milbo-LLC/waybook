import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../types";

const getDevHeaderUser = (header: string | undefined) => {
  if (!header) return null;
  const parts = header.split(":");
  if (parts.length === 2) {
    return { id: parts[0] ?? "", email: parts[1] ?? null };
  }
  return { id: header, email: null };
};

export const optionalAuthMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const devUser = getDevHeaderUser(c.req.header("x-waybook-user"));
  if (devUser) {
    c.set("user", devUser);
    await next();
    return;
  }

  try {
    const auth = c.get("auth");
    // Better Auth session extraction; if unavailable, request proceeds as anonymous.
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
