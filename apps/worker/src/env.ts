import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workerRoot = resolve(__dirname, "..");
const repoRoot = resolve(workerRoot, "..", "..");

loadEnv({ path: resolve(repoRoot, ".env") });
loadEnv({ path: resolve(repoRoot, ".env.local"), override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  MEDIA_PROCESSING_QUEUE: z.string().default("media-processing")
});

export const env = envSchema.parse(process.env);
