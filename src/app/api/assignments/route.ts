import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getAssignmentsForUser } from "@/lib/data/lists";

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk(await getAssignmentsForUser(user));
  } catch (error) {
    return jsonError(error, 401);
  }
}
