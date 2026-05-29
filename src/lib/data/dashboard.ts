import type { User } from "@prisma/client";
import { addDays, endOfDay, startOfDay, subHours } from "date-fns";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { demoDashboard } from "@/lib/mock-data";
import { getOverallRisk, isSubmitted, sortByPriority, withPrioritySignals } from "@/lib/prioritization";
import type { CanvasAssignmentSummary, DashboardSummary } from "@/lib/types";
import { isDemoUser } from "@/lib/auth";

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
}

function assignmentSummary(assignment: {
  id: string;
  courseId: string;
  canvasAssignmentId: number;
  name: string;
  dueAt: Date | null;
  pointsPossible: number | null;
  htmlUrl: string | null;
  description?: string | null;
  rubricSummary?: string | null;
  rubric?: unknown;
  submissionTypes?: unknown;
  course: { name: string; courseCode: string | null };
  submission: {
    submittedAt: Date | null;
    workflowState: string | null;
    missing: boolean;
    late: boolean;
  } | null;
}): CanvasAssignmentSummary {
  return {
    id: assignment.id,
    courseId: assignment.courseId,
    canvasAssignmentId: assignment.canvasAssignmentId,
    courseName: assignment.course.name,
    courseCode: assignment.course.courseCode,
    name: assignment.name,
    dueAt: assignment.dueAt,
    pointsPossible: assignment.pointsPossible,
    htmlUrl: assignment.htmlUrl,
    description: assignment.description,
    rubricSummary: assignment.rubricSummary,
    rubric: assignment.rubric,
    submissionTypes: stringArray(assignment.submissionTypes),
    submittedAt: assignment.submission?.submittedAt,
    workflowState: assignment.submission?.workflowState,
    missing: assignment.submission?.missing,
    late: assignment.submission?.late,
  };
}

export async function getDashboardData(user: User): Promise<DashboardSummary> {
  if (isDemoUser(user) || !env.DATABASE_URL) return demoDashboard;

  const db = getDb();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = addDays(todayEnd, 7);
  const connection = await db.canvasConnection.findUnique({ where: { userId: user.id } });
  const latestSync = connection?.lastSyncAt
    ? null
    : await db.auditLog.findFirst({
        where: { userId: user.id, action: "canvas.synced" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
  const lastSyncAt = connection?.lastSyncAt || latestSync?.createdAt || null;
  const canvasConfigured = Boolean(connection || (env.CANVAS_BASE_URL && env.CANVAS_ACCESS_TOKEN));

  const courses = await db.course.findMany({
    where: { userId: user.id },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  const assignments = await db.assignment.findMany({
    where: { userId: user.id },
    include: { course: true, submission: true },
    orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
  });

  const summaries = assignments.map((assignment) => withPrioritySignals(assignmentSummary(assignment), now));
  const unsubmitted = sortByPriority(
    summaries.filter((item) => !isSubmitted(item)),
  );

  const dueToday = unsubmitted.filter((assignment) => {
    const due = assignment.dueAt ? new Date(assignment.dueAt) : null;
    return due && due >= todayStart && due <= todayEnd;
  });

  const dueThisWeek = unsubmitted.filter((assignment) => {
    const due = assignment.dueAt ? new Date(assignment.dueAt) : null;
    return due && due > todayEnd && due <= weekEnd;
  });

  const announcements = await db.announcement.findMany({
    where: { userId: user.id },
    include: { course: true },
    orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
    take: 8,
  });

  const allRecentAnnouncements = await db.announcement.findMany({
    where: { userId: user.id, postedAt: { gte: subHours(now, 24 * 14) } },
    select: { courseId: true },
    take: 200,
  });

  const files = await db.canvasFile.findMany({
    where: { userId: user.id },
    include: { course: true },
    orderBy: [{ updatedAtCanvas: "desc" }, { createdAt: "desc" }],
    take: 8,
  });

  const allRecentFiles = await db.canvasFile.findMany({
    where: { userId: user.id },
    select: { courseId: true, updatedAtCanvas: true, createdAt: true },
    orderBy: [{ updatedAtCanvas: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const stale = !lastSyncAt || lastSyncAt < subHours(now, 12);
  const priority = unsubmitted.slice(0, 6);
  const courseBreakdown = courses.map((course) => {
    const courseAssignments = summaries.filter((assignment) => assignment.courseId === course.id);
    const courseUnsubmitted = courseAssignments.filter((assignment) => !isSubmitted(assignment));
    const courseDueToday = courseUnsubmitted.filter((assignment) => assignment.dueStatus === "due_today");
    const courseDueThisWeek = courseUnsubmitted.filter((assignment) => assignment.dueStatus === "due_this_week");
    const courseOverdue = courseUnsubmitted.filter((assignment) => assignment.dueStatus === "overdue");
    const rankedCourseAssignments = sortByPriority(courseUnsubmitted);
    return {
      courseId: course.id,
      canvasCourseId: course.canvasCourseId,
      name: course.name,
      courseCode: course.courseCode,
      term: course.term,
      active: course.active,
      totalAssignments: courseAssignments.length,
      submittedAssignments: courseAssignments.filter(isSubmitted).length,
      unsubmittedAssignments: courseUnsubmitted.length,
      overdueAssignments: courseOverdue.length,
      dueToday: courseDueToday.length,
      dueThisWeek: courseDueThisWeek.length,
      recentAnnouncements: allRecentAnnouncements.filter((announcement) => announcement.courseId === course.id).length,
      recentFiles: allRecentFiles.filter((file) => file.courseId === course.id).length,
      riskLevel: getOverallRisk(courseUnsubmitted),
      nextAssignment: rankedCourseAssignments[0] || null,
    };
  });

  return {
    userName: user.name.split(" ")[0] || user.name,
    timezone: user.timezone,
    lastSyncAt: lastSyncAt?.toISOString() || null,
    canvasConfigured,
    stale,
    riskLevel: getOverallRisk(unsubmitted),
    todayMission:
      priority.length > 0
        ? priority.map((assignment) => `${assignment.courseName}: ${assignment.name} - ${assignment.priorityReason}`)
        : ["No urgent Canvas tasks found. Use the time for review or planning."],
    dueToday,
    dueThisWeek,
    unsubmitted,
    announcements: announcements.map((announcement) => ({
      id: announcement.id,
      courseName: announcement.course.name,
      title: announcement.title,
      postedAt: announcement.postedAt?.toISOString() || null,
      htmlUrl: announcement.htmlUrl,
    })),
    files: files.map((file) => ({
      id: file.id,
      courseName: file.course.name,
      name: file.name,
      updatedAtCanvas: file.updatedAtCanvas?.toISOString() || null,
      url: file.url,
    })),
    priorityItems: priority,
    courseBreakdown,
  };
}
