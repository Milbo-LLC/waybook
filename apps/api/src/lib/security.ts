import { createHash, randomBytes } from "node:crypto";
import { customAlphabet } from "nanoid";

const slugAlphabet = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 10);

export const createShareToken = () => randomBytes(24).toString("base64url");

export const hashToken = (token: string) => {
  return createHash("sha256").update(token).digest("hex");
};

export const createPublicSlug = () => slugAlphabet();
