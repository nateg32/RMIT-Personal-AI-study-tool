import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { stripCanvasHtml } from "@/lib/security/html";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_GEMINI_INLINE_BYTES = 4 * 1024 * 1024;
const MAX_INDEXED_TEXT = 24_000;

const textContentTypes = new Set([
  "application/json",
  "application/xml",
  "application/xhtml+xml",
  "application/csv",
  "text/csv",
  "text/html",
  "text/markdown",
  "text/plain",
]);

const textExtensions = new Set([".txt", ".md", ".markdown", ".csv", ".json", ".html", ".htm", ".xml", ".log"]);
const docxContentTypes = new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const geminiReadableExtensions = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".ppt",
  ".pptx",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".markdown",
  ".html",
  ".htm",
  ".csv",
  ".json",
  ".xml",
]);
const mimeByExtension = new Map([
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".txt", "text/plain"],
  [".md", "text/markdown"],
  [".markdown", "text/markdown"],
  [".html", "text/html"],
  [".htm", "text/html"],
  [".csv", "text/csv"],
  [".json", "application/json"],
  [".xml", "application/xml"],
]);

export type GeminiStoredFile = {
  name: string;
  mimeType: string;
  base64Data: string;
  size: number;
};

export type ManualMaterialMetadata = {
  id: string;
  name: string;
  contentType?: string | null;
  size?: number | null;
  courseId?: string | null;
  courseName?: string | null;
  assignmentId?: string | null;
  assignmentName?: string | null;
  extractedText?: string | null;
  notes?: string | null;
  geminiFile?: GeminiStoredFile | null;
  deepReadStatus?: "local_text" | "gemini_file" | "notes_only" | "metadata_only";
  createdAt: string;
};

export const uploadMaterialSchema = z.object({
  courseId: z.string().optional(),
  assignmentId: z.string().optional(),
  title: z.string().trim().min(1).max(180).optional(),
  notes: z.string().trim().max(24_000).optional(),
});

export function manualMaterialHash(value: ManualMaterialMetadata) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function parseManualMaterial(value: Prisma.JsonValue | null | undefined): ManualMaterialMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;
  return {
    id: record.id,
    name: record.name,
    contentType: typeof record.contentType === "string" ? record.contentType : null,
    size: typeof record.size === "number" ? record.size : null,
    courseId: typeof record.courseId === "string" ? record.courseId : null,
    courseName: typeof record.courseName === "string" ? record.courseName : null,
    assignmentId: typeof record.assignmentId === "string" ? record.assignmentId : null,
    assignmentName: typeof record.assignmentName === "string" ? record.assignmentName : null,
    extractedText: typeof record.extractedText === "string" ? record.extractedText : null,
    notes: typeof record.notes === "string" ? record.notes : null,
    geminiFile: parseGeminiStoredFile(record.geminiFile),
    deepReadStatus:
      record.deepReadStatus === "local_text" ||
      record.deepReadStatus === "gemini_file" ||
      record.deepReadStatus === "notes_only" ||
      record.deepReadStatus === "metadata_only"
        ? record.deepReadStatus
        : undefined,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
  };
}

function extension(name: string) {
  const match = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || "";
}

function isTextLike(file: File) {
  const type = file.type.toLowerCase();
  return type.startsWith("text/") || textContentTypes.has(type) || textExtensions.has(extension(file.name));
}

function isDocx(file: File) {
  const type = file.type.toLowerCase();
  return extension(file.name) === ".docx" || docxContentTypes.has(type);
}

function parseGeminiStoredFile(value: unknown): GeminiStoredFile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.name !== "string" ||
    typeof record.mimeType !== "string" ||
    typeof record.base64Data !== "string" ||
    typeof record.size !== "number"
  ) {
    return null;
  }
  return {
    name: record.name,
    mimeType: record.mimeType,
    base64Data: record.base64Data,
    size: record.size,
  };
}

function inferredContentType(file: File) {
  return file.type || mimeByExtension.get(extension(file.name)) || "application/octet-stream";
}

function isGeminiReadable(file: File) {
  const type = inferredContentType(file).toLowerCase();
  return (
    type.startsWith("image/") ||
    type === "application/pdf" ||
    type.includes("presentation") ||
    type === "application/vnd.ms-powerpoint" ||
    type.startsWith("text/") ||
    textContentTypes.has(type) ||
    docxContentTypes.has(type) ||
    geminiReadableExtensions.has(extension(file.name))
  );
}

