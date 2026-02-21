import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY
  }
});

export const getObjectBuffer = async (key: string) => {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key
    })
  );

  if (!response.Body) {
    throw new Error(`missing object body: ${key}`);
  }

  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
};

export const putObjectBuffer = async ({
  key,
  body,
  contentType
}: {
  key: string;
  body: Buffer;
  contentType: string;
}) => {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
};
