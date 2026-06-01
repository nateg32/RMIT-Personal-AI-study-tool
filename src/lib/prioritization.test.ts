import { describe, expect, it } from "vitest";
import { getAssignmentType, getUrgency, isSubmitted, sortByPriority, withPrioritySignals } from "@/lib/prioritization";
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
    expect(isSubmitted({ ...base, workflowState: "submitted_elsewhere" })).toBe(true);
    expect(getUrgency({ ...base, workflowState: "submitted_elsewhere" }).label).toBe("low");
    expect(isSubmitted({ ...base, workflowState: "unsubmitted", score: 4, grade: "4 / 5" })).toBe(true);
    expect(getUrgency({ ...base, workflowState: "unsubmitted", dueAt: "2026-05-31T13:59:00.000Z", score: 5 }).label).toBe("low");
  });

  it("marks unsubmitted work due within 24 hours as critical", () => {
    const dueAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    expect(getUrgency({ ...base, dueAt, workflowState: "unsubmitted" }).label).toBe("critical");
  });

  it("identifies Canvas quizzes from submission types", () => {
    expect(getAssignmentType({ ...base, name: "Week 12", submissionTypes: ["online_quiz"] })).toBe("quiz");
  });

  it("sorts missing and soonest unsubmitted work ahead of submitted work", () => {
    const dueSoon = withPrioritySignals({
      ...base,
      id: "soon",
      dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      workflowState: "unsubmitted",
    });
    const submitted = withPrioritySignals({ ...base, id: "done", workflowState: "submitted" });
    const missing = withPrioritySignals({ ...base, id: "missing", missing: true, pointsPossible: 20 });

    expect(sortByPriority([submitted, dueSoon, missing]).map((assignment) => assignment.id)).toEqual([
      "missing",
      "soon",
      "done",
    ]);
  });
});
