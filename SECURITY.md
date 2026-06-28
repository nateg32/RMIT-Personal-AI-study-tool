# Security Policy

## Supported Versions

The `main` branch is the supported development line.

## Reporting a Vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting if it is enabled on the repository, or contact the maintainer privately through the repository owner profile.

Include:

- affected route, file, or feature
- reproduction steps
- expected impact
- whether any token, credential, or personal academic data may be involved

## Security Model

- Supabase Auth controls production dashboard access.
- `ALLOWED_EMAILS` can restrict access to approved accounts.
- Local demo access is disabled unless `DEMO_MODE=true`.
- API routes call `requireUser()` and database queries are scoped by `userId`.
- Canvas tokens are encrypted with `ENCRYPTION_KEY` before storage.
- Canvas base URLs must be HTTPS origins and must match the configured host allowlist.
- Canvas pagination is same-origin only, so bearer tokens are not sent to attacker-selected hosts.
- Raw Canvas HTML is sanitized or stripped before display, summaries, and model prompts.
- Gemini receives Canvas-backed study context, never Canvas tokens or API keys.
- Canvas is read-only in v1. The app does not submit assignments or mutate Canvas.

## Secret Handling

Never commit:

- `.env.local` or production env files
- Canvas access tokens
- Supabase service role keys
- Gemini keys
- Resend keys
- Vercel tokens
- database URLs containing credentials

If a secret is committed, pasted into chat, shown in a screenshot, or written to logs, revoke and rotate it before publishing or deploying.
