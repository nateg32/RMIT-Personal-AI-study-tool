import { createHash } from "node:crypto";
import { Prisma, type User } from "@prisma/client";
import { CanvasClient } from "@/lib/canvas/client";
import { getDb } from "@/lib/db";
import { env, requireEnv } from "@/lib/env";
import { decryptSecret } from "@/lib/security/crypto";
import { stripCanvasHtml } from "@/lib/security/html";
import { normaliseBaseUrl } from "@/lib/utils";

type ChangeEvent = {
  type: string;
  sourceId: string;
  label: string;
};

function parseDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
  const startDate = new Date(now.getTime() - 14 * 24 * 36e5);
  const endDate = new Date(now.getTime() + 30 * 24 * 36e5);

  await db.canvasConnection.updateMany({
    where: { userId: user.id },
    data: { syncStatus: "syncing", syncError: null },
  });

  try {
    const canvasUser = await client.getCurrentUser();
    const courses = await client.getCourses();
    const activeCourses = courses.filter((course) => course.workflow_state !== "deleted");
    const courseIdMap = new Map<number, string>();

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
    }

    for (const course of activeCourses) {
      const courseId = courseIdMap.get(course.id);
      if (!courseId) continue;
      const assignments = await client.getAssignmentsWithSubmissions(course.id);

      for (const assignment of assignments) {
        const assignmentDetails = await client
          .getAssignmentDetails(course.id, assignment.id)
          .catch(() => assignment);
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

      const files = await client.getCourseFiles(course.id).catch(() => []);
      for (const file of files.slice(0, 100)) {
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

      const modules = await client.getCourseModulesWithItems(course.id).catch(() => []);
      for (const courseModule of modules) {
        for (const item of courseModule.items || []) {
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
      }
    }

    const announcements = await client.getRecentAnnouncements(
      activeCourses.map((course) => course.id),
      startDate,
      endDate,
    );

    for (const announcement of announcements) {
      const contextCourse = activeCourses.find((course) =>
        (announcement.html_url || announcement.url || "").includes(`/courses/${course.id}/`),
      );
      const canvasCourseId = contextCourse?.id || activeCourses[0]?.id;
      const courseId = canvasCourseId ? courseIdMap.get(canvasCourseId) : undefined;
      if (!courseId) continue;

      const change = await snapshot(
        user.id,
        "announcement",
        `${canvasCourseId}:${announcement.id}`,
        { title: announcement.title, posted_at: announcement.posted_at },
        announcement.title,
      );
      if (change) changes.push(change);

      await db.announcement.upsert({
        where: { courseId_canvasAnnouncementId: { courseId, canvasAnnouncementId: announcement.id } },
        create: {
          userId: user.id,
          courseId,
          canvasAnnouncementId: announcement.id,
          title: announcement.title,
          message: stripCanvasHtml(announcement.message),
          postedAt: parseDate(announcement.posted_at),
          htmlUrl: announcement.html_url || announcement.url,
        },
        update: {
          title: announcement.title,
          message: stripCanvasHtml(announcement.message),
          postedAt: parseDate(announcement.posted_at),
          htmlUrl: announcement.html_url || announcement.url,
        },
      });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        name: canvasUser.name || user.name,
        email: canvasUser.primary_email || user.email,
      },
    });

    await db.canvasConnection.updateMany({
      where: { userId: user.id },
      data: { lastSyncAt: new Date(), syncStatus: "ok", syncError: null },
    });

    return {
      ok: true,
      courses: activeCourses.length,
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
