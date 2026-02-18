import { redis } from "./redis.js";

export const claimIdempotencyKey = async (scope: string, key: string): Promise<boolean> => {
  const redisKey = `idem:${scope}:${key}`;
  const result = await redis.set(redisKey, "1", "EX", 60 * 15, "NX");
  return result === "OK";
};
