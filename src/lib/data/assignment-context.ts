import type { User } from "@prisma/client";
import { subHours } from "date-fns";
import { isDemoUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { demoDashboard } from "@/lib/mock-data";
import type { AssignmentContextPack, AssignmentContextResource, CanvasAssignmentSummary } from "@/lib/types";

const RESOURCE_KEYWORDS = [
  "assignment",
  "assessment",
  "brief",
  "rubric",
  "lecture",
  "slides",
  "week",
  "tutorial",
  "lab",
  "milestone",
  "quiz",
  "project",
];

function words(value: string | null | undefined) {
  return new Set(
    (value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4),
  );
}

function scoreText(queryWords: Set<string>, text: string) {
  const haystack = text.toLowerCase();
  let score = 0;
  for (const word of queryWords) {
    if (haystack.includes(word)) score += 2;
  }
  for (const keyword of RESOURCE_KEYWORDS) {
    if (haystack.includes(keyword)) score += 1;
  }
  return score;
}

function criteriaFromRubricSummary(summary: string | null | undefined) {
  if (!summary) return [];
  return summary
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function resourceUrl(resource: {
  htmlUrl?: string | null;
  externalUrl?: string | null;
  url?: string | null;
}) {
  return resource.htmlUrl || resource.externalUrl || resource.url || null;
}

function demoContext(assignmentId?: string): AssignmentContextPack | null {
  const assignment =
    [...demoDashboard.dueToday, ...demoDashboard.dueThisWeek, ...demoDashboard.unsubmitted].find(
      (item) => !assignmentId || item.id === assignmentId,
    ) || demoDashboard.unsubmitted[0];
  if (!assignment) return null;

  const description =
    assignment.courseName === "Cloud Foundations"
      ? "Complete the listed AWS Academy lab activities, capture required evidence, and submit the milestone artefacts through Canvas."
      : "Review the assessment brief, respond to the required criteria, and submit the required file through Canvas.";

  return {
    assignment: {
      ...assignment,
      description,
      rubricSummary:
        "Requirements and evidence: include all required screenshots or artefacts | Accuracy: align work to the course lab/brief | Submission quality: use clear file names and confirm Canvas submission",
    },
    lastSyncAt: demoDashboard.lastSyncAt,
    stale: demoDashboard.stale,
    course: {
      id: "demo-course",
      name: assignment.courseName,
      courseCode: assignment.courseCode,
    },
    rubricCriteria: [
      "Requirements and evidence: include all required screenshots or artefacts",
      "Accuracy: align work to the course lab/brief",
      "Submission quality: use clear file names and confirm Canvas submission",
    ],
    relatedFiles: demoDashboard.files.map((file) => ({
      title: file.name,
      type: "File",
      moduleName: file.courseName,
      url: file.url,
    })),
    relatedResources: [
      {
        title: `${assignment.courseName} assignment brief`,
        type: "Assignment",
        moduleName: "Assessments",
        url: assignment.htmlUrl,
      },
      {
        title: `${assignment.courseName} lecture slides`,
        type: "File",
        moduleName: "Week 12",
      },
    ],
    recentAnnouncements: demoDashboard.announcements.map((announcement) => ({
      title: announcement.title,
      postedAt: announcement.postedAt,
      url: announcement.htmlUrl,
    })),
    contextConfidence: "medium",
    missingContext: ["Live Canvas files/rubrics require a real sync."],
  };
}

export async function getAssignmentContextForUser(user: User, assignmentId: string) {
  if (isDemoUser(user) || !env.DATABASE_URL) return demoContext(assignmentId);

  const db = getDb();
  const connection = await db.canvasConnection.findUnique({ where: { userId: user.id } });
  const assignment = await db.assignment.findFirst({
    where: { id: assignmentId, userId: user.id },
    include: { course: true, submission: true },
  });
  if (!assignment) return null;

  const queryWords = words(`${assignment.name} ${assignment.description || ""} ${assignment.course.name}`);
  const files = await db.canvasFile.findMany({
    where: { userId: user.id, courseId: assignment.courseId },
    orderBy: [{ updatedAtCanvas: "desc" }, { createdAt: "desc" }],
    take: 80,
  });
  const resources = await db.canvasResource.findMany({
    where: { userId: user.id, courseId: assignment.courseId },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take: 120,
  });
  const announcements = await db.announcement.findMany({
    where: { userId: user.id, courseId: assignment.courseId },
    orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
    take: 8,
  });

  const relatedFiles = files
    .map((file) => ({
      score: scoreText(queryWords, `${file.name} ${file.contentType || ""}`),
      resource: {
        title: file.name,
        type: file.contentType || "File",
        moduleName: assignment.course.name,
        url: file.url,
      } satisfies AssignmentContextResource,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item) => item.resource);

  const relatedResources = resources
    .map((item) => ({
      score: scoreText(queryWords, `${item.title} ${item.moduleName || ""} ${item.resourceType}`),
      resource: {
        title: item.title,
        type: item.resourceType,
        moduleName: item.moduleName,
        url: resourceUrl(item),
      } satisfies AssignmentContextResource,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((item) => item.resource);

  const summary: CanvasAssignmentSummary & {
    description?: string | null;
    rubricSummary?: string | null;
    rubric?: unknown;
  } = {
    id: assignment.id,
    canvasAssignmentId: assignment.canvasAssignmentId,
    courseName: assignment.course.name,
    courseCode: assignment.course.courseCode,
    name: assignment.name,
    description: assignment.description,
    dueAt: assignment.dueAt,
    pointsPossible: assignment.pointsPossible,
    htmlUrl: assignment.htmlUrl,
    submittedAt: assignment.submission?.submittedAt,
    workflowState: assignment.submission?.workflowState,
    missing: assignment.submission?.missing,
    late: assignment.submission?.late,
    rubricSummary: assignment.rubricSummary,
    rubric: assignment.rubric,
  };

  const missingContext = [];
  if (!assignment.description) missingContext.push("Assignment description was not available from Canvas.");
  if (!assignment.rubricSummary) missingContext.push("Rubric was not available from Canvas.");
  if (relatedFiles.length === 0) missingContext.push("No related files were found in the latest sync.");
  if (relatedResources.length === 0) missingContext.push("No module resources were found in the latest sync.");

  const confidence =
    assignment.description && (assignment.rubricSummary || relatedResources.length > 0)
      ? "high"
      : assignment.description || relatedResources.length > 0 || relatedFiles.length > 0
        ? "medium"
        : "low";

  return {
    assignment: summary,
    lastSyncAt: connection?.lastSyncAt?.toISOString() || null,
    stale: !connection?.lastSyncAt || connection.lastSyncAt < subHours(new Date(), 12),
    course: {
      id: assignment.course.id,
      name: assignment.course.name,
      courseCode: assignment.course.courseCode,
    },
    rubricCriteria: criteriaFromRubricSummary(assignment.rubricSummary),
    relatedFiles,
    relatedResources,
    recentAnnouncements: announcements.map((announcement) => ({
      title: announcement.title,
      message: announcement.message,
      postedAt: announcement.postedAt?.toISOString() || null,
      url: announcement.htmlUrl,
    })),
    contextConfidence: confidence,
    missingContext,
  } satisfies AssignmentContextPack;
}

export async function getChatAssignmentContextsForUser(user: User, message: string) {
  if (isDemoUser(user) || !env.DATABASE_URL) {
    const contexts = [...demoDashboard.unsubmitted, ...demoDashboard.dueToday, ...demoDashboard.dueThisWeek]
      .slice(0, 3)
      .map((assignment) => demoContext(assignment.id))
      .filter((context): context is AssignmentContextPack => Boolean(context));
    return contexts;
  }

  const db = getDb();
  const assignments = await db.assignment.findMany({
    where: { userId: user.id },
    include: { course: true, submission: true },
    orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
    take: 80,
  });

  const messageWords = words(message);
  const ranked = assignments
    .map((assignment) => {
      const text = `${assignment.name} ${assignment.description || ""} ${assignment.course.name} ${
        assignment.course.courseCode || ""
      }`;
      const submitted = assignment.submission?.submittedAt || assignment.submission?.workflowState === "submitted";
      const dueBoost = assignment.dueAt && assignment.dueAt > new Date() ? 2 : 0;
      return {
        id: assignment.id,
        score: scoreText(messageWords, text) + dueBoost + (submitted ? 0 : 1),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, messageWords.size > 0 ? 4 : 3);

  const contexts = await Promise.all(ranked.map((item) => getAssignmentContextForUser(user, item.id)));
  return contexts.filter((context): context is AssignmentContextPack => Boolean(context));
}
