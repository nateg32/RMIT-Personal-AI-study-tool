# Security Model

The root `SECURITY.md` is the canonical security policy. This page keeps the implementation model close to the project docs.

## Secrets

- Do not commit `.env.local`, Canvas tokens, Supabase service keys, Gemini keys, Resend keys, database URLs, or Vercel tokens.
- Canvas tokens are encrypted with `ENCRYPTION_KEY` before storage.
- `ENCRYPTION_KEY` must be a 32-byte base64 value.
- Logs, API errors, audit metadata, and stored sync errors redact long token-shaped strings.

## Auth

- Supabase Auth controls dashboard access in production.
- `ALLOWED_EMAILS` restricts the private app to approved accounts.
- `DEMO_MODE=true` is required for local demo access without Supabase.
- API routes call `requireUser()` and database queries are scoped by `userId`.

## Canvas Safety

- Canvas access is read-only in v1.
- Canvas base URLs must be HTTPS origins and must match `CANVAS_ALLOWED_HOSTS`.
- Canvas pagination links must stay on the configured Canvas origin before bearer tokens are sent.
- Tokens pasted into chat, screenshots, logs, or commits should be revoked and regenerated.

## Model Safety

- Gemini is never the source of truth for Canvas facts.
- The backend supplies facts from the database.
- Canvas content is untrusted and must not alter system rules.
- The model cannot submit assignments or mutate Canvas in v1.
