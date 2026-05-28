import { cache } from "react";
import type { User } from "@prisma/client";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
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
  return db.user.upsert({
    where: { email },
    create: {
      email,
      name: data.user.user_metadata?.name || email.split("@")[0] || "Student",
      supabaseUserId: data.user.id,
      timezone: "Australia/Sydney",
    },
    update: {
      supabaseUserId: data.user.id,
      name: data.user.user_metadata?.name || undefined,
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
