import { describe, expect, it } from "vitest";
import { getUrgency, isSubmitted } from "@/lib/prioritization";
import type { CanvasAssignmentSummary } from "@/lib/types";

const base: CanvasAssignmentSummary = {
  id: "a1",
  canvasAssignmentId: 1,
  courseName: "Cloud Foundations",
  name: "Milestone",
};

describe("prioritization", () => {
  it("marks submitted work as low risk", () => {
    expect(isSubmitted({ ...base, submittedAt: new Date().toISOString() })).toBe(true);
    expect(getUrgency({ ...base, workflowState: "submitted" }).label).toBe("low");
  });

  it("marks unsubmitted work due within 24 hours as critical", () => {
    const dueAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    expect(getUrgency({ ...base, dueAt, workflowState: "unsubmitted" }).label).toBe("critical");
  });
});
