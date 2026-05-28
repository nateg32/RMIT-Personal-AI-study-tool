import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

function publicUrl(path: string) {
  return new URL(path, env.APP_BASE_URL || "http://localhost:3000");
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const queryError = requestUrl.searchParams.get("error");
  const errorDescription =
    requestUrl.searchParams.get("error_description") || "The sign-in link could not be verified.";
  const supabase = await createSupabaseServerClient();

  if (queryError) {
    const loginUrl = publicUrl("/login");
    loginUrl.searchParams.set("error", errorDescription);
    return NextResponse.redirect(loginUrl);
  }

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const loginUrl = publicUrl("/login");
      loginUrl.searchParams.set("error", error.message);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.redirect(publicUrl("/dashboard"));
}
