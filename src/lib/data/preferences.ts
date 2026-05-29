import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { parseManualMaterial, type ManualMaterialMetadata } from "@/lib/data/uploads";

export type DashboardPreferences = {
  excludedCourseIds: string[];
  excludedCanvasCourseIds: number[];
  excludedAssignmentIds: string[];
  excludedCanvasAssignmentKeys: string[];
};

export type DashboardScopeSummary = DashboardPreferences & {
  hiddenCourses: Array<{ id: string; canvasCourseId: number; name: string; courseCode?: string | null }>;
  hiddenAssignments: Array<{
    id: string;
    canvasAssignmentId: number;
    name: string;
    courseName: string;
    courseCode?: string | null;
  }>;
};

export const DASHBOARD_SCOPE_TYPE = "dashboard_preferences";
export const DASHBOARD_SCOPE_SOURCE_ID = "scope";

const emptyPreferences: DashboardPreferences = {
  excludedCourseIds: [],
  excludedCanvasCourseIds: [],
  excludedAssignmentIds: [],
  excludedCanvasAssignmentKeys: [],
};

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "number" ? item : Number(item)))
        .filter((item) => Number.isFinite(item))
    : [];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value))));
}

export function normaliseDashboardPreferences(value: unknown): DashboardPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyPreferences;
  const record = value as Record<string, unknown>;
  return {
    excludedCourseIds: uniqueStrings(stringArray(record.excludedCourseIds)),
    excludedCanvasCourseIds: uniqueNumbers(numberArray(record.excludedCanvasCourseIds)),
    excludedAssignmentIds: uniqueStrings(stringArray(record.excludedAssignmentIds)),
    excludedCanvasAssignmentKeys: uniqueStrings(stringArray(record.excludedCanvasAssignmentKeys)),
  };
}

export async function getDashboardPreferences(userId: string): Promise<DashboardPreferences> {
  const db = getDb();
  const snapshot = await db.syncSnapshot.findUnique({
    where: {
      userId_type_sourceId: {
        userId,
        type: DASHBOARD_SCOPE_TYPE,
        sourceId: DASHBOARD_SCOPE_SOURCE_ID,
      },
    },
  });
  return normaliseDashboardPreferences(snapshot?.metadata);
}

export async function saveDashboardPreferences(userId: string, preferences: DashboardPreferences) {
  const db = getDb();
  const metadata = normaliseDashboardPreferences(preferences);
  const hash = stableHash(metadata);
  await db.syncSnapshot.upsert({
    where: {
      userId_type_sourceId: {
        userId,
        type: DASHBOARD_SCOPE_TYPE,
        sourceId: DASHBOARD_SCOPE_SOURCE_ID,
      },
    },
    create: {
      userId,
      type: DASHBOARD_SCOPE_TYPE,
      sourceId: DASHBOARD_SCOPE_SOURCE_ID,
      hash,
      metadata: metadata as Prisma.InputJsonValue,
    },
    update: {
      hash,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
  return metadata;
}

export async function resetDashboardPreferences(userId: string) {
  return saveDashboardPreferences(userId, emptyPreferences);
}

export function canvasAssignmentKey(canvasCourseId?: number | null, canvasAssignmentId?: number | null) {
  if (!canvasCourseId || !canvasAssignmentId) return null;
  return `${canvasCourseId}:${canvasAssignmentId}`;
}

export function isCourseVisible(
  course: { id?: string | null; canvasCourseId?: number | null },
  preferences: DashboardPreferences,
) {
  if (course.id && preferences.excludedCourseIds.includes(course.id)) return false;
  if (course.canvasCourseId && preferences.excludedCanvasCourseIds.includes(course.canvasCourseId)) return false;
  return true;
}

export function isAssignmentVisible(
  assignment: {
    id?: string | null;
    canvasAssignmentId?: number | null;
    courseId?: string | null;
    course?: { id?: string | null; canvasCourseId?: number | null } | null;
  },
  preferences: DashboardPreferences,
) {
  if (assignment.id && preferences.excludedAssignmentIds.includes(assignment.id)) return false;
  if (assignment.course && !isCourseVisible(assignment.course, preferences)) return false;
  const key = canvasAssignmentKey(assignment.course?.canvasCourseId, assignment.canvasAssignmentId);
  if (key && preferences.excludedCanvasAssignmentKeys.includes(key)) return false;
  return true;
}

export function isCanvasAssignmentVisible(
  canvasCourseId: number,
  canvasAssignmentId: number,
  preferences: DashboardPreferences,
) {
  if (preferences.excludedCanvasCourseIds.includes(canvasCourseId)) return false;
  const key = canvasAssignmentKey(canvasCourseId, canvasAssignmentId);
  return key ? !preferences.excludedCanvasAssignmentKeys.includes(key) : true;
}

export function isManualMaterialVisible(file: ManualMaterialMetadata, preferences: DashboardPreferences) {
  if (file.courseId && preferences.excludedCourseIds.includes(file.courseId)) return false;
  if (file.assignmentId && preferences.excludedAssignmentIds.includes(file.assignmentId)) return false;
  return true;
}

export function filterManualMaterials<T extends ManualMaterialMetadata>(files: T[], preferences: DashboardPreferences) {
  return files.filter((file) => isManualMaterialVisible(file, preferences));
}

export async function getDashboardScopeSummary(userId: string): Promise<DashboardScopeSummary> {
  const preferences = await getDashboardPreferences(userId);
  const db = getDb();
  const [hiddenCourses, hiddenAssignments] = await Promise.all([
    preferences.excludedCourseIds.length || preferences.excludedCanvasCourseIds.length
      ? db.course.findMany({
          where: {
            userId,
            OR: [
              ...(preferences.excludedCourseIds.length ? [{ id: { in: preferences.excludedCourseIds } }] : []),
              ...(preferences.excludedCanvasCourseIds.length
                ? [{ canvasCourseId: { in: preferences.excludedCanvasCourseIds } }]
                : []),
            ],
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    preferences.excludedAssignmentIds.length || preferences.excludedCanvasAssignmentKeys.length
      ? db.assignment.findMany({
          where: { userId },
          include: { course: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const hiddenAssignmentRows = hiddenAssignments.filter((assignment) => {
    const key = canvasAssignmentKey(assignment.course.canvasCourseId, assignment.canvasAssignmentId);
    return (
      preferences.excludedAssignmentIds.includes(assignment.id) ||
      Boolean(key && preferences.excludedCanvasAssignmentKeys.includes(key))
    );
  });

  return {
    ...preferences,
    hiddenCourses: hiddenCourses.map((course) => ({
      id: course.id,
      canvasCourseId: course.canvasCourseId,
      name: course.name,
      courseCode: course.courseCode,
    })),
    hiddenAssignments: hiddenAssignmentRows.map((assignment) => ({
      id: assignment.id,
      canvasAssignmentId: assignment.canvasAssignmentId,
      name: assignment.name,
      courseName: assignment.course.name,
      courseCode: assignment.course.courseCode,
    })),
  };
}

export function parseManualMaterials(values: Array<{ metadata: Prisma.JsonValue | null }>) {
  return values
    .map((snapshot) => parseManualMaterial(snapshot.metadata))
    .filter((file): file is ManualMaterialMetadata => Boolean(file));
}
