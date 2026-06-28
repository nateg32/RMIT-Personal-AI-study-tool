import { describe, expect, it, vi } from "vitest";

describe("API responses", () => {
  it("masks server errors in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { jsonError } = await import("@/lib/api");

    const response = jsonError(new Error("database password secret-token-value-12345"), 500);
    await expect(response.json()).resolves.toEqual({ error: "Unexpected error" });
    vi.unstubAllEnvs();
  });

  it("redacts token-shaped values in non-production errors", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.resetModules();
    const { jsonError } = await import("@/lib/api");

    const response = jsonError(new Error("Canvas failed with 9595~abcdefghijklmnopqrstuvwxyz"), 400);
    await expect(response.json()).resolves.toEqual({ error: "Canvas failed with [redacted]" });
    vi.unstubAllEnvs();
  });
});
