import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { finishCanvasSyncForUser } from "@/lib/canvas/sync";

export const maxDuration = 30;

const bodySchema = z.object({
  syncError: z.string().max(500).nullable().optional(),
  successfulCourses: z.number().int().nonnegative().optional(),
  totalCourses: z.number().int().nonnegative().optional(),
  changeCount: z.number().int().nonnegative().optional(),
  warnings: z.array(z.string().max(500)).max(20).optional(),
});

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireUser>> | null = null;
  try {
    user = await requireUser();
    const body = await parseJson(request, bodySchema);
    const summary = await finishCanvasSyncForUser(user, { syncError: body.syncError });
    await auditLog({
      userId: user.id,
      action: summary.ok ? "canvas.synced" : "canvas.sync_failed",
      metadata: { ...body, ...summary },
    });
    return jsonOk(summary);
  } catch (error) {
    if (user?.id) {
      await auditLog({
        userId: user.id,
        action: "canvas.sync_failed",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown Canvas sync finish error",
        },
      });
    }
    return jsonError(error, 500);
  }
}
