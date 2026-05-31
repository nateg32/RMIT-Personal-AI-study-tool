import { createHash } from "node:crypto";
import { Prisma, type User } from "@prisma/client";
import { CanvasClient, type CanvasAnnouncement, type CanvasSubmission } from "@/lib/canvas/client";
import { getDb } from "@/lib/db";
import { cleanPersonName } from "@/lib/display";
import { env, requireEnv } from "@/lib/env";
import { decryptSecret } from "@/lib/security/crypto";
import { stripCanvasHtml } from "@/lib/security/html";
import { normaliseBaseUrl } from "@/lib/utils";
import {
  getDashboardPreferences,
  isCanvasAssignmentVisible,
  isCourseVisible,
} from "@/lib/data/preferences";

export type ChangeEvent = {
  type: string;
  sourceId: string;
  label: string;
};

const MAX_CANVAS_FILES_PER_COURSE = 35;
const MAX_CANVAS_MODULES_PER_COURSE = 16;
const MAX_CANVAS_MODULE_ITEMS_PER_COURSE = 90;
const MAX_ASSIGNMENT_DETAIL_FETCHES_PER_SYNC = 8;
const CANVAS_REQUEST_TIMEOUT_MS = 6_500;
const COURSE_SYNC_REQUEST_TIMEOUT_MS = 5_500;
const COURSE_SYNC_TIME_BUDGET_MS = 8_500;

type CanvasSyncOptions = {
  includeResources?: boolean;
  requestTimeoutMs?: number;
  timeBudgetMs?: number;
};

export type PreparedCanvasCourse = {
  id: string;
  canvasCourseId: number;
  name: string;
  courseCode?: string | null;
};

export type CanvasCourseSyncSummary = {
  ok: boolean;
  mode: "course_skipped" | "course_core" | "course_full";
  course: { id: string; canvasCourseId: number; name: string };
  assignments: number;
  changes: ChangeEvent[];
  warnings: string[];
  syncedAt?: string;
};

function parseDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function canvasSubmissionIsSubmitted(submission?: CanvasSubmission | null) {
  const state = submission?.workflow_state?.toLowerCase();
  return Boolean(
    submission?.submitted_at ||
      state === "submitted" ||
      state === "graded" ||
      state === "complete" ||
      state === "pending_review",
  );
}

function announcementPostedAt(announcement: CanvasAnnouncement) {
  return (
    announcement.posted_at ||
    announcement.delayed_post_at ||
    announcement.created_at ||
    announcement.updated_at ||
    null
  );
}

function announcementCourseId(announcement: CanvasAnnouncement, fallbackCourseId?: number) {
  if (announcement.context_code?.startsWith("course_")) {
    const parsed = Number(announcement.context_code.replace("course_", ""));
    if (Number.isFinite(parsed)) return parsed;
  }

  const url = announcement.html_url || announcement.url || "";
  const match = url.match(/\/courses\/(\d+)(?:\/|$)/);
  if (match?.[1]) return Number(match[1]);
  return fallbackCourseId;
}

function summariseRubric(rubric: Array<Record<string, unknown>> | null | undefined) {
  if (!rubric?.length) {
    return { summary: null, criteria: [] as string[] };
  }

  const criteria = rubric.slice(0, 12).map((criterion) => {
    const title = String(criterion.description || "Rubric criterion").trim();
    const details = String(criterion.long_description || "").replace(/\s+/g, " ").trim();
    const points = criterion.points ? ` (${criterion.points} pts)` : "";
    return `${title}${points}${details ? `: ${details}` : ""}`.slice(0, 500);
  });

  return {
    summary: criteria.join(" | ").slice(0, 4_000),
    criteria,
  };
}

async function snapshot(
  userId: string,
  type: string,
  sourceId: string,
  value: unknown,
  label: string,
): Promise<ChangeEvent | null> {
  const db = getDb();
  const hash = stableHash(value);
  const existing = await db.syncSnapshot.findUnique({
    where: { userId_type_sourceId: { userId, type, sourceId } },
  });

  if (!existing) {
    await db.syncSnapshot.create({
      data: { userId, type, sourceId, hash, metadata: value as Prisma.InputJsonValue },
    });
    return { type: `${type}.new`, sourceId, label };
  }

  if (existing.hash !== hash) {
    await db.syncSnapshot.update({
      where: { id: existing.id },
      data: { hash, metadata: value as Prisma.InputJsonValue },
    });
    return { type: `${type}.changed`, sourceId, label };
  }

  return null;
}

