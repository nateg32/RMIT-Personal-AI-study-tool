# Deployment Guide

## Supabase

Use Supabase Postgres for data and Supabase Auth for private login.

Required variables:

- `DATABASE_URL` or Supabase Marketplace `POSTGRES_PRISMA_URL`
- `DIRECT_URL` or Supabase Marketplace `POSTGRES_URL_NON_POOLING`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Configure magic-link redirects in Supabase Auth to include:

- `http://localhost:3000/auth/callback`
- your Vercel production URL `/auth/callback`

## Vercel

Required variables:

- `ALLOWED_EMAILS`
- `APP_BASE_URL`
- `ENCRYPTION_KEY`
- `CRON_SECRET`
- `GEMINI_API_KEY` if AI generation is enabled
- `GEMINI_MODEL` defaults to `gemini-2.5-flash`; `GEMINI_FALLBACK_MODELS` defaults to `gemini-2.5-flash,gemini-2.5-flash-lite`
- `CANVAS_BASE_URL`
- `CANVAS_ALLOWED_HOSTS`, defaulting to `*.instructure.com`
- `RESEND_API_KEY` if Support Desk ticket emails should be sent
- `SUPPORT_FROM_EMAIL`, defaulting to `RMIT Study Sidekick <support@example.com>`
- `SUPPORT_TO_EMAIL`, defaulting to `support@example.com`

Do not set `DEMO_MODE=true` in production. It is only for local UI previews without Supabase.

Generate `ENCRYPTION_KEY` with 32 random bytes:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Vercel Cron calls `/api/cron/daily-brief`. The route rejects requests unless the `Authorization` header matches `Bearer ${CRON_SECRET}`.

## Database

Run locally:

```bash
npm run prisma:generate
npm run db:push
npm run db:seed
```

For production, run migrations through a controlled release step before promoting a deployment.

After schema changes, apply the Prisma schema to Supabase before using sync:

```bash
npm run prisma:generate
$env:SUPABASE_DB_URL="postgresql://postgres.<project-ref>:<password>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require"
npm run db:push:supabase
```

The current schema stores assignment descriptions, rubric summaries, rubric JSON, synced files, and module resources so the AI can answer with Canvas-backed detail.

Do not use the direct `db.<project-ref>.supabase.co:5432` URL from this Windows workspace unless IPv6 is available. Supabase direct connections resolve to IPv6; the session pooler is IPv4-compatible.
