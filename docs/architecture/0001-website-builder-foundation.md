# Digital Compass Website Builder — Architecture Decision Record 0001

Status: Proposed foundation
Date: 2026-11-02

## Product boundary

Build a multi-tenant SaaS website builder under the Digital Compass brand. This product is distinct from the existing social-media management edition. Existing social-media workflows, tables, integrations, and production data must remain unchanged.

## Audit findings

- GitHub repository: psycho-666/digital-compass-site
- Existing Supabase project: Digital Compass Website (gaqjrbvhyuylqecwfaoq), PostgreSQL 17.
- The current database has 74 public tables; 33 are social-workflow tables.
- Existing website-related tables such as prototype_sites and prototypes model prospect/prototype generation, not a general customer-owned website builder.
- Do not repurpose or delete these tables as part of the builder foundation.

## Proposed application architecture

1. Keep the current repository and Supabase project as the audited starting point, but isolate new builder code and data from social-management modules.
2. Use a modular monolith initially: one deployable application with explicit modules for identity, workspaces, sites, pages, editor documents, assets, publishing, domains, billing, analytics, and AI generation.
3. Use PostgreSQL as the source of truth. Every tenant-owned record must carry a workspace/site ownership path and be protected by RLS.
4. Store editable page content as versioned JSON documents built from a validated component/block schema. Never store arbitrary executable HTML/JS as trusted editor content.
5. Render published sites through a separate public rendering path from the authenticated editor. Draft changes must not alter the live version until publish succeeds.
6. Keep media in object storage with tenant-scoped paths and policies.
7. Use a publishing adapter so hosting/CDN implementation can evolve without coupling the editor to one provider.
8. Support Arabic RTL and English LTR as first-class document and theme settings, including per-site locale configuration.
9. Add AI generation as a provider-neutral service that outputs validated page/block documents; AI output must pass schema validation before persistence or publishing.

## Initial domain model

- builder_workspaces
- builder_workspace_members
- builder_sites
- builder_site_domains
- builder_pages
- builder_page_versions
- builder_assets
- builder_themes
- builder_templates
- builder_publish_jobs
- builder_subscriptions
- builder_usage_events

All new builder tables should be introduced through reviewed migrations, have RLS enabled, and use explicit owner/member authorization policies. Public rendering should expose only published content through a deliberately designed read path.

## Delivery sequence

1. Repository and deployment audit (entry points, framework, environment variables, build/deploy pipeline).
2. Supabase security and schema audit (RLS policies, grants, storage buckets, functions, triggers, extensions).
3. Define and test the builder data model and tenant isolation.
4. Implement site/page CRUD and versioned document storage.
5. Implement block renderer and editor.
6. Implement templates, media, publishing, custom domains, billing, analytics, and AI in separately testable modules.

## Non-goals for the foundation

- No deletion or renaming of existing tables.
- No changes to Meta/social integrations.
- No live schema changes until the security and ownership model has been reviewed.
- No claim of production-ready hosting, billing, or custom-domain support until implemented and verified.
