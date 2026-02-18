import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { DbClient } from "@waybook/db";
import { schema } from "@waybook/db";

type AuthConfig = {
  baseUrl: string;
  secret: string;
};

export const createAuth = (db: DbClient, config: AuthConfig) => {
  return betterAuth({
    baseURL: config.baseUrl,
    secret: config.secret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications
      }
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true
    },
    socialProviders: {}
  });
};

export type WaybookAuth = ReturnType<typeof createAuth>;
