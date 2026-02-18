import { Queue } from "bullmq";
import { env } from "./env.js";
import { redis } from "./redis.js";

export const MEDIA_PROCESSING_QUEUE = "media-processing";

export type MediaProcessingJobData = {
  mediaId: string;
};

export const mediaProcessingQueue =
  env.NODE_ENV === "test"
    ? ({
        add: async () => ({ id: "test-job" })
      } as unknown as Queue<MediaProcessingJobData>)
    : new Queue<MediaProcessingJobData>(MEDIA_PROCESSING_QUEUE, {
        connection: redis,
        defaultJobOptions: {
          attempts: 5,
          removeOnComplete: 100,
          removeOnFail: 200,
          backoff: {
            type: "exponential",
            delay: 1000
          }
        }
      });
