import { jsonOk } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  return jsonOk({ ok: true });
}
