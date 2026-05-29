import type { User } from "@prisma/client";
import { subHours } from "date-fns";
import { isDemoUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { demoDashboard } from "@/lib/mock-data";
import { getUrgency, withPrioritySignals } from "@/lib/prioritization";
import type { AssignmentContextPack, AssignmentContextResource, CanvasAssignmentSummary } from "@/lib/types";
import { parseManualMaterial, type ManualMaterialMetadata } from "@/lib/data/uploads";
import {
  filterManualMaterials,
  getDashboardPreferences,
  isAssignmentVisible,
} from "@/lib/data/preferences";

export type GeminiReadableManualMaterial = {
  id: string;
  name: string;
  contentType: string;
  base64Data: string;
  size: number;
  courseName?: string | null;
  assignmentName?: string | null;
  notes?: string | null;
  extractedText?: string | null;
};

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

function excerpt(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim().slice(0, 1_500) || null;
}

function indexedMaterialText(file: ManualMaterialMetadata) {
  return [file.notes, file.extractedText].filter(Boolean).join("\n\n");
}

function toGeminiReadableMaterial(file: ManualMaterialMetadata): GeminiReadableManualMaterial | null {
  if (!file.geminiFile?.base64Data || !file.geminiFile.mimeType) return null;
  return {
    id: file.id,
    name: file.name,
    contentType: file.geminiFile.mimeType,
    base64Data: file.geminiFile.base64Data,
    size: file.geminiFile.size,
    courseName: file.courseName,
    assignmentName: file.assignmentName,
    notes: file.notes,
    extractedText: file.extractedText,
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
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
  const preferences = await getDashboardPreferences(user.id);
  const assignment = await db.assignment.findFirst({
    where: { id: assignmentId, userId: user.id },
    include: { course: true, submission: true },
  });
  if (!assignment) return null;
  if (!isAssignmentVisible(assignment, preferences)) return null;

  const queryWords = words(`${assignment.name} ${assignment.description || ""} ${assignment.course.name}`);
  const files = await db.canvasFile.findMany({
    where: { userId: user.id, courseId: assignment.courseId },
    orderBy: [{ updatedAtCanvas: "desc" }, { createdAt: "desc" }],
    take: 80,
  });
  const uploadedSnapshots = await db.syncSnapshot.findMany({
    where: { userId: user.id, type: "manual_upload" },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
  const uploadedFiles = uploadedSnapshots
    .map((snapshot) => parseManualMaterial(snapshot.metadata))
    .filter((file): file is ManualMaterialMetadata => {
      if (!file) return false;
      return (
        file.assignmentId === assignment.id ||
        (!file.assignmentId && file.courseId === assignment.courseId) ||
        (!file.assignmentId && !file.courseId)
      );
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

  const relatedUploadedFiles = uploadedFiles
    .map((file) => {
      const indexedText = indexedMaterialText(file);
      return {
        score: scoreText(
          queryWords,
          `${file.name} ${file.contentType || ""} ${file.assignmentName || ""} ${indexedText}`,
        ) + (file.assignmentId === assignment.id ? 6 : 0),
        resource: {
          title: file.name,
          type: "Manual upload",
          moduleName: file.assignmentName || file.courseName || "Manual library",
          url: null,
          excerpt: excerpt(indexedText),
        } satisfies AssignmentContextResource,
      };
    })
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
  } = withPrioritySignals({
    id: assignment.id,
    courseId: assignment.courseId,
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
    submissionTypes: stringArray(assignment.submissionTypes),
    rubricSummary: assignment.rubricSummary,
    rubric: assignment.rubric,
  });

  const missingContext = [];
  if (!assignment.description) missingContext.push("Assignment description was not available from Canvas.");
  if (!assignment.rubricSummary) missingContext.push("Rubric was not available from Canvas.");
  if (relatedFiles.length === 0 && relatedUploadedFiles.length === 0) {
    missingContext.push("No related files or manual materials were found in the latest sync.");
  }
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
    relatedFiles: [...relatedUploadedFiles, ...relatedFiles].slice(0, 12),
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
  const preferences = await getDashboardPreferences(user.id);
  const [assignments, uploadedSnapshots] = await Promise.all([
    db.assignment.findMany({
      where: { userId: user.id },
      include: { course: true, submission: true },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 80,
    }),
    db.syncSnapshot.findMany({
      where: { userId: user.id, type: "manual_upload" },
      select: { metadata: true },
      take: 200,
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);
  const uploadedFiles = uploadedSnapshots
    .map((snapshot) => parseManualMaterial(snapshot.metadata))
    .filter((file): file is ManualMaterialMetadata => Boolean(file));
  const visibleUploadedFiles = filterManualMaterials(uploadedFiles, preferences);

  const messageWords = words(message);
  const ranked = assignments
    .filter((assignment) => isAssignmentVisible(assignment, preferences))
    .map((assignment) => {
      const matchingUploads = visibleUploadedFiles
        .filter(
          (file) =>
            file.assignmentId === assignment.id ||
            (!file.assignmentId && file.courseId === assignment.courseId) ||
            (!file.assignmentId && !file.courseId),
        )
        .map((file) => `${file.name} ${indexedMaterialText(file)}`)
        .join(" ");
      const text = `${assignment.name} ${assignment.description || ""} ${assignment.course.name} ${
        assignment.course.courseCode || ""
      } ${matchingUploads}`;
      const summary = withPrioritySignals({
        id: assignment.id,
        courseId: assignment.courseId,
        canvasAssignmentId: assignment.canvasAssignmentId,
        courseName: assignment.course.name,
        courseCode: assignment.course.courseCode,
        name: assignment.name,
        description: assignment.description,
        dueAt: assignment.dueAt,
        pointsPossible: assignment.pointsPossible,
        htmlUrl: assignment.htmlUrl,
        submissionTypes: stringArray(assignment.submissionTypes),
        submittedAt: assignment.submission?.submittedAt,
        workflowState: assignment.submission?.workflowState,
        missing: assignment.submission?.missing,
        late: assignment.submission?.late,
      });
      return {
        id: assignment.id,
        score: scoreText(messageWords, text) + getUrgency(summary).score / 25,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, messageWords.size > 0 ? 4 : 3);

  const contexts = await Promise.all(ranked.map((item) => getAssignmentContextForUser(user, item.id)));
  return contexts.filter((context): context is AssignmentContextPack => Boolean(context));
}

export async function getChatManualMaterialsForUser(user: User, message: string) {
  if (isDemoUser(user) || !env.DATABASE_URL) {
    return demoDashboard.files
      .filter((file) => file.source === "manual_upload")
      .map((file) => `Manual upload - ${file.courseName}: ${file.name}${file.excerpt ? ` - Indexed excerpt: ${file.excerpt}` : ""}`);
  }

  const db = getDb();
  const preferences = await getDashboardPreferences(user.id);
  const snapshots = await db.syncSnapshot.findMany({
    where: { userId: user.id, type: "manual_upload" },
    select: { metadata: true },
    orderBy: [{ createdAt: "desc" }],
    take: 250,
  });
  const materials = filterManualMaterials(
    snapshots
      .map((snapshot) => parseManualMaterial(snapshot.metadata))
      .filter((file): file is ManualMaterialMetadata => Boolean(file)),
    preferences,
  );
  const messageWords = words(message);

  return materials
    .map((file) => {
      const indexedText = indexedMaterialText(file);
      return {
        score:
          scoreText(
            messageWords,
            `${file.name} ${file.courseName || ""} ${file.assignmentName || ""} ${file.contentType || ""} ${indexedText}`,
          ) + (message.toLowerCase().includes(file.name.toLowerCase()) ? 20 : 0),
        text: `Manual upload - ${file.courseName || "Manual library"}${
          file.assignmentName ? ` / ${file.assignmentName}` : ""
        }: ${file.name}${indexedText ? ` - Indexed excerpt: ${excerpt(indexedText)}` : " - No indexed text stored."}`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, messageWords.size > 0 ? 10 : 6)
    .map((item) => item.text);
}

export async function getChatGeminiMaterialsForUser(user: User, message: string) {
  if (isDemoUser(user) || !env.DATABASE_URL) return [];

  const db = getDb();
  const preferences = await getDashboardPreferences(user.id);
  const snapshots = await db.syncSnapshot.findMany({
    where: { userId: user.id, type: "manual_upload" },
    select: { metadata: true },
    orderBy: [{ createdAt: "desc" }],
    take: 120,
  });
  const materials = filterManualMaterials(
    snapshots
      .map((snapshot) => parseManualMaterial(snapshot.metadata))
      .filter((file): file is ManualMaterialMetadata => Boolean(file)),
    preferences,
  );
  const messageWords = words(message);

  return materials
    .map((file) => ({
      score:
        scoreText(
          messageWords,
          `${file.name} ${file.courseName || ""} ${file.assignmentName || ""} ${file.contentType || ""} ${indexedMaterialText(file)}`,
        ) + (message.toLowerCase().includes(file.name.toLowerCase()) ? 20 : 0),
      material: toGeminiReadableMaterial(file),
    }))
    .filter((item): item is { score: number; material: GeminiReadableManualMaterial } => Boolean(item.material))
    .sort((a, b) => b.score - a.score)
    .slice(0, messageWords.size > 0 ? 2 : 1)
    .map((item) => item.material);
}

export async function getStudySessionGeminiMaterialsForUser(
  user: User,
  input: { assignmentId?: string | null; courseId?: string | null; query?: string | null },
) {
  if (isDemoUser(user) || !env.DATABASE_URL) return [];

  const db = getDb();
  const preferences = await getDashboardPreferences(user.id);
  const snapshots = await db.syncSnapshot.findMany({
    where: { userId: user.id, type: "manual_upload" },
    select: { metadata: true },
    orderBy: [{ createdAt: "desc" }],
    take: 120,
  });
  const materials = filterManualMaterials(
    snapshots
      .map((snapshot) => parseManualMaterial(snapshot.metadata))
      .filter((file): file is ManualMaterialMetadata => Boolean(file)),
    preferences,
  );
  const queryWords = words(input.query || "");

  return materials
    .filter(
      (file) =>
        !input.assignmentId ||
        file.assignmentId === input.assignmentId ||
        (!file.assignmentId && input.courseId && file.courseId === input.courseId) ||
        (!file.assignmentId && !file.courseId),
    )
    .map((file) => ({
      score:
        scoreText(
          queryWords,
          `${file.name} ${file.courseName || ""} ${file.assignmentName || ""} ${file.contentType || ""} ${indexedMaterialText(file)}`,
        ) + (file.assignmentId === input.assignmentId ? 12 : 0),
      material: toGeminiReadableMaterial(file),
    }))
    .filter((item): item is { score: number; material: GeminiReadableManualMaterial } => Boolean(item.material))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((item) => item.material);
}

export async function getCustomFocusContextForUser(
  user: User,
  input: { title?: string | null; focus?: string | null },
): Promise<AssignmentContextPack> {
  const title = (input.title || "Custom focus session").trim().slice(0, 160) || "Custom focus session";
  const focus = (input.focus || "A manually created study focus. Use uploaded notes and files where available.").trim();

  if (isDemoUser(user) || !env.DATABASE_URL) {
    return {
      assignment: {
        id: "custom-focus",
        canvasAssignmentId: 0,
        courseName: "Custom focus",
        name: title,
        description: focus,
        workflowState: "custom",
      },
      lastSyncAt: demoDashboard.lastSyncAt,
      stale: demoDashboard.stale,
      course: { id: "custom", name: "Custom focus" },
      rubricCriteria: [],
      relatedFiles: demoDashboard.files.slice(0, 5).map((file) => ({
        title: file.name,
        type: file.source === "manual_upload" ? "Manual upload" : "File",
        moduleName: file.courseName,
        url: file.url,
        excerpt: file.excerpt,
      })),
      relatedResources: [],
      recentAnnouncements: [],
      contextConfidence: "medium",
      missingContext: ["This is a custom focus, so Canvas due dates and rubrics may not apply."],
    };
  }

  const db = getDb();
  const preferences = await getDashboardPreferences(user.id);
  const [connection, uploadedSnapshots] = await Promise.all([
    db.canvasConnection.findUnique({ where: { userId: user.id } }),
    db.syncSnapshot.findMany({
      where: { userId: user.id, type: "manual_upload" },
      orderBy: [{ createdAt: "desc" }],
      take: 30,
    }),
  ]);
  const uploadedFiles = filterManualMaterials(
    uploadedSnapshots
      .map((snapshot) => parseManualMaterial(snapshot.metadata))
      .filter((file): file is ManualMaterialMetadata => Boolean(file)),
    preferences,
  );

  return {
    assignment: {
      id: "custom-focus",
      canvasAssignmentId: 0,
      courseName: "Custom focus",
      name: title,
      description: focus,
      workflowState: "custom",
    },
    lastSyncAt: connection?.lastSyncAt?.toISOString() || null,
    stale: !connection?.lastSyncAt || connection.lastSyncAt < subHours(new Date(), 12),
    course: { id: "custom", name: "Custom focus" },
    rubricCriteria: [],
    relatedFiles: uploadedFiles.slice(0, 12).map((file) => ({
      title: file.name,
      type: "Manual upload",
      moduleName: file.assignmentName || file.courseName || "Manual library",
      url: null,
      excerpt: excerpt(indexedMaterialText(file)),
    })),
    relatedResources: [],
    recentAnnouncements: [],
    contextConfidence: focus || uploadedFiles.length ? "medium" : "low",
    missingContext: uploadedFiles.length
      ? ["This is a custom focus, so Canvas due dates and rubrics may not apply."]
      : ["No uploaded materials were attached yet. Add files or notes for a more specific plan."],
  };
}
