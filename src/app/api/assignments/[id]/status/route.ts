import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { isDemoUser, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";

const updateAssignmentStatusSchema = z.object({
  status: z.enum(["open", "submitted_elsewhere"]),
  note: z.string().max(500).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = await parseJson(request, updateAssignmentStatusSchema);

    if (isDemoUser(user) || !env.DATABASE_URL) {
      return jsonOk({ ok: true, submission: null });
    }

    const db = getDb();
    const assignment = await db.assignment.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!assignment) return jsonError(new Error("Assignment not found"), 404);

    const data =
      input.status === "submitted_elsewhere"
        ? {
            submittedAt: new Date(),
            workflowState: "submitted_elsewhere",
            missing: false,
            late: false,
          }
        : {
            submittedAt: null,
            workflowState: "unsubmitted",
            missing: false,
          };

    const submission = await db.submission.upsert({
      where: { assignmentId: assignment.id },
      create: { assignmentId: assignment.id, ...data },
      update: data,
    });

    await auditLog({
      userId: user.id,
      action: "assignment.status.updated",
      metadata: { assignmentId: assignment.id, status: input.status, note: input.note },
    });

    return jsonOk({ ok: true, submission });
  } catch (error) {
    return jsonError(error, 400);
  }
}
