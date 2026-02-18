import { createAuth } from "@waybook/auth";
import { db } from "./db";
import { env } from "./env";

export const auth = createAuth(db, {
  baseUrl: env.BETTER_AUTH_URL,
  basePath: env.BETTER_AUTH_BASE_PATH,
  secret: env.AUTH_SECRET,
  googleClientId: env.GOOGLE_CLIENT_ID,
  googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  trustedOrigins: env.AUTH_TRUSTED_ORIGINS
});
