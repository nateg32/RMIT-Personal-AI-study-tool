import { differenceInCalendarDays, differenceInHours } from "date-fns";
import type { AssignmentType, CanvasAssignmentSummary, RiskLevel } from "@/lib/types";
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
      state === "complete" ||
      state === "pending_review",
  );
}

function submissionTypes(assignment: CanvasAssignmentSummary) {
  return Array.isArray(assignment.submissionTypes)
    ? assignment.submissionTypes.map((item) => item.toLowerCase())
    : [];
}

export function getAssignmentType(assignment: CanvasAssignmentSummary): AssignmentType {
  const types = submissionTypes(assignment);
  const searchable = `${assignment.name} ${assignment.description || ""} ${assignment.htmlUrl || ""}`.toLowerCase();

  if (types.includes("online_quiz") || searchable.includes("quiz")) return "quiz";
  if (types.includes("discussion_topic") || searchable.includes("discussion")) return "discussion";
  if (types.includes("external_tool")) return "external_tool";
  if (types.includes("online_upload")) return "file_upload";
  if (types.includes("online_text_entry")) return "text_entry";
  if (types.includes("online_url")) return "url";
  if (types.includes("media_recording")) return "media";
  if (types.includes("student_annotation")) return "annotation";
  if (types.includes("on_paper")) return "on_paper";
  if (types.includes("none")) return "assignment";
  return searchable ? "assignment" : "unknown";
}

export function getDueStatus(
  assignment: CanvasAssignmentSummary,
  now = new Date(),
): NonNullable<CanvasAssignmentSummary["dueStatus"]> {
  if (isSubmitted(assignment)) return "submitted";
  const dueAt = toDate(assignment.dueAt);
  if (!dueAt) return "undated";
  const hours = differenceInHours(dueAt, now);
  const days = differenceInCalendarDays(dueAt, now);
  if (hours < 0) return "overdue";
  if (hours <= 24) return "due_today";
  if (days <= 7) return "due_this_week";
  return "upcoming";
}

export function getUrgency(assignment: CanvasAssignmentSummary, now = new Date()): Urgency {
  const dueAt = toDate(assignment.dueAt);
  const submitted = isSubmitted(assignment);
  const points = assignment.pointsPossible || 0;
  const type = assignment.assignmentType || getAssignmentType(assignment);
  const typeLabel = type === "quiz" ? "Quiz" : type === "discussion" ? "Discussion" : "Task";
  const typeBoost = type === "quiz" ? 8 : type === "discussion" ? 4 : 0;
  const pointsBoost = Math.min(points, 45);

  if (submitted) {
    return {
      label: "low",
      score: 0,
      reason: "Already submitted",
      estimatedTime: "Review only",
    };
  }

  if (assignment.missing) {
    return {
      label: "critical",
      score: 150 + pointsBoost,
      reason: "Canvas marks this as missing",
      estimatedTime: points >= 25 ? "Emergency review" : "30-90 min",
    };
  }

  if (!dueAt) {
    return {
      label: "low",
      score: 22 + typeBoost + Math.min(points, 10),
      reason: "No due date",
      estimatedTime: "30-60 min",
    };
  }

  const hours = differenceInHours(dueAt, now);
  const days = differenceInCalendarDays(dueAt, now);

  if (hours < 0) {
    return {
      label: "critical",
      score: 130 + pointsBoost + typeBoost,
      reason: "Overdue and unsubmitted",
      estimatedTime: "Emergency review",
    };
  }

  if (hours <= 24) {
    return {
      label: "critical",
      score: 115 + pointsBoost + typeBoost,
      reason: `${typeLabel} due within 24 hours`,
      estimatedTime: points >= 25 ? "2-4 hours" : type === "quiz" ? "30-75 min" : "45-90 min",
    };
  }

  if (days <= 3 || points >= 30) {
    return {
      label: "high",
      score: 82 + Math.min(points, 35) + typeBoost - Math.max(days - 1, 0),
      reason: days <= 3 ? `${typeLabel} due within 3 days` : "High-point task",
      estimatedTime: points >= 25 ? "2-3 hours" : type === "quiz" ? "30-75 min" : "1-2 hours",
    };
  }

  if (days <= 7) {
    return {
      label: "medium",
      score: 55 + Math.min(points, 25) + typeBoost - Math.max(days - 3, 0),
      reason: `${typeLabel} due this week`,
      estimatedTime: type === "quiz" ? "30-75 min" : "45-120 min",
    };
  }

  return {
    label: "low",
    score: 28 + Math.min(points, 15) + typeBoost,
    reason: "Not urgent yet",
    estimatedTime: points >= 25 ? "1-2 hours" : "30-60 min",
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
  return [...assignments].sort((a, b) => {
    const priorityDelta = getUrgency(b).score - getUrgency(a).score;
    if (priorityDelta !== 0) return priorityDelta;
    const aDue = toDate(a.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = toDate(b.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
}

export function withPrioritySignals(assignment: CanvasAssignmentSummary, now = new Date()): CanvasAssignmentSummary {
  const assignmentType = getAssignmentType(assignment);
  const urgency = getUrgency({ ...assignment, assignmentType }, now);
  return {
    ...assignment,
    assignmentType,
    priorityScore: urgency.score,
    priorityLabel: urgency.label,
    priorityReason: urgency.reason,
    estimatedTime: urgency.estimatedTime,
    dueStatus: getDueStatus(assignment, now),
  };
}
