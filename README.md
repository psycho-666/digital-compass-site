# Digital Compass — Social Edition

Clean rebuild of the internal social-media management and business-development workspace.

## Scope
- Prospect discovery, audits, lead qualification, CRM and client management.
- Social account connections, unified messages/comments inbox, content calendar and reporting.
- Client-specific knowledge base, AI-assisted responses and controlled automation.
- Arabic-first interface with English support, RTL/LTR and English numerals.

This branch is **Social Edition only**. It does not contain the separate website-builder product.

## Current implementation baseline
- Next.js App Router + TypeScript.
- Supabase Auth, PostgreSQL and Row Level Security.
- Initial database schema: `supabase/migrations/20261119090000_initial_clean_social_edition.sql`.
- Existing administrator accounts were retained during reset.
- Old Meta access tokens and internal secrets were deleted. The 078 Page is a reference only and requires fresh OAuth authorization.
- Old prospects, inbox messages, webhook events, content, clients and operational records were cleared.

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `/login` and sign in using an existing Supabase Auth account.

Never place service-role keys, Meta app secrets, webhook verification tokens, or access tokens in browser-exposed variables.

## Rebuild references
Historical source and non-secret setup notes are preserved in branch `archive/social-edition-reference-2026-11-19`. The prospect discovery engine is preserved in its own archive branch.

## Status
The application shell, authentication entry, dashboard, clients, leads, inbox, content, tasks, reports, automations and integration settings pages are scaffolded. Meta OAuth, webhook delivery, write workflows, AI, publishing, analytics and automation execution still require implementation and end-to-end tests.
