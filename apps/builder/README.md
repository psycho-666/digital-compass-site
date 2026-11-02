# Digital Compass Builder

Independent Next.js application for the Digital Compass website-builder product. The existing root website and social-media workflows remain separate.

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

The builder schema uses five dedicated tables: `builder_workspaces`, `builder_workspace_members`, `builder_sites`, `builder_pages`, and `builder_page_versions`. All five tables have RLS enabled. Anonymous access is explicitly revoked; authenticated access is governed by workspace policies. Draft versions are append-only. SQL migrations are in `../../supabase/migrations/`.

## Implemented foundation
- Arabic and English interface switching, with persisted language preference and automatic RTL/LTR direction.
- Email/password signup and login using Supabase Auth.
- Editor section insertion, editing, deletion, drag-and-drop ordering, and keyboard-accessible up/down controls.
- Three bilingual starter templates: business/services, portfolio, and restaurant/café.
- Typed page-document schema with runtime validation before persistence.
- Private `builder-media` Storage bucket (10 MB per file; JPEG, PNG, WebP, GIF only) with workspace-member read access and owner/admin/editor write access.
- Desktop/mobile page preview.
- Save creates/reuses the user's default workspace and site, then stores a new locale-specific immutable draft version.

## Not yet production-ready
- Real browser end-to-end tests for signup, login, save, and reload.
- Browser upload UI, image selection/placement, and signed-URL lifecycle for private media.
- Rich block types, visual styling controls, responsive layout editing, and reusable components.
- Published snapshots, public preview URLs, deployment, and custom domains.
- Team invitation and complete role-management workflows.
- Production deployment and operational monitoring.

## Safety and deployment
The builder is developed on `feature/website-builder-foundation`. Do not deploy it through the root GitHub Pages workflow or merge it into `main` until the separate app deployment and end-to-end checks are complete. Keep all Supabase secrets server-side.
