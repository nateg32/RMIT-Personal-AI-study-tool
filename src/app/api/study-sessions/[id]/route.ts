import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const updateSchema = z.object({
  status: z.string().min(2).optional(),
  generatedPlanJson: z.unknown().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = await parseJson(request, updateSchema);
    const db = getDb();
    const data: Prisma.StudySessionUpdateManyMutationInput = {};
    if (input.status) data.status = input.status;
    if (input.generatedPlanJson !== undefined) {
      data.generatedPlanJson = input.generatedPlanJson as Prisma.InputJsonValue;
    }

    await db.studySession.updateMany({
      where: { id, userId: user.id },
      data,
    });
    const session = await db.studySession.findFirstOrThrow({ where: { id, userId: user.id } });
    return jsonOk(session);
  } catch (error) {
    return jsonError(error, 400);
  }
}
