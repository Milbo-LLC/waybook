import { describe, expect, it } from "vitest";
import { app } from "./app";

describe("api health", () => {
  it("responds with ok", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("rejects unauthenticated me", async () => {
    const response = await app.request("/v1/me");
    expect(response.status).toBe(401);
  });
});
