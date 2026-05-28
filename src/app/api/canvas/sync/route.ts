import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { syncCanvasForUser } from "@/lib/canvas/sync";
import { rateLimit } from "@/lib/rate-limit";

export async function POST() {
  try {
    const user = await requireUser();
    const allowed = rateLimit(`sync:${user.id}`, 5, 60_000);
    if (!allowed.ok) return jsonError(new Error("Too many sync requests"), 429);
    const summary = await syncCanvasForUser(user);
    await auditLog({ userId: user.id, action: "canvas.synced", metadata: summary });
    return jsonOk(summary);
  } catch (error) {
    return jsonError(error, 500);
  }
}
