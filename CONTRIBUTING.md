# Contributing

Thanks for improving RMIT Personal AI Study Tool.

## Local Workflow

```bash
npm ci
cp .env.example .env.local
npm run prisma:generate
npm run test
npm run lint
```

Use `DEMO_MODE=true` only for local UI previews without Supabase. Do not enable demo mode in production.

## Security Expectations

- Do not commit secrets, `.env.local`, screenshots with tokens, or real student data.
- Keep Canvas API access read-only.
- Keep user data scoped by `userId`.
- Sanitize or strip Canvas HTML before rendering or passing it into model prompts.
- Add or update tests for auth, token handling, external URL handling, uploads, and model fallbacks when touching those areas.

## Pull Request Checklist

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm audit --audit-level=moderate`

For changes that affect login, Canvas sync, uploads, support tickets, or model prompts, include the relevant security reasoning in the PR description.