export async function getCanvasClientForUser(user: User, options?: { timeoutMs?: number }) {
  const db = getDb();
  const connection = await db.canvasConnection.findUnique({ where: { userId: user.id } });
  const timeoutMs = options?.timeoutMs || CANVAS_REQUEST_TIMEOUT_MS;

  if (connection) {
    return new CanvasClient({
      baseUrl: connection.canvasBaseUrl,
      token: decryptSecret({
        encrypted: connection.encryptedAccessToken,
        iv: connection.tokenIv,
        authTag: connection.tokenAuthTag,
      }),
      timeoutMs,
    });
  }

  if (env.CANVAS_ACCESS_TOKEN && env.CANVAS_BASE_URL) {
    return new CanvasClient({
      baseUrl: normaliseBaseUrl(env.CANVAS_BASE_URL),
      token: env.CANVAS_ACCESS_TOKEN,
      timeoutMs,
    });
  }

  throw new Error("Canvas is not connected");
}

export async function prepareCanvasSyncForUser(user: User) {
  const db = getDb();
  const client = await getCanvasClientForUser(user);
  const preferences = await getDashboardPreferences(user.id);

  await db.canvasConnection.updateMany({
    where: { userId: user.id },
    data: { syncStatus: "syncing", syncError: null },
  });

  try {
    const canvasUser = await client.getCurrentUser();
    await db.user.update({
      where: { id: user.id },
      data: {
        name: cleanPersonName(canvasUser.name) || cleanPersonName(user.name) || user.name,
        email: canvasUser.primary_email?.toLowerCase() || user.email,
      },
    });

    const courses = await client.getCourses();
    const activeCourses = courses.filter((course) => course.workflow_state !== "deleted");
    const visibleCourses: PreparedCanvasCourse[] = [];

    for (const canvasCourse of activeCourses) {
      const savedCourse = await db.course.upsert({
        where: { userId_canvasCourseId: { userId: user.id, canvasCourseId: canvasCourse.id } },
        create: {
          userId: user.id,
          canvasCourseId: canvasCourse.id,
          name: canvasCourse.name || canvasCourse.course_code || `Course ${canvasCourse.id}`,
          courseCode: canvasCourse.course_code,
          term: canvasCourse.term?.name,
          active: true,
        },
        update: {
          name: canvasCourse.name || canvasCourse.course_code || `Course ${canvasCourse.id}`,
          courseCode: canvasCourse.course_code,
          term: canvasCourse.term?.name,
          active: true,
        },
      });

      if (isCourseVisible(savedCourse, preferences)) {
        visibleCourses.push({
          id: savedCourse.id,
          canvasCourseId: savedCourse.canvasCourseId,
          name: savedCourse.name,
          courseCode: savedCourse.courseCode,
        });
      }
    }

    return {
      ok: true,
      mode: "batch_prepare" as const,
      courses: visibleCourses,
      skippedCourses: activeCourses.length - visibleCourses.length,
      totalCourses: activeCourses.length,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    await db.canvasConnection.updateMany({
      where: { userId: user.id },
      data: {
        syncStatus: "error",
        syncError: error instanceof Error ? error.message.slice(0, 500) : "Unknown sync error",
      },
    });
    throw error;
  }
}

export async function syncCanvasCourseForUser(
  user: User,
  canvasCourseId: number,
  options: CanvasSyncOptions = {},
): Promise<CanvasCourseSyncSummary> {
  const db = getDb();
  const preferences = await getDashboardPreferences(user.id);
  const changes: ChangeEvent[] = [];
  const warnings: string[] = [];
  const seenAnnouncements = new Set<string>();
  const budgetWarnings = new Set<string>();
  let assignmentDetailFetches = 0;
  const deadlineAt = Date.now() + (options.timeBudgetMs || COURSE_SYNC_TIME_BUDGET_MS);

  const course = await db.course.findUnique({
    where: { userId_canvasCourseId: { userId: user.id, canvasCourseId } },
  });
  if (!course) throw new Error("Course must be prepared before syncing assignments.");

  if (!isCourseVisible(course, preferences)) {
    return {
      ok: true,
      mode: "course_skipped",
      course: { id: course.id, canvasCourseId: course.canvasCourseId, name: course.name },
      assignments: 0,
      changes,
      warnings,
      syncedAt: new Date().toISOString(),
    };
  }

  const client = await getCanvasClientForUser(user, {
    timeoutMs: options.requestTimeoutMs || COURSE_SYNC_REQUEST_TIMEOUT_MS,
  });

  const hasTimeFor = (label: string, requiredMs: number) => {
    if (Date.now() + requiredMs < deadlineAt) return true;
    if (!budgetWarnings.has(label)) {
      budgetWarnings.add(label);
      warnings.push(`${course.name}: skipped ${label} because the sync was close to its function timeout`);
    }
    return false;
  };

  const saveAnnouncement = async (announcement: CanvasAnnouncement, fallbackCourseId?: number) => {
    const resolvedCanvasCourseId = announcementCourseId(announcement, fallbackCourseId);
    if (resolvedCanvasCourseId !== canvasCourseId) return;

    const dedupeKey = `${canvasCourseId}:${announcement.id}`;
    if (seenAnnouncements.has(dedupeKey)) return;
    seenAnnouncements.add(dedupeKey);

    const postedAt = announcementPostedAt(announcement);
    const title = stripCanvasHtml(announcement.title) || `Announcement ${announcement.id}`;
    const message = stripCanvasHtml(announcement.message);
    const change = await snapshot(
      user.id,
      "announcement",
      dedupeKey,
      { title, message, posted_at: postedAt },
      title,
    );
    if (change) changes.push(change);

    await db.announcement.upsert({
      where: {
        courseId_canvasAnnouncementId: {
          courseId: course.id,
          canvasAnnouncementId: announcement.id,
        },
      },
      create: {
        userId: user.id,
        courseId: course.id,
        canvasAnnouncementId: announcement.id,
        title,
        message,
        postedAt: parseDate(postedAt),
        htmlUrl: announcement.html_url || announcement.url,
      },
      update: {
        title,
        message,
        postedAt: parseDate(postedAt),
        htmlUrl: announcement.html_url || announcement.url,
      },
    });
  };

  const assignments = await client.getAssignmentsWithSubmissions(canvasCourseId);

  for (const assignment of assignments) {
    if (!isCanvasAssignmentVisible(canvasCourseId, assignment.id, preferences)) continue;

    const shouldFetchAssignmentDetails =
      options.includeResources &&
      assignmentDetailFetches < MAX_ASSIGNMENT_DETAIL_FETCHES_PER_SYNC &&
      (!assignment.description || !assignment.rubric) &&
      hasTimeFor("extra assignment details", 1_500);
    if (shouldFetchAssignmentDetails) assignmentDetailFetches += 1;

    const assignmentDetails = shouldFetchAssignmentDetails
      ? await client.getAssignmentDetails(canvasCourseId, assignment.id).catch(() => assignment)
      : assignment;
    const rubric = summariseRubric(
      assignmentDetails.rubric as Array<Record<string, unknown>> | null | undefined,
    );
    const snapshotValue = {
      name: assignmentDetails.name,
      due_at: assignmentDetails.due_at,
      updated_at: assignmentDetails.updated_at,
      points_possible: assignmentDetails.points_possible,
      submission_types: assignmentDetails.submission_types,
      workflow_state: assignmentDetails.submission?.workflow_state,
      submitted_at: assignmentDetails.submission?.submitted_at,
      rubric_summary: rubric.summary,
      all_dates: assignmentDetails.all_dates,
      overrides: assignmentDetails.overrides,
      score_statistics: assignmentDetails.score_statistics,
    };
    const change = await snapshot(
      user.id,
      "assignment",
      `${canvasCourseId}:${assignment.id}`,
      snapshotValue,
      assignmentDetails.name,
    );
    if (change) changes.push(change);

    const savedAssignment = await db.assignment.upsert({
      where: {
        courseId_canvasAssignmentId: {
          courseId: course.id,
          canvasAssignmentId: assignment.id,
        },
      },
      create: {
        userId: user.id,
        courseId: course.id,
        canvasAssignmentId: assignment.id,
        name: assignmentDetails.name,
        description: stripCanvasHtml(assignmentDetails.description),
        dueAt: parseDate(assignmentDetails.due_at),
        lockAt: parseDate(assignmentDetails.lock_at),
        pointsPossible: assignmentDetails.points_possible,
        htmlUrl: assignmentDetails.html_url,
        submissionTypes: assignmentDetails.submission_types || [],
        rubric: assignmentDetails.rubric ? (assignmentDetails.rubric as Prisma.InputJsonValue) : Prisma.JsonNull,
        rubricSummary: rubric.summary,
        createdAtCanvas: parseDate(assignmentDetails.created_at),
        updatedAtCanvas: parseDate(assignmentDetails.updated_at),
      },
      update: {
        name: assignmentDetails.name,
        description: stripCanvasHtml(assignmentDetails.description),
        dueAt: parseDate(assignmentDetails.due_at),
        lockAt: parseDate(assignmentDetails.lock_at),
        pointsPossible: assignmentDetails.points_possible,
        htmlUrl: assignmentDetails.html_url,
        submissionTypes: assignmentDetails.submission_types || [],
        rubric: assignmentDetails.rubric ? (assignmentDetails.rubric as Prisma.InputJsonValue) : Prisma.JsonNull,
        rubricSummary: rubric.summary,
        updatedAtCanvas: parseDate(assignmentDetails.updated_at),
      },
    });

    if (assignmentDetails.submission) {
      const existingSubmission = await db.submission.findUnique({
        where: { assignmentId: savedAssignment.id },
      });
      const preserveManualStatus =
        existingSubmission?.workflowState === "submitted_elsewhere" &&
        !canvasSubmissionIsSubmitted(assignmentDetails.submission);

      if (preserveManualStatus) continue;

      await db.submission.upsert({
        where: { assignmentId: savedAssignment.id },
        create: {
          assignmentId: savedAssignment.id,
          submittedAt: parseDate(assignmentDetails.submission.submitted_at),
          workflowState: assignmentDetails.submission.workflow_state,
          score: assignmentDetails.submission.score,
          grade: assignmentDetails.submission.grade,
          late: assignmentDetails.submission.late || false,
          missing: assignmentDetails.submission.missing || false,
          attempt: assignmentDetails.submission.attempt,
        },
        update: {
          submittedAt: parseDate(assignmentDetails.submission.submitted_at),
          workflowState: assignmentDetails.submission.workflow_state,
          score: assignmentDetails.submission.score,
          grade: assignmentDetails.submission.grade,
          late: assignmentDetails.submission.late || false,
          missing: assignmentDetails.submission.missing || false,
          attempt: assignmentDetails.submission.attempt,
        },
      });
    }
  }

  if (hasTimeFor("announcements", 5_750)) {
    const courseAnnouncements = await client.getCourseAnnouncements(canvasCourseId).catch((error) => {
      warnings.push(
        `${course.name}: announcements failed - ${
          error instanceof Error ? error.message.slice(0, 120) : "unknown Canvas error"
        }`,
      );
      return [];
    });
    for (const announcement of courseAnnouncements.slice(0, 25)) {
      await saveAnnouncement(announcement, canvasCourseId);
    }
  }

  if (options.includeResources) {
    if (!hasTimeFor("files", 5_750)) {
      return {
        ok: true,
        mode: "course_core",
        course: { id: course.id, canvasCourseId: course.canvasCourseId, name: course.name },
        assignments: assignments.length,
        changes,
        warnings,
        syncedAt: new Date().toISOString(),
      };
    }

    const files = await client.getCourseFiles(canvasCourseId, MAX_CANVAS_FILES_PER_COURSE).catch((error) => {
      warnings.push(
        `${course.name}: files failed - ${error instanceof Error ? error.message.slice(0, 120) : "unknown Canvas error"}`,
      );
      return [];
    });

    for (const file of files.slice(0, MAX_CANVAS_FILES_PER_COURSE)) {
      const name = file.display_name || file.filename || `File ${file.id}`;
      const change = await snapshot(
        user.id,
        "file",
        `${canvasCourseId}:${file.id}`,
        { name, updated_at: file.updated_at, size: file.size },
        name,
      );
      if (change) changes.push(change);

      await db.canvasFile.upsert({
        where: { courseId_canvasFileId: { courseId: course.id, canvasFileId: file.id } },
        create: {
          userId: user.id,
          courseId: course.id,
          canvasFileId: file.id,
          name,
          url: file.url,
          contentType: file["content-type"],
          size: file.size,
          createdAtCanvas: parseDate(file.created_at),
          updatedAtCanvas: parseDate(file.updated_at),
        },
        update: {
          name,
          url: file.url,
          contentType: file["content-type"],
          size: file.size,
          updatedAtCanvas: parseDate(file.updated_at),
        },
      });
    }

    const modules = hasTimeFor("modules", 5_750)
      ? await client.getCourseModulesWithItems(canvasCourseId, MAX_CANVAS_MODULES_PER_COURSE).catch((error) => {
          warnings.push(
            `${course.name}: modules failed - ${
              error instanceof Error ? error.message.slice(0, 120) : "unknown Canvas error"
            }`,
          );
          return [];
        })
      : [];

    let moduleItemCount = 0;
    for (const courseModule of modules.slice(0, MAX_CANVAS_MODULES_PER_COURSE)) {
      for (const item of courseModule.items || []) {
        if (moduleItemCount >= MAX_CANVAS_MODULE_ITEMS_PER_COURSE) break;
        moduleItemCount += 1;
        const title = stripCanvasHtml(item.title) || `${item.type || "Module item"} ${item.id}`;
        const resourceType = item.type || "unknown";
        const change = await snapshot(
          user.id,
          "resource",
          `${canvasCourseId}:${item.id}`,
          {
            title,
            type: resourceType,
            module: courseModule.name,
            html_url: item.html_url,
            external_url: item.external_url,
            page_url: item.page_url,
            content_id: item.content_id,
            position: item.position,
          },
          title,
        );
        if (change) changes.push(change);

        await db.canvasResource.upsert({
          where: { courseId_canvasModuleItemId: { courseId: course.id, canvasModuleItemId: item.id } },
          create: {
            userId: user.id,
            courseId: course.id,
            canvasModuleItemId: item.id,
            canvasContentId: item.content_id,
            moduleName: courseModule.name,
            title,
            resourceType,
            htmlUrl: item.html_url,
            externalUrl: item.external_url,
            pageUrl: item.page_url,
            position: item.position,
            published: item.published,
          },
          update: {
            canvasContentId: item.content_id,
            moduleName: courseModule.name,
            title,
            resourceType,
            htmlUrl: item.html_url,
            externalUrl: item.external_url,
            pageUrl: item.page_url,
            position: item.position,
            published: item.published,
          },
        });
      }
      if (moduleItemCount >= MAX_CANVAS_MODULE_ITEMS_PER_COURSE) break;
    }
  }

  return {
    ok: true,
    mode: options.includeResources ? "course_full" : "course_core",
    course: { id: course.id, canvasCourseId: course.canvasCourseId, name: course.name },
    assignments: assignments.length,
    changes,
    warnings,
    syncedAt: new Date().toISOString(),
  };
}

export async function finishCanvasSyncForUser(user: User, input?: { syncError?: string | null }) {
  const db = getDb();
  const hasError = Boolean(input?.syncError);
  const finishedAt = new Date();

  await db.canvasConnection.updateMany({
    where: { userId: user.id },
    data: hasError
      ? { syncStatus: "error", syncError: input?.syncError?.slice(0, 500) || "Canvas sync failed" }
      : { lastSyncAt: finishedAt, syncStatus: "ok", syncError: null },
  });

  return {
    ok: !hasError,
    mode: "batch_finish" as const,
    syncedAt: hasError ? null : finishedAt.toISOString(),
    syncError: input?.syncError || null,
  };
}

export async function syncCanvasForUser(user: User, options: CanvasSyncOptions = {}) {
  const prepared = await prepareCanvasSyncForUser(user);
  const changes: ChangeEvent[] = [];
  const warnings: string[] = [];
  let successfulCourses = 0;

  for (const course of prepared.courses) {
    try {
      const summary = await syncCanvasCourseForUser(user, course.canvasCourseId, options);
      successfulCourses += 1;
      changes.push(...summary.changes);
      warnings.push(...summary.warnings);
    } catch (error) {
      warnings.push(`${course.name}: ${error instanceof Error ? error.message.slice(0, 160) : "sync failed"}`);
    }
  }

  const syncError =
    prepared.courses.length > 0 && successfulCourses === 0
      ? warnings[0] || "No Canvas courses synced successfully"
      : null;
  await finishCanvasSyncForUser(user, { syncError });

  return {
    ok: !syncError,
    mode: options.includeResources ? "full" : "core",
    courses: prepared.courses.length,
    skippedCourses: prepared.skippedCourses,
    successfulCourses,
    changes,
    warnings,
    syncedAt: new Date().toISOString(),
  };
}

export function requireCanvasEnvToken() {
  return {
    baseUrl: normaliseBaseUrl(env.CANVAS_BASE_URL || "https://rmit.instructure.com"),
    token: requireEnv("CANVAS_ACCESS_TOKEN"),
  };
}
