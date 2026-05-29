import type { User } from "@prisma/client";
import { addDays, endOfDay, startOfDay, subHours } from "date-fns";
import { getDb } from "@/lib/db";
import { firstDisplayName } from "@/lib/display";
import { env } from "@/lib/env";
import { demoDashboard } from "@/lib/mock-data";
import { getOverallRisk, isSubmitted, sortByPriority, withPrioritySignals } from "@/lib/prioritization";
import type { CanvasAssignmentSummary, DashboardSummary } from "@/lib/types";
import { isDemoUser } from "@/lib/auth";
import { parseManualMaterial, type ManualMaterialMetadata } from "@/lib/data/uploads";
import {
  filterManualMaterials,
  getDashboardPreferences,
  isAssignmentVisible,
  isCourseVisible,
} from "@/lib/data/preferences";

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

function excerpt(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim().slice(0, 220) || null;
}

function latestDate(...values: Array<Date | null | undefined>) {
  const dates = values.filter((value): value is Date => Boolean(value));
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function metadataErrorMessage(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const error = (metadata as Record<string, unknown>).error;
  return typeof error === "string" ? error : null;
}

export async function getDashboardData(user: User): Promise<DashboardSummary> {
  if (isDemoUser(user) || !env.DATABASE_URL) return demoDashboard;

  const db = getDb();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = addDays(todayEnd, 7);
  const [connection, latestSuccessfulSync, latestFailedSync] = await Promise.all([
    db.canvasConnection.findUnique({ where: { userId: user.id } }),
    db.auditLog.findFirst({
        where: { userId: user.id, action: "canvas.synced" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, metadata: true },
      }),
    db.auditLog.findFirst({
      where: { userId: user.id, action: "canvas.sync_failed" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, metadata: true },
    }),
  ]);
  const lastSuccessfulSyncAt = latestDate(connection?.lastSyncAt, latestSuccessfulSync?.createdAt);
  const connectionAttemptAt =
    connection?.syncStatus === "syncing" || connection?.syncStatus === "error" ? connection.updatedAt : null;
  const lastSyncAttemptAt = latestDate(lastSuccessfulSyncAt, latestFailedSync?.createdAt, connectionAttemptAt);
  const envCanvasConfigured = Boolean(env.CANVAS_ACCESS_TOKEN?.trim());
  const canvasConnectionMode = connection ? "saved_token" : envCanvasConfigured ? "environment" : "not_connected";
  const canvasConfigured = canvasConnectionMode !== "not_connected";
  const latestFailureAt = latestDate(
    latestFailedSync?.createdAt,
    connection?.syncStatus === "error" ? connection.updatedAt : null,
  );
  const failureIsLatest = Boolean(latestFailureAt && (!lastSuccessfulSyncAt || latestFailureAt > lastSuccessfulSyncAt));
  const syncStatus =
    !canvasConfigured
      ? "not_connected"
      : connection?.syncStatus === "syncing"
        ? "syncing"
        : connection?.syncStatus === "error" || failureIsLatest
          ? "error"
          : lastSuccessfulSyncAt
            ? "success"
            : "never_synced";
  const syncError =
    syncStatus === "error"
      ? connection?.syncError || metadataErrorMessage(latestFailedSync?.metadata) || "The latest Canvas sync failed."
      : null;

  const courses = await db.course.findMany({
    where: { userId: user.id },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const preferences = await getDashboardPreferences(user.id);
  const visibleCourses = courses.filter((course) => isCourseVisible(course, preferences));
  const visibleCourseIds = visibleCourses.map((course) => course.id);

  const assignments = await db.assignment.findMany({
    where: { userId: user.id, courseId: { in: visibleCourseIds } },
    include: { course: true, submission: true },
    orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
  });

  const summaries = assignments
    .filter((assignment) => isAssignmentVisible(assignment, preferences))
    .map((assignment) => withPrioritySignals(assignmentSummary(assignment), now));
  const unsubmitted = sortByPriority(
    summaries.filter((item) => !isSubmitted(item)),
  );

  const [announcementTotal, canvasFileTotal, resourceTotal, manualUploadSnapshots] = await Promise.all([
    db.announcement.count({
      where: { userId: user.id, courseId: { in: visibleCourseIds } },
    }),
    db.canvasFile.count({
      where: { userId: user.id, courseId: { in: visibleCourseIds } },
    }),
    db.canvasResource.count({
      where: { userId: user.id, courseId: { in: visibleCourseIds } },
    }),
    db.syncSnapshot.findMany({
      where: { userId: user.id, type: "manual_upload" },
      select: { metadata: true },
      orderBy: [{ createdAt: "desc" }],
      take: 1000,
    }),
  ]);
  const manualMaterials = filterManualMaterials(
    manualUploadSnapshots
      .map((snapshot) => parseManualMaterial(snapshot.metadata))
      .filter((file): file is ManualMaterialMetadata => Boolean(file)),
    preferences,
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
    where: { userId: user.id, courseId: { in: visibleCourseIds } },
    include: { course: true },
    orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
    take: 8,
  });

  const allRecentAnnouncements = await db.announcement.findMany({
    where: { userId: user.id, courseId: { in: visibleCourseIds }, postedAt: { gte: subHours(now, 24 * 14) } },
    select: { courseId: true },
    take: 200,
  });

  const [files, uploadedSnapshots] = await Promise.all([
    db.canvasFile.findMany({
      where: { userId: user.id, courseId: { in: visibleCourseIds } },
      include: { course: true },
      orderBy: [{ updatedAtCanvas: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    db.syncSnapshot.findMany({
      where: { userId: user.id, type: "manual_upload" },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
    }),
  ]);
  const uploadedFiles = uploadedSnapshots
    .map((snapshot) => parseManualMaterial(snapshot.metadata))
    .filter((file): file is ManualMaterialMetadata => Boolean(file));

  const [allRecentFiles, allRecentUploads] = await Promise.all([
    db.canvasFile.findMany({
      where: { userId: user.id, courseId: { in: visibleCourseIds } },
      select: { courseId: true, updatedAtCanvas: true, createdAt: true },
      orderBy: [{ updatedAtCanvas: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    db.syncSnapshot.findMany({
      where: { userId: user.id, type: "manual_upload" },
      select: { metadata: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
  ]);
  const recentUploadMaterials = allRecentUploads
    .map((snapshot) => parseManualMaterial(snapshot.metadata))
    .filter((file): file is ManualMaterialMetadata => Boolean(file));
  const visibleUploadedFiles = filterManualMaterials(uploadedFiles, preferences);
  const visibleRecentUploadMaterials = filterManualMaterials(recentUploadMaterials, preferences);

  const stale = !lastSuccessfulSyncAt || lastSuccessfulSyncAt < subHours(now, 12) || syncStatus === "error";
  const priority = unsubmitted.slice(0, 6);
  const courseBreakdown = visibleCourses.map((course) => {
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
      recentFiles:
        allRecentFiles.filter((file) => file.courseId === course.id).length +
        visibleRecentUploadMaterials.filter((file) => file.courseId === course.id).length,
      riskLevel: getOverallRisk(courseUnsubmitted),
      nextAssignment: rankedCourseAssignments[0] || null,
    };
  });

  return {
    userName: firstDisplayName(user.name),
    timezone: user.timezone,
    lastSyncAt: lastSuccessfulSyncAt?.toISOString() || null,
    lastSuccessfulSyncAt: lastSuccessfulSyncAt?.toISOString() || null,
    lastSyncAttemptAt: lastSyncAttemptAt?.toISOString() || null,
    canvasConfigured,
    canvasConnectionMode,
    syncStatus,
    syncError,
    syncSummary: {
      visibleCourses: visibleCourses.length,
      hiddenCourses: Math.max(courses.length - visibleCourses.length, 0),
      assignments: summaries.length,
      unsubmittedAssignments: unsubmitted.length,
      announcements: announcementTotal,
      files: canvasFileTotal,
      resources: resourceTotal,
      manualMaterials: manualMaterials.length,
    },
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
    files: [
      ...visibleUploadedFiles.map((file) => ({
        id: file.id,
        courseId: file.courseId,
        assignmentId: file.assignmentId,
        assignmentName: file.assignmentName || null,
        courseName: file.courseName || "Manual library",
        name: file.name,
        updatedAtCanvas: file.createdAt,
        createdAt: file.createdAt,
        url: null,
        source: "manual_upload" as const,
        hasIndexedText: Boolean(file.extractedText || file.notes),
        excerpt: excerpt([file.notes, file.extractedText].filter(Boolean).join("\n\n")),
      })),
      ...files.map((file) => ({
        id: file.id,
        courseId: file.courseId,
        assignmentId: null,
        assignmentName: null,
        courseName: file.course.name,
        name: file.name,
        updatedAtCanvas: file.updatedAtCanvas?.toISOString() || null,
        createdAt: file.createdAt.toISOString(),
        url: file.url,
        source: "canvas" as const,
        hasIndexedText: false,
        excerpt: null,
      })),
    ].sort((a, b) => {
      const left = new Date(a.updatedAtCanvas || a.createdAt || 0).getTime();
      const right = new Date(b.updatedAtCanvas || b.createdAt || 0).getTime();
      return right - left;
    }).slice(0, 8),
    priorityItems: priority,
    courseBreakdown,
  };
}
