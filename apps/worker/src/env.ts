import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  MEDIA_PROCESSING_QUEUE: z.string().default("media-processing")
});

export const env = envSchema.parse(process.env);
