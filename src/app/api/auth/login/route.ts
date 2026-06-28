import { z } from "zod";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { env, getAllowedEmails, isDemoModeEnabled } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
});

function getEmailRedirectUrl(request: Request) {
  const baseUrl = env.APP_BASE_URL || new URL(request.url).origin;
  return new URL("/auth/callback", baseUrl).toString();
}

export async function POST(request: Request) {
  try {
    const { email } = await parseJson(request, loginSchema);
    const allowed = getAllowedEmails();
    const normalized = email.toLowerCase();
    if (allowed.size > 0 && !allowed.has(normalized)) {
      return jsonError(new Error("Email is not allowed"), 403);
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      if (!isDemoModeEnabled()) {
        return jsonError(new Error("Supabase auth is not configured"), 503);
      }
      return jsonOk({
        ok: true,
        demo: true,
        message: "Supabase is not configured; local demo mode is active.",
      });
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        emailRedirectTo: getEmailRedirectUrl(request),
      },
    });
    if (error) throw error;
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error, 400);
  }
}
