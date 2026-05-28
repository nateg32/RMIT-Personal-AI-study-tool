import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard";

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk(await getDashboardData(user));
  } catch (error) {
    return jsonError(error, 401);
  }
}
