# Security Model

## Secrets

- Do not commit `.env.local`, Canvas tokens, Supabase service keys, Gemini keys, or Vercel tokens.
- Canvas tokens are encrypted with `ENCRYPTION_KEY` before being saved.
- Logs and API errors redact long token-shaped strings.

## Auth

- Supabase Auth controls dashboard access in production.
- `ALLOWED_EMAILS` restricts the private app to approved accounts.
- API routes call `requireUser()` and database queries are scoped by `userId`.

## AI Safety

- Gemini is never the source of truth for Canvas facts.
- The backend supplies facts from the database.
- Canvas content is untrusted and must not alter system rules.
- The model cannot submit assignments or mutate Canvas in v1.

## Canvas Safety

- Canvas is read-only in v1.
- API sync is sequential and handles pagination/rate limits.
- Tokens pasted into chat or screenshots should be revoked/regenerated.
