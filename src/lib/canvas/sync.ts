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

type ChangeEvent = {
  type: string;
  sourceId: string;
  label: string;
};

const MAX_CANVAS_FILES_PER_COURSE = 35;
const MAX_CANVAS_MODULES_PER_COURSE = 16;
const MAX_CANVAS_MODULE_ITEMS_PER_COURSE = 90;
const MAX_ASSIGNMENT_DETAIL_FETCHES_PER_SYNC = 8;

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

export async function getCanvasClientForUser(user: User) {
  const db = getDb();
  const connection = await db.canvasConnection.findUnique({ where: { userId: user.id } });

  if (connection) {
    return new CanvasClient({
      baseUrl: connection.canvasBaseUrl,
      token: decryptSecret({
        encrypted: connection.encryptedAccessToken,
        iv: connection.tokenIv,
        authTag: connection.tokenAuthTag,
      }),
    });
  }

  if (env.CANVAS_ACCESS_TOKEN && env.CANVAS_BASE_URL) {
    return new CanvasClient({
      baseUrl: normaliseBaseUrl(env.CANVAS_BASE_URL),
      token: env.CANVAS_ACCESS_TOKEN,
    });
  }

  throw new Error("Canvas is not connected");
}

export async function syncCanvasForUser(user: User) {
  const db = getDb();
  const client = await getCanvasClientForUser(user);
  const changes: ChangeEvent[] = [];
  const now = new Date();
  const startDate = new Date(now.getTime() - 365 * 24 * 36e5);
  const endDate = new Date(now.getTime() + 90 * 24 * 36e5);
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
    const courseIdMap = new Map<number, string>();
    const visibleCanvasCourseIds = new Set<number>();
    const seenAnnouncements = new Set<string>();
    let assignmentDetailFetches = 0;

    for (const course of activeCourses) {
      const savedCourse = await db.course.upsert({
        where: { userId_canvasCourseId: { userId: user.id, canvasCourseId: course.id } },
        create: {
          userId: user.id,
          canvasCourseId: course.id,
          name: course.name || course.course_code || `Course ${course.id}`,
          courseCode: course.course_code,
          term: course.term?.name,
          active: true,
        },
        update: {
          name: course.name || course.course_code || `Course ${course.id}`,
          courseCode: course.course_code,
          term: course.term?.name,
          active: true,
        },
      });
      courseIdMap.set(course.id, savedCourse.id);
      if (isCourseVisible(savedCourse, preferences)) {
        visibleCanvasCourseIds.add(course.id);
      }
    }

    const saveAnnouncement = async (announcement: CanvasAnnouncement, fallbackCourseId?: number) => {
      const canvasCourseId = announcementCourseId(announcement, fallbackCourseId);
      const courseId = canvasCourseId ? courseIdMap.get(canvasCourseId) : undefined;
      if (!courseId || !canvasCourseId) return;

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
        where: { courseId_canvasAnnouncementId: { courseId, canvasAnnouncementId: announcement.id } },
        create: {
          userId: user.id,
          courseId,
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

    for (const course of activeCourses) {
      if (!visibleCanvasCourseIds.has(course.id)) continue;
      const courseId = courseIdMap.get(course.id);
      if (!courseId) continue;
      const assignments = await client.getAssignmentsWithSubmissions(course.id);

      for (const assignment of assignments) {
        if (!isCanvasAssignmentVisible(course.id, assignment.id, preferences)) continue;
        const shouldFetchAssignmentDetails =
          assignmentDetailFetches < MAX_ASSIGNMENT_DETAIL_FETCHES_PER_SYNC &&
          (!assignment.description || !assignment.rubric);
        if (shouldFetchAssignmentDetails) assignmentDetailFetches += 1;
        const assignmentDetails = shouldFetchAssignmentDetails
          ? await client
              .getAssignmentDetails(course.id, assignment.id)
              .catch(() => assignment)
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
          `${course.id}:${assignment.id}`,
          snapshotValue,
          assignmentDetails.name,
        );
        if (change) changes.push(change);

        const savedAssignment = await db.assignment.upsert({
          where: { courseId_canvasAssignmentId: { courseId, canvasAssignmentId: assignment.id } },
          create: {
            userId: user.id,
            courseId,
            canvasAssignmentId: assignment.id,
            name: assignmentDetails.name,
            description: stripCanvasHtml(assignmentDetails.description),
            dueAt: parseDate(assignmentDetails.due_at),
            lockAt: parseDate(assignmentDetails.lock_at),
            pointsPossible: assignmentDetails.points_possible,
            htmlUrl: assignmentDetails.html_url,
            submissionTypes: assignmentDetails.submission_types || [],
            rubric: assignmentDetails.rubric
              ? (assignmentDetails.rubric as Prisma.InputJsonValue)
              : Prisma.JsonNull,
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
            rubric: assignmentDetails.rubric
              ? (assignmentDetails.rubric as Prisma.InputJsonValue)
              : Prisma.JsonNull,
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

      const courseAnnouncements = await client.getCourseAnnouncements(course.id).catch(() => []);
      for (const announcement of courseAnnouncements) {
        await saveAnnouncement(announcement, course.id);
      }

      const files = await client.getCourseFiles(course.id, MAX_CANVAS_FILES_PER_COURSE).catch(() => []);
      for (const file of files.slice(0, MAX_CANVAS_FILES_PER_COURSE)) {
        const name = file.display_name || file.filename || `File ${file.id}`;
        const change = await snapshot(
          user.id,
          "file",
          `${course.id}:${file.id}`,
          { name, updated_at: file.updated_at, size: file.size },
          name,
        );
        if (change) changes.push(change);
        await db.canvasFile.upsert({
          where: { courseId_canvasFileId: { courseId, canvasFileId: file.id } },
          create: {
            userId: user.id,
            courseId,
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

      const modules = await client.getCourseModulesWithItems(course.id, MAX_CANVAS_MODULES_PER_COURSE).catch(() => []);
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
            `${course.id}:${item.id}`,
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
            where: { courseId_canvasModuleItemId: { courseId, canvasModuleItemId: item.id } },
            create: {
              userId: user.id,
              courseId,
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

    const announcements = await client.getRecentAnnouncements(
      activeCourses.filter((course) => visibleCanvasCourseIds.has(course.id)).map((course) => course.id),
      startDate,
      endDate,
    ).catch(() => []);

    for (const announcement of announcements) {
      await saveAnnouncement(announcement);
    }

    await db.canvasConnection.updateMany({
      where: { userId: user.id },
      data: { lastSyncAt: new Date(), syncStatus: "ok", syncError: null },
    });

    return {
      ok: true,
      courses: visibleCanvasCourseIds.size,
      skippedCourses: activeCourses.length - visibleCanvasCourseIds.size,
      changes,
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

export function requireCanvasEnvToken() {
  return {
    baseUrl: normaliseBaseUrl(env.CANVAS_BASE_URL || "https://rmit.instructure.com"),
    token: requireEnv("CANVAS_ACCESS_TOKEN"),
  };
}
