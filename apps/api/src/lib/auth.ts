import { createAuth } from "@waybook/auth";
import { db } from "./db";
import { env } from "./env";

export const auth = createAuth(db, {
  baseUrl: env.BETTER_AUTH_URL,
  secret: env.AUTH_SECRET
});
