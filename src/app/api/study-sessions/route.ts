import { z } from "zod";
import type { Prisma } from "@prisma/client";
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
import { generateStudySession, studyPlanSchema } from "@/lib/ai/gemini";
import { env } from "@/lib/env";

const createStudySessionSchema = z.object({
  assignmentId: z.string().nullable().optional(),
  customTitle: z.string().trim().min(1).max(180).optional(),
  customFocus: z.string().trim().min(1).max(8_000).optional(),
  durationMinutes: z.number().min(15).max(480),
  mode: z.string().min(2).default("Plan assignment"),
  energyLevel: z.string().min(2).default("Medium"),
  targetOutcome: z.string().min(2).default("Credit"),
  manualPlan: studyPlanSchema.optional(),
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

    if (assignment && !isDemoUser(user) && env.DATABASE_URL) {
      const db = getDb();
      const existingSession = await db.studySession.findFirst({
        where: { userId: user.id, assignmentId: assignment.id },
        orderBy: { updatedAt: "desc" },
        include: { assignment: { include: { course: true } } },
      });
      const existingPlan = studyPlanSchema.safeParse(existingSession?.generatedPlanJson);
      if (existingSession && existingPlan.success) {
        await auditLog({
          userId: user.id,
          action: "study_session.reused",
          metadata: { assignmentId: assignment.id, sessionId: existingSession.id },
        });
        return jsonOk({ ok: true, plan: existingPlan.data, session: existingSession, reused: true });
      }
    }

    if (input.manualPlan) {
      const plan = {
        ...input.manualPlan,
        title: input.customTitle || input.manualPlan.title,
        durationMinutes: Math.max(15, Math.min(480, Math.round(input.manualPlan.durationMinutes || input.durationMinutes))),
      };

      let session = null;
      if (!isDemoUser(user) && env.DATABASE_URL) {
        const db = getDb();
        session = await db.studySession.create({
          data: {
            userId: user.id,
            assignmentId: assignment?.id || null,
            title: plan.title,
            durationMinutes: plan.durationMinutes,
            mode: input.mode,
            targetOutcome: input.targetOutcome,
            energyLevel: input.energyLevel,
            generatedPlanJson: plan as Prisma.InputJsonValue,
          },
          include: { assignment: { include: { course: true } } },
        });
        await auditLog({
          userId: user.id,
          action: "study_session.created",
          metadata: { assignmentId: assignment?.id || null, custom: isCustomSession, manual: true },
        });
      }

      return jsonOk({ ok: true, plan, session });
    }

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
      extraContext: input.customFocus,
    });

    let session = null;
    if (!isDemoUser(user) && env.DATABASE_URL) {
      const db = getDb();
      session = await db.studySession.create({
        data: {
          userId: user.id,
          assignmentId: assignment?.id || null,
          title: plan.title,
          durationMinutes: plan.durationMinutes,
          mode: input.mode,
          targetOutcome: input.targetOutcome,
          energyLevel: input.energyLevel,
          generatedPlanJson: plan as Prisma.InputJsonValue,
        },
        include: { assignment: { include: { course: true } } },
      });
      await auditLog({
        userId: user.id,
        action: "study_session.created",
        metadata: { assignmentId: assignment?.id || null, custom: isCustomSession },
      });
    }

    return jsonOk({ ok: true, plan, session });
  } catch (error) {
    return jsonError(error, 400);
  }
}
