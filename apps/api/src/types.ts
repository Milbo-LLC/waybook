import type { WaybookAuth } from "@waybook/auth";
import type { DbClient } from "@waybook/db";
import type { Redis } from "ioredis";

type RequestUser = {
  id: string;
  email: string | null;
};

export type AppBindings = {
  Variables: {
    user: RequestUser;
    db: DbClient;
    auth: WaybookAuth;
    redis: Redis;
  };
};
