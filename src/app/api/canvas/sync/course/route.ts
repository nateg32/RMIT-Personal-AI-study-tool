import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { syncCanvasCourseForUser } from "@/lib/canvas/sync";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const bodySchema = z.object({
  canvasCourseId: z.number().int().positive(),
  includeResources: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireUser>> | null = null;
  try {
    user = await requireUser();
    const allowed = rateLimit(`sync-course:${user.id}`, 90, 60_000);
    if (!allowed.ok) return jsonError(new Error("Too many course sync requests"), 429);

    const body = await parseJson(request, bodySchema);
    const summary = await syncCanvasCourseForUser(user, body.canvasCourseId, {
      includeResources: body.includeResources,
    });
    await auditLog({
      userId: user.id,
      action: "canvas.course_synced",
      metadata: {
        course: summary.course,
        assignments: summary.assignments,
        changeCount: summary.changes.length,
        warnings: summary.warnings,
      },
    });
    return jsonOk(summary);
  } catch (error) {
    if (user?.id) {
      await auditLog({
        userId: user.id,
        action: "canvas.course_sync_failed",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown Canvas course sync error",
        },
      });
    }
    return jsonError(error, 500);
  }
}
