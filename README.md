# Digital Compass — Social Edition

A bilingual Arabic/English social-media workspace for managing Facebook Pages and connected Instagram accounts.

## Current foundation

- React 19 + TypeScript + Vite 7
- Supabase Auth with password and email-link sign-in
- Owner-scoped PostgreSQL schema with Row Level Security
- Private schema for page access tokens; browser roles cannot read credentials
- Meta OAuth flow with signed, expiring state
- Meta webhook receiver with HMAC signature validation
- Inbox, comment replies, content drafts/scheduling records, and keyword automation screens
- Arabic RTL and English LTR layouts

## Social modules

- **Overview:** workspace activity and account status
- **Connected accounts:** Meta OAuth and Facebook/Instagram page discovery
- **Inbox:** conversations and replies through the Meta messaging API
- **Comments:** receive comments and reply from the workspace
- **Content planner:** save drafts and scheduled-post records
- **Automation:** keyword rules; enabled rules can auto-reply to new matching comments
- **AI assistant:** UI placeholder until an AI provider key is configured

## Supabase

Project ref: `xnoalyxxrjyovivdeojo`

Core tables: `profiles`, `connected_pages`, `conversations`, `messages`, `comments`, `scheduled_posts`, `automation_rules`, `activity_logs`.

Page tokens are stored only in `private.page_credentials`. All exposed public tables have RLS enabled and owner-scoped policies. Composite foreign keys prevent cross-user page/conversation references.

Edge Functions:
- `social-oauth`
- `social-meta-webhook`
- `social-management-api`

Old prototype endpoints remain retired and return HTTP 410.

## Environment

Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Supabase Edge Function secrets required for Meta activation:
- `META_APP_SECRET` — Meta App Secret (never commit or expose it)
- `META_WEBHOOK_VERIFY_TOKEN` — private verification string shared with Meta Webhooks
- `FRONTEND_URL` — final Social Edition origin for OAuth redirects and CORS

Meta App ID currently configured in the OAuth function: `1460593969264285`.

OAuth redirect URI:
`https://xnoalyxxrjyovivdeojo.supabase.co/functions/v1/social-oauth?action=callback`

Webhook callback:
`https://xnoalyxxrjyovivdeojo.supabase.co/functions/v1/social-meta-webhook`

## Local-only setup (Windows)

This application runs privately on your own computer. Vercel is not required and no public frontend deployment is part of this setup.

1. Install Node.js LTS (https://nodejs.org/) and Git (https://git-scm.com/downloads/win).
2. Open PowerShell and run:

```powershell
git clone --branch social-edition-rebuild https://github.com/psycho-666/digital-compass-site.git
cd digital-compass-site
Copy-Item .env.example .env.local
npm install
npm run dev
```

3. Open http://127.0.0.1:5173 in your browser. The development server binds to localhost only.
4. Keep `.env.local` private; it is excluded from Git.

The Supabase publishable key in `.env.example` is designed for browser use. Never put the service-role key or Meta App Secret in frontend files.

## Local build check

```powershell
npm run build
npm audit
```

This branch is isolated from the Website Edition on `main`.
