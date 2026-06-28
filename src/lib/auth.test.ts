import { describe, expect, it, vi } from "vitest";

describe("auth defaults", () => {
  it("requires explicit demo mode when Supabase is not configured", async () => {
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.resetModules();

    const { getCurrentUser } = await import("@/lib/auth");
    await expect(getCurrentUser()).rejects.toThrow(/DEMO_MODE=true/);
    vi.unstubAllEnvs();
  });

  it("returns a neutral demo user when local demo mode is enabled", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.resetModules();

    const { getCurrentUser } = await import("@/lib/auth");
    await expect(getCurrentUser()).resolves.toMatchObject({
      id: "demo-user",
      name: "Demo Student",
      email: "student@example.com",
    });
    vi.unstubAllEnvs();
  });
});
