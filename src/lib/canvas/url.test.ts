import { describe, expect, it } from "vitest";
import {
  canvasAllowedHostsFrom,
  normaliseCanvasBaseUrl,
  resolveCanvasApiUrl,
} from "@/lib/canvas/url";

describe("Canvas URL validation", () => {
  it("accepts configured Canvas hosts and normalises them to origins", () => {
    const allowedHosts = canvasAllowedHostsFrom("canvas.example.edu, https://study.example.edu/path");

    expect(normaliseCanvasBaseUrl("https://canvas.example.edu", { allowedHosts })).toBe(
      "https://canvas.example.edu",
    );
    expect(normaliseCanvasBaseUrl("https://study.example.edu", { allowedHosts })).toBe(
      "https://study.example.edu",
    );
  });

  it("rejects base URLs with paths, credentials, query strings, or fragments", () => {
    expect(() => normaliseCanvasBaseUrl("https://rmit.instructure.com/courses")).toThrow(/origin/i);
    expect(() => normaliseCanvasBaseUrl("https://token@rmit.instructure.com")).toThrow(/credentials/i);
    expect(() => normaliseCanvasBaseUrl("https://rmit.instructure.com?token=value")).toThrow(/origin/i);
    expect(() => normaliseCanvasBaseUrl("https://rmit.instructure.com#token")).toThrow(/origin/i);
  });

  it("keeps Canvas pagination on the same origin", () => {
    expect(
      resolveCanvasApiUrl(
        "https://rmit.instructure.com/api/v1/courses?page=2",
        "https://rmit.instructure.com",
      ),
    ).toBe("https://rmit.instructure.com/api/v1/courses?page=2");

    expect(() =>
      resolveCanvasApiUrl("https://evil.example/api/v1/courses?page=2", "https://rmit.instructure.com"),
    ).toThrow(/off-origin/i);
  });
});
