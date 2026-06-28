import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prepareCanvasSyncForUser } from "@/lib/canvas/sync";
import { rateLimit } from "@/lib/rate-limit";
import { redactSecret } from "@/lib/utils";

export const maxDuration = 60;

export async function POST() {
  let user: Awaited<ReturnType<typeof requireUser>> | null = null;
  try {
    user = await requireUser();
    const allowed = rateLimit(`sync:${user.id}`, 5, 60_000);
    if (!allowed.ok) return jsonError(new Error("Too many sync requests"), 429);
    const summary = await prepareCanvasSyncForUser(user);
    await auditLog({ userId: user.id, action: "canvas.sync_started", metadata: summary });
    return jsonOk(summary);
  } catch (error) {
    if (user?.id) {
      await auditLog({
        userId: user.id,
        action: "canvas.sync_failed",
        metadata: {
          error: redactSecret(error instanceof Error ? error.message : "Unknown Canvas sync error"),
        },
      });
    }
    return jsonError(error, 500);
  }
}
