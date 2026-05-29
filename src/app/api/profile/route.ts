import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { cleanPersonName } from "@/lib/display";

const profileSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, profileSchema);
    const name = cleanPersonName(input.name);
    if (!name) return jsonError(new Error("Enter a real display name."), 400);

    const updated = await getDb().user.update({
      where: { id: user.id },
      data: { name },
      select: { id: true, name: true, email: true, timezone: true },
    });

    await auditLog({
      userId: user.id,
      action: "profile.updated",
      metadata: { field: "name" },
    });

    return jsonOk(updated);
  } catch (error) {
    return jsonError(error, 400);
  }
}
