import { describe, expect, it } from "vitest";
import { sanitizeCanvasHtml, stripCanvasHtml } from "@/lib/security/html";

describe("Canvas HTML sanitization", () => {
  it("removes scripts and unsafe link schemes while preserving useful markup", () => {
    const html = sanitizeCanvasHtml(
      '<p>Hello <strong>student</strong></p><script>alert(1)</script><a href="javascript:alert(1)">bad</a>',
    );

    expect(html).toContain("<strong>student</strong>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("strips Canvas HTML for model and database summaries", () => {
    expect(stripCanvasHtml("<p>Read&nbsp;<em>Week 2</em></p>")).toBe("Read Week 2");
  });
});
