import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireUser, isDemoUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getAssignmentContextForUser } from "@/lib/data/assignment-context";
import { getAssignmentsForUser, getStudySessionsForUser } from "@/lib/data/lists";
import { generateStudySession } from "@/lib/ai/gemini";
import { env } from "@/lib/env";

const createStudySessionSchema = z.object({
  assignmentId: z.string(),
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
    const assignments = await getAssignmentsForUser(user);
    const assignment = assignments.find((item) => item.id === input.assignmentId);
    if (!assignment) return jsonError(new Error("Assignment not found"), 404);
    const context = await getAssignmentContextForUser(user, assignment.id);
    if (!context) return jsonError(new Error("Assignment context not found"), 404);

    const plan = await generateStudySession({
      context,
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
          assignmentId: assignment.id,
          title: plan.title,
          durationMinutes: plan.durationMinutes,
          mode: input.mode,
          targetOutcome: input.targetOutcome,
          energyLevel: input.energyLevel,
          generatedPlanJson: plan,
        },
      });
      await auditLog({ userId: user.id, action: "study_session.created", metadata: { assignmentId: assignment.id } });
    }

    return jsonOk({ ok: true, plan });
  } catch (error) {
    return jsonError(error, 400);
  }
}
