# RMIT Personal AI Study Tool

An unofficial RMIT-focused Canvas study dashboard that turns course data into a practical daily plan: due work, unsubmitted assignments, announcements, course files, study sessions, and daily briefs.

This project is not affiliated with, endorsed by, or sponsored by RMIT University, Instructure, Canvas, Google, Supabase, Vercel, or Resend.

## What It Does

- Syncs read-only Canvas course, assignment, announcement, file, module, and rubric metadata.
- Encrypts Canvas access tokens at rest with AES-256-GCM.
- Uses Supabase Auth and an optional `ALLOWED_EMAILS` allowlist for private access.
- Generates grounded study plans and daily briefs from synced Canvas facts.
- Keeps Canvas write access out of scope: the app does not submit assignments or mutate Canvas.
- Supports local demo mode only when `DEMO_MODE=true` is explicitly set.

## Stack

- Next.js App Router, React, and TypeScript
- Tailwind CSS and lightweight UI primitives
- Supabase Auth and Supabase Postgres
- Prisma ORM
- Gemini structured output for study plans and daily briefs
- Vercel Cron for scheduled daily brief generation
- Vitest and Playwright for regression coverage

## Local Setup

Install dependencies from the committed lockfile:

```bash
npm ci
```

Copy the example environment file:

```bash
cp .env.example .env.local
```

For a database-backed local app, fill in Supabase and Prisma values, then run:

```bash
npm run prisma:generate
npm run db:push
npm run db:seed
npm run dev
```

For a UI-only local preview without Supabase, set:

```bash
DEMO_MODE=true
```

Generate a production-safe encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Environment

See `.env.example` for every supported variable. Production deployments should set at minimum:

- `DATABASE_URL` and `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `ALLOWED_EMAILS`
- `APP_BASE_URL`
- `ENCRYPTION_KEY`
- `CRON_SECRET`
- `CANVAS_BASE_URL`

Optional integrations:

- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`
- `RESEND_API_KEY`, `SUPPORT_FROM_EMAIL`, `SUPPORT_TO_EMAIL`
- `CANVAS_ALLOWED_HOSTS` for non-default Canvas domains
- Local-only `CANVAS_ACCESS_TOKEN` for private development

## Security Defaults

- Canvas base URLs must be HTTPS origins and must match the configured Canvas host allowlist.
- Canvas pagination is same-origin only, so bearer tokens are never sent to off-origin `Link` headers.
- Canvas tokens, Gemini keys, Resend keys, Supabase service keys, and cron secrets are server-only.
- Raw Canvas HTML is sanitized or stripped before display, storage summaries, and model prompts.
- Production API 500 responses are generic, while server-side logs and stored sync errors redact token-shaped strings.
- `package.json` stays `private: true`; this repository is open source, but the app is not intended for npm publication.

If a Canvas token, API key, or database credential has ever been pasted into chat, screenshots, logs, or commits, revoke and regenerate it before deploying publicly.

## Commands

```bash
npm run lint
npm run test
npm run test:coverage
npm run build
npm run e2e
npm audit --audit-level=moderate
```

## Deployment

The Vercel cron schedule in `vercel.json` calls `/api/cron/daily-brief` at `0 21 * * *` UTC, which is morning in Sydney depending on daylight saving. Set `CRON_SECRET`; the route requires `Authorization: Bearer <secret>`.

See `docs/DEPLOYMENT.md`, `docs/PRIVACY.md`, and `SECURITY.md` before publishing a live deployment.

## License

MIT. See `LICENSE`.
