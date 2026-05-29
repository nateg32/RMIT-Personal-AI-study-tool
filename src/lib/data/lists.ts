import type { User } from "@prisma/client";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { demoDashboard } from "@/lib/mock-data";
import { isDemoUser } from "@/lib/auth";
import type { CanvasAssignmentSummary } from "@/lib/types";
import { sortByPriority, withPrioritySignals } from "@/lib/prioritization";

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
}

export async function getAssignmentsForUser(user: User): Promise<CanvasAssignmentSummary[]> {
  if (isDemoUser(user) || !env.DATABASE_URL) {
    return [...demoDashboard.dueToday, ...demoDashboard.dueThisWeek];
  }
  const db = getDb();
  const assignments = await db.assignment.findMany({
    where: { userId: user.id },
    include: { course: true, submission: true },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  return sortByPriority(
    assignments.map((assignment) =>
      withPrioritySignals({
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
      }),
    ),
  );
}

export async function getCoursesForUser(user: User) {
  if (isDemoUser(user) || !env.DATABASE_URL) {
    return [
      { id: "demo-c1", name: "Algorithms and Analysis", courseCode: "COSC2123", term: "UGRD Semester 1 2026", active: true },
      { id: "demo-c2", name: "Cloud Foundations", courseCode: "COSC2757", term: "UGRD Semester 1 2026", active: true },
      { id: "demo-c3", name: "Introduction to Cyber Security", courseCode: "INTE2625", term: "Flexible Term 2026", active: true },
      { id: "demo-c4", name: "Software Engineering Fundamentals", courseCode: "ISYS3413", term: "UGRD Semester 1 2026", active: true },
    ];
  }
  const db = getDb();
  return db.course.findMany({
    where: { userId: user.id },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function getAnnouncementsForUser(user: User) {
  if (isDemoUser(user) || !env.DATABASE_URL) return demoDashboard.announcements;
  const db = getDb();
  const announcements = await db.announcement.findMany({
    where: { userId: user.id },
    include: { course: true },
    orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  return announcements.map((announcement) => ({
    id: announcement.id,
    courseName: announcement.course.name,
    title: announcement.title,
    message: announcement.message,
    postedAt: announcement.postedAt?.toISOString() || null,
    htmlUrl: announcement.htmlUrl,
  }));
}

export async function getFilesForUser(user: User) {
  if (isDemoUser(user) || !env.DATABASE_URL) return demoDashboard.files;
  const db = getDb();
  const files = await db.canvasFile.findMany({
    where: { userId: user.id },
    include: { course: true },
    orderBy: [{ updatedAtCanvas: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  return files.map((file) => ({
    id: file.id,
    courseName: file.course.name,
    name: file.name,
    contentType: file.contentType,
    size: file.size,
    updatedAtCanvas: file.updatedAtCanvas?.toISOString() || null,
    url: file.url,
  }));
}

export async function getStudySessionsForUser(user: User) {
  if (isDemoUser(user) || !env.DATABASE_URL) return [];
  const db = getDb();
  return db.studySession.findMany({
    where: { userId: user.id },
    include: { assignment: { include: { course: true } } },
    orderBy: [{ createdAt: "desc" }],
  });
}
