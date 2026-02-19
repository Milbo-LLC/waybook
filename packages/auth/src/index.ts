import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { DbClient } from "@waybook/db";
import { schema } from "@waybook/db";

type AuthConfig = {
  baseUrl: string;
  basePath: string;
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
  trustedOrigins: string[];
};

export const createAuth = (db: DbClient, config: AuthConfig) => {
  return betterAuth({
    baseURL: config.baseUrl,
    basePath: config.basePath,
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    advanced: {
      database: {
        generateId: () => randomUUID()
      }
    },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications
      }
    }),
    account: {
      // Persist OAuth state in DB to avoid cross-origin cookie state mismatches in hosted environments.
      storeStateStrategy: "database"
    },
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret
      }
    }
  });
};

export type WaybookAuth = ReturnType<typeof createAuth>;
