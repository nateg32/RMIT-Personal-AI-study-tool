import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";

export async function GET() {
  try {
    const user = await requireUser();
    if (!env.DATABASE_URL) return jsonOk({ brief: null });
    const db = getDb();
    const brief = await db.dailyBrief.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({ brief });
  } catch (error) {
    return jsonError(error, 401);
  }
}
