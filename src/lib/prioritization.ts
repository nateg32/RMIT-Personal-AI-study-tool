import { differenceInCalendarDays, differenceInHours } from "date-fns";
import type { CanvasAssignmentSummary, RiskLevel } from "@/lib/types";
import { toDate } from "@/lib/utils";

export type Urgency = {
  label: RiskLevel;
  score: number;
  reason: string;
  estimatedTime: string;
};

export function isSubmitted(assignment: CanvasAssignmentSummary) {
  const state = assignment.workflowState?.toLowerCase();
  return Boolean(
    assignment.submittedAt ||
      state === "submitted" ||
      state === "graded" ||
      state === "complete",
  );
}

export function getUrgency(assignment: CanvasAssignmentSummary, now = new Date()): Urgency {
  const dueAt = toDate(assignment.dueAt);
  const submitted = isSubmitted(assignment);
  const points = assignment.pointsPossible || 0;

  if (submitted) {
    return {
      label: "low",
      score: 10,
      reason: "Already submitted",
      estimatedTime: "Review only",
    };
  }

  if (!dueAt) {
    return {
      label: "low",
      score: 20,
      reason: "No due date",
      estimatedTime: "30-60 min",
    };
  }

  const hours = differenceInHours(dueAt, now);
  const days = differenceInCalendarDays(dueAt, now);

  if (hours < 0) {
    return {
      label: "critical",
      score: 100 + Math.min(points, 50),
      reason: "Overdue and unsubmitted",
      estimatedTime: "Emergency review",
    };
  }

  if (hours <= 24) {
    return {
      label: "critical",
      score: 90 + Math.min(points, 50),
      reason: "Due within 24 hours",
      estimatedTime: points >= 25 ? "2-4 hours" : "45-90 min",
    };
  }

  if (days <= 3 || points >= 30) {
    return {
      label: "high",
      score: 70 + Math.min(points, 30),
      reason: days <= 3 ? "Due within 3 days" : "High-point task",
      estimatedTime: points >= 25 ? "2-3 hours" : "1-2 hours",
    };
  }

  if (days <= 7) {
    return {
      label: "medium",
      score: 45 + Math.min(points, 20),
      reason: "Due this week",
      estimatedTime: "45-120 min",
    };
  }

  return {
    label: "low",
    score: 20 + Math.min(points, 10),
    reason: "Not urgent yet",
    estimatedTime: "30-60 min",
  };
}

export function getOverallRisk(assignments: CanvasAssignmentSummary[]): RiskLevel {
  const worst = assignments.reduce<RiskLevel>((level, assignment) => {
    const next = getUrgency(assignment).label;
    const order: RiskLevel[] = ["low", "medium", "high", "critical"];
    return order.indexOf(next) > order.indexOf(level) ? next : level;
  }, "low");
  return worst;
}

export function sortByPriority(assignments: CanvasAssignmentSummary[]) {
  return [...assignments].sort((a, b) => getUrgency(b).score - getUrgency(a).score);
}
