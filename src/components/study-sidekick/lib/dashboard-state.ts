import type { AssignmentSummary, CourseSummary, DailyBrief, DashboardSummary } from "../types";

type AssignmentPredicate = (assignment: AssignmentSummary) => boolean;

const EMPTY_MISSION = "No urgent Canvas tasks found. Use the time for review or planning.";

function normaliseText(value: string) {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function missionFromPriority(assignments: AssignmentSummary[] | undefined) {
  return assignments?.length
    ? assignments.map((assignment) => `${assignment.courseName}: ${assignment.name} - ${assignment.priorityReason || "Open task"}`)
    : [EMPTY_MISSION];
}

function uniqueAssignments(assignments: AssignmentSummary[]) {
  const seen = new Set<string>();
  return assignments.filter((assignment) => {
    if (seen.has(assignment.id)) return false;
    seen.add(assignment.id);
    return true;
  });
}

function affectedAssignments(dashboard: DashboardSummary, shouldAffect: AssignmentPredicate) {
  return uniqueAssignments([
    ...(dashboard.priorityItems || []),
    ...dashboard.dueToday,
    ...dashboard.dueThisWeek,
    ...dashboard.unsubmitted,
  ].filter(shouldAffect));
}

function assignmentMentions(assignment: AssignmentSummary) {
  const name = normaliseText(assignment.name);
  const course = normaliseText(assignment.courseName);
  const code = normaliseText(assignment.courseCode || "");
  const fragments = [
    name,
    course && name ? `${course} ${name}` : "",
    code && name ? `${code} ${name}` : "",
    ...name.split(" ").filter((part) => part.length >= 6),
  ].filter(Boolean);
  return Array.from(new Set(fragments));
}

function textMentionsAssignment(text: string, assignments: AssignmentSummary[]) {
  const normalised = normaliseText(text);
  return assignments.some((assignment) =>
    assignmentMentions(assignment).some((fragment) => fragment.length >= 6 && normalised.includes(fragment)),
  );
}

function cleanBriefArray(values: string[] | undefined, assignments: AssignmentSummary[]) {
  return (values || []).filter((value) => !textMentionsAssignment(value, assignments));
}

export function scrubDailyBriefAssignments(brief: DailyBrief | null, assignments: AssignmentSummary[]) {
  if (!brief || !assignments.length) return brief;
  const generatedJson = brief.generatedJson
    ? {
        ...brief.generatedJson,
        focusItems: cleanBriefArray(brief.generatedJson.focusItems, assignments),
        dueToday: cleanBriefArray(brief.generatedJson.dueToday, assignments),
        dueThisWeek: cleanBriefArray(brief.generatedJson.dueThisWeek, assignments),
        suggestedOrder: cleanBriefArray(brief.generatedJson.suggestedOrder, assignments),
      }
    : undefined;

  const summaryMentionsRemoved = textMentionsAssignment(
    [brief.summary, generatedJson?.summary || ""].filter(Boolean).join(" "),
    assignments,
  );

  return {
    ...brief,
    summary: summaryMentionsRemoved ? "Dashboard updated. Hidden or completed items are no longer part of today's mission." : brief.summary,
    generatedJson: generatedJson
      ? {
          ...generatedJson,
          summary: summaryMentionsRemoved
            ? "Dashboard updated. Hidden or completed items are no longer part of today's mission."
            : generatedJson.summary,
        }
      : generatedJson,
  };
}

export function assignmentBelongsToCourse(assignment: AssignmentSummary, courseId: string, courseName?: string | null) {
  return assignment.courseId === courseId || Boolean(courseName && assignment.courseName === courseName);
}

export function removeDashboardAssignments(
  dashboard: DashboardSummary,
  shouldRemove: AssignmentPredicate,
  options: { reduceAssignmentCount?: boolean; reduceUnsubmittedCount?: boolean } = {},
): DashboardSummary {
  const removed = affectedAssignments(dashboard, shouldRemove);
  const removedIds = new Set(removed.map((assignment) => assignment.id));
  const removedUnsubmittedIds = new Set(dashboard.unsubmitted.filter(shouldRemove).map((assignment) => assignment.id));
  const dueToday = dashboard.dueToday.filter((assignment) => !shouldRemove(assignment));
  const dueThisWeek = dashboard.dueThisWeek.filter((assignment) => !shouldRemove(assignment));
  const unsubmitted = dashboard.unsubmitted.filter((assignment) => !shouldRemove(assignment));
  const priorityItems = dashboard.priorityItems?.filter((assignment) => !shouldRemove(assignment));
  const missionSource = priorityItems?.length
    ? priorityItems
    : uniqueAssignments([...dueToday, ...dueThisWeek, ...unsubmitted]).slice(0, 6);

  return {
    ...dashboard,
    dueToday,
    dueThisWeek,
    unsubmitted,
    priorityItems,
    todayMission: missionFromPriority(missionSource),
    syncSummary: dashboard.syncSummary
      ? {
          ...dashboard.syncSummary,
          assignments: options.reduceAssignmentCount
            ? Math.max(dashboard.syncSummary.assignments - removedIds.size, 0)
            : dashboard.syncSummary.assignments,
          unsubmittedAssignments:
            options.reduceUnsubmittedCount === false
              ? dashboard.syncSummary.unsubmittedAssignments
              : Math.max(dashboard.syncSummary.unsubmittedAssignments - removedUnsubmittedIds.size, 0),
        }
      : dashboard.syncSummary,
    courseBreakdown: dashboard.courseBreakdown?.map((course) => {
      const removedForCourse = removed.filter((assignment) => assignmentBelongsToCourse(assignment, course.courseId, course.name));
      if (!removedForCourse.length) return course;

      const removedUnsubmittedForCourse = removedForCourse.filter((assignment) => removedUnsubmittedIds.has(assignment.id));
      const nextAssignment =
        course.nextAssignment && shouldRemove(course.nextAssignment)
          ? priorityItems?.find((assignment) => assignmentBelongsToCourse(assignment, course.courseId, course.name)) || null
          : course.nextAssignment;

      return {
        ...course,
        totalAssignments: options.reduceAssignmentCount
          ? Math.max(course.totalAssignments - removedForCourse.length, 0)
          : course.totalAssignments,
        unsubmittedAssignments: Math.max(course.unsubmittedAssignments - removedUnsubmittedForCourse.length, 0),
        overdueAssignments: Math.max(
          course.overdueAssignments - removedUnsubmittedForCourse.filter((assignment) => assignment.dueStatus === "overdue").length,
          0,
        ),
        dueToday: Math.max(
          course.dueToday - removedUnsubmittedForCourse.filter((assignment) => assignment.dueStatus === "due_today").length,
          0,
        ),
        dueThisWeek: Math.max(
          course.dueThisWeek - removedUnsubmittedForCourse.filter((assignment) => assignment.dueStatus === "due_this_week").length,
          0,
        ),
        nextAssignment,
      };
    }),
  };
}

export function removeCourseDashboardData(dashboard: DashboardSummary, course: CourseSummary | null) {
  if (!course) return dashboard;
  return {
    ...removeDashboardAssignments(
      dashboard,
      (assignment) => assignmentBelongsToCourse(assignment, course.id, course.name),
      { reduceAssignmentCount: true },
    ),
    announcements: dashboard.announcements.filter((announcement) => announcement.courseName !== course.name),
    files: dashboard.files.filter((file) => file.courseId !== course.id && file.courseName !== course.name),
    courseBreakdown: dashboard.courseBreakdown?.filter(
      (item) => item.courseId !== course.id && item.name !== course.name,
    ),
  };
}

export function markAssignmentSubmittedElsewhere(assignment: AssignmentSummary, submittedAt: string): AssignmentSummary {
  return {
    ...assignment,
    submittedAt,
    workflowState: "submitted_elsewhere",
    dueStatus: "submitted",
    missing: false,
    late: false,
  };
}
