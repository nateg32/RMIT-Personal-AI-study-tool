import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireUser, isDemoUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  getAssignmentContextForUser,
  getCustomFocusContextForUser,
  getStudySessionGeminiMaterialsForUser,
} from "@/lib/data/assignment-context";
import { getAssignmentsForUser, getStudySessionsForUser } from "@/lib/data/lists";
import { generateStudySession } from "@/lib/ai/gemini";
import { env } from "@/lib/env";

const createStudySessionSchema = z.object({
  assignmentId: z.string().nullable().optional(),
  customTitle: z.string().trim().min(1).max(180).optional(),
  customFocus: z.string().trim().min(1).max(8_000).optional(),
  durationMinutes: z.number().min(15).max(480),
  mode: z.string().min(2),
  energyLevel: z.string().min(2),
  targetOutcome: z.string().min(2),
});

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk(await getStudySessionsForUser(user));
  } catch (error) {
    return jsonError(error, 401);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, createStudySessionSchema);
    const isCustomSession = !input.assignmentId;
    const assignments = isCustomSession ? [] : await getAssignmentsForUser(user);
    const assignment = input.assignmentId ? assignments.find((item) => item.id === input.assignmentId) : null;
    if (!isCustomSession && !assignment) return jsonError(new Error("Assignment not found"), 404);
    if (isCustomSession && !input.customTitle && !input.customFocus) {
      return jsonError(new Error("Add a focus title or notes before creating a custom session."), 400);
    }
    const context = assignment
      ? await getAssignmentContextForUser(user, assignment.id)
      : await getCustomFocusContextForUser(user, {
          title: input.customTitle,
          focus: input.customFocus,
        });
    if (!context) return jsonError(new Error("Study session context not found"), 404);
    const mediaMaterials = await getStudySessionGeminiMaterialsForUser(user, {
      assignmentId: assignment?.id || null,
      courseId: context.course.id,
      query: `${context.assignment.name} ${context.assignment.description || ""} ${input.customFocus || ""}`,
    });

    const plan = await generateStudySession({
      context,
      mediaMaterials,
      durationMinutes: input.durationMinutes,
      mode: input.mode,
      energyLevel: input.energyLevel,
      targetOutcome: input.targetOutcome,
      timezone: user.timezone,
    });

    if (!isDemoUser(user) && env.DATABASE_URL) {
      const db = getDb();
      await db.studySession.create({
        data: {
          userId: user.id,
          assignmentId: assignment?.id || null,
          title: plan.title,
          durationMinutes: plan.durationMinutes,
          mode: input.mode,
          targetOutcome: input.targetOutcome,
          energyLevel: input.energyLevel,
          generatedPlanJson: plan,
        },
      });
      await auditLog({
        userId: user.id,
        action: "study_session.created",
        metadata: { assignmentId: assignment?.id || null, custom: isCustomSession },
      });
    }

    return jsonOk({ ok: true, plan });
  } catch (error) {
    return jsonError(error, 400);
  }
}
