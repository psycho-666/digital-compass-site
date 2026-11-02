# Digital Compass Builder

Independent Next.js application for the website-builder product. Existing root website and social-media workflows remain separate.

## Run locally
```bash
cd apps/builder
npm install
cp .env.example .env.local
npm run dev
```
Open http://localhost:3000.

## Supabase setup
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Never place a service-role or secret key in a `NEXT_PUBLIC_` variable.

The builder schema uses five dedicated tables: `builder_workspaces`, `builder_workspace_members`, `builder_sites`, `builder_pages`, and `builder_page_versions`. All five tables have RLS enabled. Access is restricted to authenticated workspace members; draft versions are append-only. SQL migrations are in `../../supabase/migrations/`.

## Current implementation
- Arabic-first RTL editor with section insertion, editing, deletion, and desktop/mobile preview.
- Email/password signup and login using Supabase Auth.
- Save creates/reuses the user's default workspace, site and home page, then stores a new immutable draft version.
- Templates, media storage, publishing, custom domains, billing, and English UI are not implemented yet.

## Important
The editor currently saves one starter site (`my-first-site`) and one Arabic home page. It is an initial persistence vertical slice, not a production-ready website-builder yet. Run a full local build and end-to-end auth/save tests before deployment.
