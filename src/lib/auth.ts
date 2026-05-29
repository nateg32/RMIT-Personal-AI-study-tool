import { cache } from "react";
import type { User } from "@prisma/client";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { cleanPersonName } from "@/lib/display";
import { getAllowedEmails, isProductionRuntime, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

const demoUser = {
  id: "demo-user",
  supabaseUserId: null,
  name: "Nathaniel",
  email: "s4169571@student.rmit.edu.au",
  timezone: "Australia/Sydney",
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies User;

function metadataName(metadata: Record<string, unknown> | null | undefined) {
  return (
    cleanPersonName(metadata?.name) ||
    cleanPersonName(metadata?.full_name) ||
    cleanPersonName(metadata?.display_name)
  );
}

export const getCurrentUser = cache(async (): Promise<User> => {
  const allowed = getAllowedEmails();

  if (!isSupabaseConfigured()) {
    if (isProductionRuntime()) {
      throw new Error("Supabase auth must be configured in production");
    }
    return demoUser;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!.auth.getUser();
  if (error || !data.user?.email) throw new AuthenticationRequiredError();

  const email = data.user.email.toLowerCase();
  if (allowed.size > 0 && !allowed.has(email)) {
    throw new Error("This email is not allowed for the private dashboard");
  }

  const db = getDb();
  const authName = metadataName(data.user.user_metadata);
  return db.user.upsert({
    where: { email },
    create: {
      email,
      name: authName || "Student",
      supabaseUserId: data.user.id,
      timezone: "Australia/Sydney",
    },
    update: {
      supabaseUserId: data.user.id,
      name: authName || undefined,
    },
  });
});

export async function requireUser() {
  return getCurrentUser();
}

export async function requirePageUser() {
  try {
    return await getCurrentUser();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login");
    }
    throw error;
  }
}

export function isDemoUser(user: User) {
  return user.id === demoUser.id;
}
