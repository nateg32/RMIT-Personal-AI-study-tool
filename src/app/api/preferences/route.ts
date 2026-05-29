import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { isDemoUser, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import {
  canvasAssignmentKey,
  getDashboardPreferences,
  getDashboardScopeSummary,
  resetDashboardPreferences,
  saveDashboardPreferences,
} from "@/lib/data/preferences";

const preferencePatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("hide_course"), courseId: z.string() }),
  z.object({ action: z.literal("show_course"), courseId: z.string() }),
  z.object({ action: z.literal("hide_assignment"), assignmentId: z.string() }),
  z.object({ action: z.literal("show_assignment"), assignmentId: z.string() }),
  z.object({ action: z.literal("reset") }),
]);

export async function GET() {
  try {
    const user = await requireUser();
    if (isDemoUser(user) || !env.DATABASE_URL) {
      return jsonOk({
        excludedCourseIds: [],
        excludedCanvasCourseIds: [],
        excludedAssignmentIds: [],
        excludedCanvasAssignmentKeys: [],
        hiddenCourses: [],
        hiddenAssignments: [],
      });
    }
    return jsonOk(await getDashboardScopeSummary(user.id));
  } catch (error) {
    return jsonError(error, 401);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    if (isDemoUser(user) || !env.DATABASE_URL) {
      return jsonOk({
        excludedCourseIds: [],
        excludedCanvasCourseIds: [],
        excludedAssignmentIds: [],
        excludedCanvasAssignmentKeys: [],
        hiddenCourses: [],
        hiddenAssignments: [],
      });
    }
    const input = await parseJson(request, preferencePatchSchema);

    if (input.action === "reset") {
      await resetDashboardPreferences(user.id);
      await auditLog({ userId: user.id, action: "dashboard_scope.reset", metadata: {} });
      return jsonOk(await getDashboardScopeSummary(user.id));
    }

    const db = getDb();
    const preferences = await getDashboardPreferences(user.id);

    if (input.action === "hide_course" || input.action === "show_course") {
      const course = await db.course.findFirst({
        where: { id: input.courseId, userId: user.id },
        select: { id: true, canvasCourseId: true, name: true },
      });
      if (!course) return jsonError(new Error("Course not found"), 404);
      const hiding = input.action === "hide_course";
      const excludedCourseIds = hiding
        ? [...preferences.excludedCourseIds, course.id]
        : preferences.excludedCourseIds.filter((id) => id !== course.id);
      const excludedCanvasCourseIds = hiding
        ? [...preferences.excludedCanvasCourseIds, course.canvasCourseId]
        : preferences.excludedCanvasCourseIds.filter((id) => id !== course.canvasCourseId);

      await saveDashboardPreferences(user.id, {
        ...preferences,
        excludedCourseIds,
        excludedCanvasCourseIds,
      });
      await auditLog({
        userId: user.id,
        action: hiding ? "dashboard_scope.course_hidden" : "dashboard_scope.course_shown",
        metadata: { courseId: course.id, canvasCourseId: course.canvasCourseId, name: course.name },
      });
      return jsonOk(await getDashboardScopeSummary(user.id));
    }

    const assignment = await db.assignment.findFirst({
      where: { id: input.assignmentId, userId: user.id },
      include: { course: { select: { id: true, canvasCourseId: true, name: true } } },
    });
    if (!assignment) return jsonError(new Error("Assignment not found"), 404);
    const key = canvasAssignmentKey(assignment.course.canvasCourseId, assignment.canvasAssignmentId);
    const hiding = input.action === "hide_assignment";
    const excludedAssignmentIds = hiding
      ? [...preferences.excludedAssignmentIds, assignment.id]
      : preferences.excludedAssignmentIds.filter((id) => id !== assignment.id);
    const excludedCanvasAssignmentKeys =
      key && hiding
        ? [...preferences.excludedCanvasAssignmentKeys, key]
        : preferences.excludedCanvasAssignmentKeys.filter((item) => item !== key);

    await saveDashboardPreferences(user.id, {
      ...preferences,
      excludedAssignmentIds,
      excludedCanvasAssignmentKeys,
    });
    await auditLog({
      userId: user.id,
      action: hiding ? "dashboard_scope.assignment_hidden" : "dashboard_scope.assignment_shown",
      metadata: {
        assignmentId: assignment.id,
        canvasAssignmentId: assignment.canvasAssignmentId,
        canvasAssignmentKey: key,
        courseId: assignment.courseId,
      },
    });
    return jsonOk(await getDashboardScopeSummary(user.id));
  } catch (error) {
    return jsonError(error, 400);
  }
}
