import type { User } from "@prisma/client";
import { addDays, endOfDay, startOfDay, subHours } from "date-fns";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { demoDashboard } from "@/lib/mock-data";
import { getOverallRisk, sortByPriority } from "@/lib/prioritization";
import type { CanvasAssignmentSummary, DashboardSummary } from "@/lib/types";
import { isDemoUser } from "@/lib/auth";

function assignmentSummary(assignment: {
  id: string;
  canvasAssignmentId: number;
  name: string;
  dueAt: Date | null;
  pointsPossible: number | null;
  htmlUrl: string | null;
  description?: string | null;
  rubricSummary?: string | null;
  rubric?: unknown;
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

  const assignments = await db.assignment.findMany({
    where: {
      userId: user.id,
      dueAt: { not: null, lte: weekEnd },
    },
    include: { course: true, submission: true },
    orderBy: [{ dueAt: "asc" }],
    take: 50,
  });

  const summaries = assignments.map(assignmentSummary);
  const unsubmitted = sortByPriority(
    summaries.filter((item) => !item.submittedAt && item.workflowState !== "submitted"),
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

  const files = await db.canvasFile.findMany({
    where: { userId: user.id },
    include: { course: true },
    orderBy: [{ updatedAtCanvas: "desc" }, { createdAt: "desc" }],
    take: 8,
  });

  const stale = !connection?.lastSyncAt || connection.lastSyncAt < subHours(now, 12);
  const priority = unsubmitted.slice(0, 4);

  return {
    userName: user.name.split(" ")[0] || user.name,
    timezone: user.timezone,
    lastSyncAt: connection?.lastSyncAt?.toISOString() || null,
    stale,
    riskLevel: getOverallRisk(unsubmitted),
    todayMission:
      priority.length > 0
        ? priority.map((assignment) => `${assignment.courseName}: ${assignment.name}`)
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
  };
}
