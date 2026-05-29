import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const updateSchema = z.object({
  status: z.string().min(2).optional(),
  generatedPlanJson: z.unknown().optional(),
  assignmentId: z.string().nullable().optional(),
  title: z.string().min(1).max(160).optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  mode: z.string().min(2).max(80).optional(),
  energyLevel: z.string().min(2).max(80).optional(),
  targetOutcome: z.string().min(2).max(80).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = await parseJson(request, updateSchema);
    const db = getDb();
    const existing = await db.studySession.findFirst({ where: { id, userId: user.id } });
    if (!existing) return jsonError(new Error("Study session not found"), 404);

    const data: Prisma.StudySessionUpdateInput = {};
    if (input.status) data.status = input.status;
    if (input.title) data.title = input.title;
    if (input.durationMinutes) data.durationMinutes = input.durationMinutes;
    if (input.mode) data.mode = input.mode;
    if (input.energyLevel) data.energyLevel = input.energyLevel;
    if (input.targetOutcome) data.targetOutcome = input.targetOutcome;
    if (input.generatedPlanJson !== undefined) {
      data.generatedPlanJson = input.generatedPlanJson as Prisma.InputJsonValue;
    }
    if (input.assignmentId !== undefined) {
      if (input.assignmentId === null) {
        data.assignment = { disconnect: true };
      } else {
        const assignment = await db.assignment.findFirst({
          where: { id: input.assignmentId, userId: user.id },
          select: { id: true },
        });
        if (!assignment) return jsonError(new Error("Assignment not found"), 404);
        data.assignment = { connect: { id: assignment.id } };
      }
    }

    const session = await db.studySession.update({
      where: { id: existing.id },
      data,
      include: { assignment: { include: { course: true } } },
    });
    return jsonOk(session);
  } catch (error) {
    return jsonError(error, 400);
  }
}
