import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { CanvasClient } from "@/lib/canvas/client";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/security/crypto";
import { normaliseBaseUrl } from "@/lib/utils";

const connectSchema = z.object({
  canvasBaseUrl: z.string().url(),
  accessToken: z.string().min(20),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, connectSchema);
    const canvasBaseUrl = normaliseBaseUrl(input.canvasBaseUrl);
    const client = new CanvasClient({ baseUrl: canvasBaseUrl, token: input.accessToken });
    await client.getCurrentUser();
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

    await auditLog({ userId: user.id, action: "canvas.connected", metadata: { canvasBaseUrl } });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error, 400);
  }
}