function cleanText(value: string) {
  return stripCanvasHtml(value)
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_INDEXED_TEXT);
}

async function extractIndexedText(file: File, buffer: Buffer) {
  if (isTextLike(file)) return cleanText(buffer.toString("utf8"));
  if (isDocx(file)) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({
      buffer,
    });
    return cleanText(result.value || "");
  }
  return null;
}

export async function createUploadedMaterial({
  userId,
  file,
  courseId,
  assignmentId,
  title,
  notes,
}: {
  userId: string;
  file?: File | null;
  courseId?: string;
  assignmentId?: string;
  title?: string;
  notes?: string;
}) {
  if (file && file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File is too large for a Vercel upload. Upload a file under 4 MB, or paste the key brief/notes instead.");
  }

  const db = getDb();
  let resolvedCourseId = courseId || null;
  let resolvedCourseName: string | null = null;
  const resolvedAssignmentId = assignmentId || null;
  let resolvedAssignmentName: string | null = null;

  if (resolvedAssignmentId) {
    const assignment = await db.assignment.findFirst({
      where: { id: resolvedAssignmentId, userId },
      select: { id: true, courseId: true, name: true, course: { select: { name: true } } },
    });
    if (!assignment) throw new Error("Assignment not found");
    resolvedCourseId = assignment.courseId;
    resolvedCourseName = assignment.course.name;
    resolvedAssignmentName = assignment.name;
  }

  if (resolvedCourseId && !resolvedCourseName) {
    const course = await db.course.findFirst({
      where: { id: resolvedCourseId, userId },
      select: { id: true, name: true },
    });
    if (!course) throw new Error("Course not found");
    resolvedCourseName = course.name;
  }

  const fileBuffer = file ? Buffer.from(await file.arrayBuffer()) : null;
  const contentType = file ? inferredContentType(file) : "text/plain";
  const extractedText = file && fileBuffer ? await extractIndexedText(file, fileBuffer) : null;
  const cleanedNotes = notes ? cleanText(notes) : null;
  const name = (file?.name || title || "Manual study material").slice(0, 180);
  const geminiFile =
    file && fileBuffer && isGeminiReadable(file) && file.size <= MAX_GEMINI_INLINE_BYTES
      ? {
          name,
          mimeType: contentType,
          base64Data: fileBuffer.toString("base64"),
          size: file.size,
        }
      : null;

  if (!file && !cleanedNotes) {
    throw new Error("Upload a file or paste notes/brief text to index.");
  }
  if (file && !extractedText && !cleanedNotes && !geminiFile) {
    throw new Error(
      file.size > MAX_GEMINI_INLINE_BYTES
        ? "That file is too large for deep AI reading in chat. Upload a smaller PDF/image/slide deck under 4 MB or paste the key notes."
        : "I cannot read that file type yet. Upload PDF, image, PowerPoint, DOCX, .txt, .md, .html, .csv, or paste the key notes.",
    );
  }

  const id = randomUUID();
  const deepReadStatus = extractedText
    ? "local_text"
    : geminiFile
      ? "gemini_file"
      : cleanedNotes
        ? "notes_only"
        : "metadata_only";
  const metadata: ManualMaterialMetadata = {
    id,
    name,
    contentType,
    size: file?.size || cleanedNotes?.length || null,
    courseId: resolvedCourseId,
    courseName: resolvedCourseName,
    assignmentId: resolvedAssignmentId,
    assignmentName: resolvedAssignmentName,
    extractedText,
    notes: cleanedNotes,
    geminiFile,
    deepReadStatus,
    createdAt: new Date().toISOString(),
  };

  await db.syncSnapshot.create({
    data: {
      userId,
      type: "manual_upload",
      sourceId: id,
      hash: manualMaterialHash(metadata),
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  await auditLog({
    userId,
    action: "uploaded_file.created",
    metadata: {
      id,
      courseId: resolvedCourseId,
      assignmentId: resolvedAssignmentId,
      hasExtractedText: Boolean(extractedText),
      hasNotes: Boolean(cleanedNotes),
      deepReadStatus,
    },
  });

  return metadata;
}
