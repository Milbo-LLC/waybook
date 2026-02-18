import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiRoot = resolve(__dirname, "..", "..");
const repoRoot = resolve(apiRoot, "..", "..");

loadEnv({ path: resolve(repoRoot, ".env") });
loadEnv({ path: resolve(repoRoot, ".env.local"), override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().url().default("postgres://postgres:postgres@localhost:5433/waybook"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  AUTH_SECRET: z.string().min(16).default("dev-only-auth-secret-please-change"),
  GOOGLE_CLIENT_ID: z.string().min(1).default("local-google-client-id"),
  GOOGLE_CLIENT_SECRET: z.string().min(1).default("local-google-client-secret"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:8787"),
  BETTER_AUTH_BASE_PATH: z.string().default("/v1/auth"),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  AUTH_TRUSTED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    ),
  R2_ACCOUNT_ID: z.string().min(1).default("local-account"),
  R2_ACCESS_KEY_ID: z.string().min(1).default("local-access-key"),
  R2_SECRET_ACCESS_KEY: z.string().min(1).default("local-secret-key"),
  R2_BUCKET: z.string().min(1).default("waybook-dev"),
  R2_PUBLIC_BASE_URL: z.string().url().default("https://media.example.com"),
  R2_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  API_BASE_URL: z.string().url().default("http://localhost:8787"),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120)
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
