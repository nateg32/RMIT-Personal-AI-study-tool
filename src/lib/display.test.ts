import { describe, expect, it } from "vitest";
import { firstDisplayName, personalGreeting, timeOfDayGreeting } from "@/lib/display";

describe("display helpers", () => {
  it("does not expose student-number style names", () => {
    expect(firstDisplayName("s1234567")).toBe("there");
    expect(firstDisplayName("Avery Student")).toBe("Avery");
  });

  it("uses the requested timezone for day-part greetings", () => {
    const date = new Date("2026-05-29T03:00:00.000Z");
    expect(timeOfDayGreeting("Australia/Sydney", date)).toBe("Good afternoon");
    expect(personalGreeting("Avery Student", "Australia/Sydney", date)).toBe("Good afternoon, Avery");
  });
});
