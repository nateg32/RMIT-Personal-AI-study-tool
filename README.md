# RMIT Personal AI Study Tool

A private Canvas intelligence dashboard for turning Canvas data into daily execution: due work, unsubmitted assignments, announcements, files, AI study sessions, and daily briefs.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + small shadcn-style UI primitives
- Supabase Auth + Supabase Postgres
- Prisma ORM
- Gemini structured output for briefs and study sessions
- Vercel Cron for daily brief generation

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment values:

```bash
cp .env.example .env.local
```

3. Fill in:

- `DATABASE_URL` and `DIRECT_URL` from Supabase Postgres
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `ALLOWED_EMAILS`
- `ENCRYPTION_KEY`
- optional `GEMINI_API_KEY`
- optional `GEMINI_MODEL` defaults to `gemini-3.1-pro-preview`
- optional local-only `CANVAS_ACCESS_TOKEN`

Generate a 32-byte encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

4. Prepare database:

```bash
npm run prisma:generate
npm run db:push
npm run db:seed
```

5. Start:

```bash
npm run dev
```

## Security Notes

- Canvas tokens are encrypted at rest with AES-256-GCM.
- Canvas and Gemini secrets are only read on the server.
- The frontend never receives Canvas tokens or Gemini keys.
- Canvas data is read-only in v1.
- Raw Canvas HTML is sanitized or stripped before display/model use.
- Assignment chat/study-session answers are grounded in synced assignment descriptions, rubric summaries, files, and module resources when Canvas provides them.
- All production access should be protected by Supabase Auth and `ALLOWED_EMAILS`.
- Regenerate any Canvas token that was pasted into chat, screenshots, logs, or commits.

## Vercel Deployment

1. Connect the GitHub repo to Vercel.
2. Install/connect Supabase via Vercel Marketplace or manually add Supabase env vars.
3. Add all secrets from `.env.example` to Vercel Project Settings.
4. Set a strong `CRON_SECRET`; Vercel sends it as `Authorization: Bearer <secret>`.
5. Deploy. The daily brief cron is configured in `vercel.json`.

The cron schedule is `0 21 * * *` UTC, which is 8 AM or 7 AM Sydney time depending on daylight saving. Adjust the schedule if you want a different morning time.

## Commands

```bash
npm run lint
npm run test
npm run build
npm run e2e
```

## SaaS Path

The app starts as a private dashboard. To make it SaaS-style later, keep the current user-scoped data model, add onboarding for user-provided Canvas tokens, then pursue Canvas OAuth/developer-key approval for true “Sign in with Canvas”.
