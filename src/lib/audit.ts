import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { redactSecret } from "@/lib/utils";

export async function auditLog(input: {
  userId?: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    const db = getDb();
    await db.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        metadata: input.metadata
          ? JSON.parse(redactSecret(JSON.stringify(input.metadata)))
          : undefined,
      },
    });
  } catch {
    // Audit logging must not break user workflows.
  }
}
