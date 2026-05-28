import { z } from "zod";
import { jsonError, jsonOk, parseJson } from "@/lib/api";
import { getAllowedEmails } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const verifyOtpSchema = z.object({
  email: z.string().email(),
  token: z.string().trim().regex(/^\d{6,10}$/, "Enter the numeric code from your email"),
});

export async function POST(request: Request) {
  try {
    const { email, token } = await parseJson(request, verifyOtpSchema);
    const allowed = getAllowedEmails();
    const normalized = email.toLowerCase();

    if (allowed.size > 0 && !allowed.has(normalized)) {
      return jsonError(new Error("Email is not allowed"), 403);
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return jsonOk({ ok: true, demo: true, redirectTo: "/dashboard" });
    }

    const { error } = await supabase.auth.verifyOtp({
      email: normalized,
      token,
      type: "email",
    });

    if (error) throw error;
    return jsonOk({ ok: true, redirectTo: "/dashboard" });
  } catch (error) {
    return jsonError(error, 400);
  }
}
