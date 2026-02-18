import { serve } from "@hono/node-server";
import { app } from "./app";
import { env } from "./lib/env";

serve({
  fetch: app.fetch,
  port: env.PORT
});

console.log(`waybook-api listening on http://localhost:${env.PORT}`);
