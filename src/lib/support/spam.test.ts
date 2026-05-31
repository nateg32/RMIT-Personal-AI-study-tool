import { describe, expect, it } from "vitest";
import { supportContentFingerprint, supportSpamSignals } from "@/lib/support/spam";

describe("support spam detection", () => {
  it("creates stable fingerprints for duplicate tickets", () => {
    const ticket = {
      category: "Canvas sync",
      subject: "Canvas sync keeps timing out",
      description: "When I press sync on the dashboard, it fails after a timeout.",
      stepsToReproduce: "Open dashboard, press sync now, wait for the timeout.",
    };

    expect(supportContentFingerprint(ticket)).toBe(
      supportContentFingerprint({
        ...ticket,
        subject: "Canvas   sync keeps timing out",
      }),
    );
  });

  it("flags repetitive or link-heavy reports", () => {
    expect(
      supportSpamSignals({
        category: "Other",
        subject: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        description: "spam ".repeat(40),
      }),
    ).toContain("repeated_characters");

    expect(
      supportSpamSignals({
        category: "Other",
        subject: "Lots of links",
        description: Array.from({ length: 7 }, (_, index) => `https://example.com/${index}`).join(" "),
      }),
    ).toContain("too_many_links");
  });
});
