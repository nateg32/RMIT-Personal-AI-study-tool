import { jsonError, jsonOk } from "@/lib/api";
import { checkGeminiConnection } from "@/lib/ai/gemini";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    await requireUser();
    return jsonOk(await checkGeminiConnection());
  } catch (error) {
    return jsonError(error, 401);
  }
}
