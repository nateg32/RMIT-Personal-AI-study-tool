import type { AssignmentSummary, RiskLevel } from "../types";

export function dateValue(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null | undefined) {
  const date = dateValue(value);
  if (!date) return "No due date";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDateOnly(value: string | null | undefined) {
  const date = dateValue(value);
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatRelative(value: string | null | undefined) {
  const date = dateValue(value);
  if (!date) return "No due date";
  const hours = Math.round((date.getTime() - Date.now()) / 36e5);
  if (hours < 0) return `Overdue by ${Math.abs(hours)}h`;
  if (hours <= 24) return `Due in ${Math.max(1, hours)}h`;
  const days = Math.ceil(hours / 24);
  return days <= 7 ? `Due in ${days} days` : formatDateOnly(value);
}

export function isSubmitted(assignment: AssignmentSummary) {
  const state = assignment.workflowState?.toLowerCase();
  return (
    Boolean(assignment.submittedAt) ||
    state === "submitted" ||
    state === "graded" ||
    state === "complete" ||
    state === "pending_review" ||
    state === "submitted_elsewhere" ||
    state === "manual_complete" ||
    state === "done"
  );
}

export function riskForAssignment(assignment: AssignmentSummary): RiskLevel {
  if (assignment.priorityLabel) return assignment.priorityLabel;
  if (isSubmitted(assignment)) return "low";
  const due = dateValue(assignment.dueAt);
  if (!due) return "low";
  const hours = (due.getTime() - Date.now()) / 36e5;
  if (hours <= 24) return "critical";
  if (hours <= 72) return "high";
  if (hours <= 168) return "medium";
  return assignment.pointsPossible && assignment.pointsPossible >= 30 ? "high" : "low";
}

export function estimateEffort(assignment: AssignmentSummary) {
  if (assignment.estimatedTime) return assignment.estimatedTime;
  const risk = riskForAssignment(assignment);
  if (assignment.pointsPossible && assignment.pointsPossible >= 40) return "3-5h";
  if (risk === "critical") return "1-3h";
  if (risk === "high") return "2-4h";
  if (risk === "medium") return "45-90m";
  return "30-60m";
}

export function statusLabel(assignment: AssignmentSummary) {
  if (assignment.workflowState?.toLowerCase() === "submitted_elsewhere") return "Done elsewhere";
  if (isSubmitted(assignment)) return "Submitted";
  if (assignment.late) return "Late";
  if (assignment.missing) return "Missing";
  return "Unsubmitted";
}

export function assignmentTypeLabel(assignment: AssignmentSummary) {
  const type = assignment.assignmentType || "assignment";
  if (type === "quiz") return "Quiz";
  if (type === "discussion") return "Discussion";
  if (type === "file_upload") return "File upload";
  if (type === "external_tool") return "External tool";
  if (type === "text_entry") return "Text entry";
  if (type === "url") return "URL submission";
  if (type === "media") return "Media";
  if (type === "annotation") return "Annotation";
  if (type === "on_paper") return "On paper";
  return "Assignment";
}

export function riskTone(risk: RiskLevel) {
  if (risk === "critical") return "text-error bg-error-container border-error/30";
  if (risk === "high") return "text-tertiary bg-tertiary-container border-tertiary/30";
  if (risk === "medium") return "text-secondary bg-secondary-container border-secondary/30";
  return "text-primary bg-primary-container border-primary/30";
}

export function fileSizeLabel(size: number | null | undefined) {
  if (!size) return "Canvas file";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function compactText(value: string | null | undefined, fallback = "Canvas item") {
  const text = (value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}
