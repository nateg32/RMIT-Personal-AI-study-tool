import { describe, expect, it, vi } from "vitest";

describe("secret encryption", () => {
  it("round-trips encrypted data without exposing plain text", async () => {
    vi.stubEnv("ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    vi.resetModules();
    const { encryptSecret, decryptSecret } = await import("@/lib/security/crypto");
    const encrypted = encryptSecret("canvas-token-value");
    expect(encrypted.encrypted).not.toContain("canvas-token-value");
    expect(decryptSecret(encrypted)).toBe("canvas-token-value");
    vi.unstubAllEnvs();
  });

  it("rejects weak encryption keys instead of hashing them silently", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "short-key");
    vi.resetModules();
    const { encryptSecret } = await import("@/lib/security/crypto");
    expect(() => encryptSecret("canvas-token-value")).toThrow(/32 random bytes.*base64/i);
    vi.unstubAllEnvs();
  });
});
