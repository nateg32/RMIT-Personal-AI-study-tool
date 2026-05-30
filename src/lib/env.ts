import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
  POSTGRES_PRISMA_URL: z.string().optional(),
  POSTGRES_URL_NON_POOLING: z.string().optional(),
  SUPABASE_URL: optionalUrl,
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  ALLOWED_EMAILS: z.string().optional(),
  APP_BASE_URL: optionalUrl,
  CANVAS_BASE_URL: optionalUrl.default("https://rmit.instructure.com"),
  CANVAS_ACCESS_TOKEN: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.1-pro-preview"),
  RESEND_API_KEY: z.string().optional(),
  SUPPORT_FROM_EMAIL: z.string().optional(),
  SUPPORT_TO_EMAIL: z.string().email().optional().or(z.literal("")),
  CRON_SECRET: z.string().optional(),
  VERCEL: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  DATABASE_URL:
    parsedEnv.DATABASE_URL || parsedEnv.POSTGRES_PRISMA_URL || parsedEnv.POSTGRES_URL,
  DIRECT_URL:
    parsedEnv.DIRECT_URL || parsedEnv.POSTGRES_URL_NON_POOLING || parsedEnv.POSTGRES_URL,
  NEXT_PUBLIC_SUPABASE_URL:
    parsedEnv.NEXT_PUBLIC_SUPABASE_URL || parsedEnv.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    parsedEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    parsedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    parsedEnv.SUPABASE_PUBLISHABLE_KEY ||
    parsedEnv.SUPABASE_ANON_KEY,
  SUPABASE_SECRET_KEY: parsedEnv.SUPABASE_SECRET_KEY || parsedEnv.SUPABASE_SERVICE_ROLE_KEY,
};

export function isSupabaseConfigured() {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function isProductionRuntime() {
  return env.NODE_ENV === "production" || env.VERCEL === "1";
}

export function getAllowedEmails() {
  return new Set(
    (env.ALLOWED_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function requireEnv(name: keyof typeof env) {
  const value = env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
