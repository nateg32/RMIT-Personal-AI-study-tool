import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { CanvasClient } from "@/lib/canvas/client";
import { normaliseCanvasBaseUrl } from "@/lib/canvas/url";
import { getDb } from "@/lib/db";
import { cleanPersonName } from "@/lib/display";
import { getCanvasAllowedHosts } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/security/crypto";

const connectSchema = z.object({
  canvasBaseUrl: z.string().url(),
  accessToken: z.string().min(20),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, connectSchema);
    const allowedHosts = getCanvasAllowedHosts();
    const canvasBaseUrl = normaliseCanvasBaseUrl(input.canvasBaseUrl, { allowedHosts });
    const client = new CanvasClient({ baseUrl: canvasBaseUrl, token: input.accessToken, allowedHosts });
    const canvasUser = await client.getCurrentUser();
    const encrypted = encryptSecret(input.accessToken);
    const db = getDb();

    await db.canvasConnection.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        canvasBaseUrl,
        encryptedAccessToken: encrypted.encrypted,
        tokenIv: encrypted.iv,
        tokenAuthTag: encrypted.authTag,
        syncStatus: "idle",
      },
      update: {
        canvasBaseUrl,
        encryptedAccessToken: encrypted.encrypted,
        tokenIv: encrypted.iv,
        tokenAuthTag: encrypted.authTag,
        tokenLastRotatedAt: new Date(),
        syncStatus: "idle",
        syncError: null,
      },
    });

    const canvasName = cleanPersonName(canvasUser.name);
    if (canvasName) {
      await db.user.update({
        where: { id: user.id },
        data: {
          name: canvasName,
          email: canvasUser.primary_email?.toLowerCase() || user.email,
        },
      });
    }

    await auditLog({ userId: user.id, action: "canvas.connected", metadata: { canvasBaseUrl } });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error, 400);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    const db = getDb();

    await db.$transaction([
      db.canvasConnection.deleteMany({ where: { userId: user.id } }),
      db.course.deleteMany({ where: { userId: user.id } }),
      db.syncSnapshot.deleteMany({
        where: {
          userId: user.id,
          type: { in: ["assignment", "announcement", "file", "resource"] },
        },
      }),
    ]);

    await auditLog({
      userId: user.id,
      action: "canvas.disconnected",
      metadata: { clearedSyncedCanvasData: true },
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error, 400);
  }
}
