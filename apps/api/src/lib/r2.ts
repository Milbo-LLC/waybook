import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env.js";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY
  }
});

export const createUploadUrl = async ({
  key,
  contentType,
  expiresIn
}: {
  key: string;
  contentType: string;
  expiresIn?: number;
}) => {
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    ContentType: contentType
  });

  const ttl = expiresIn ?? env.R2_SIGNED_URL_TTL_SECONDS;
  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: ttl });

  return {
    uploadUrl,
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
  };
};

export const toPublicMediaUrl = (key: string | null): string | null => {
  if (!key) return null;
  const base = env.R2_PUBLIC_BASE_URL.replace(/\/$/, "");
  return `${base}/${key}`;
};
