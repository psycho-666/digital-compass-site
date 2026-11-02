# Repository and Platform Audit — Website Builder

Date: 2026-11-02
Scope: read-only audit of the current GitHub repository and Supabase project.

## Verified repository facts

- Repository: `psycho-666/digital-compass-site`
- Default branch: `main`
- Repository is public; connected GitHub permissions include admin and push.
- The repository root contains static HTML and folders including `admin/`, `website/`, `assets/`, `supabase/`, `ops/`, and `qa/`.
- The customer-facing website entry point `website/index.html` is a static HTML shell. It mounts `#app` and loads multiple JavaScript/CSS assets.
- GitHub Pages workflow `.github/workflows/pages.yml` deploys the repository root directly. This is a static-site deployment pipeline.
- No root `package.json` was present in the repository root listing.
- Existing Supabase Edge Functions are named as GitHub/social worker bridges; no general website-builder API was identified in the inspected function listing.
- The current Supabase migration directory contains one migration file in the inspected listing.

## Verified Supabase facts

- Project: Digital Compass Website (`gaqjrbvhyuylqecwfaoq`)
- PostgreSQL 17.11, project status ACTIVE_HEALTHY.
- 74 public tables; 33 table names match the social workflow prefix.
- Existing `prototype_sites` and `prototypes` tables describe prospect/prototype workflows, not a general customer-owned website builder.

## Reuse assessment

### Reuse with boundaries
- Existing Supabase project can remain the starting point only if the builder receives a separate schema (recommended: `builder`) or a fully isolated set of prefixed tables, explicit RLS, and separate storage policies.
- Existing brand assets and selected UI patterns may be reused after review.
- Existing authentication may be reusable only after auditing the actual auth provider and policies. Do not assume custom admin login code is suitable for customer SaaS authentication.

### Do not reuse as the builder core
- Existing prospect/prototype tables.
- Social media workflows, Meta integrations, worker bridges, and their credentials.
- GitHub Pages as the production hosting mechanism for arbitrary customer websites. It may host the marketing site or internal preview only; customer publishing needs a separate publishing/hosting layer.

## Architecture decision update

The existing repository is a static website and operations application, not a ready-made full-stack SaaS website builder. Do not convert the current GitHub Pages application in place.

Recommended path:
1. Preserve the current application and all social operations.
2. Add a new isolated application under `apps/builder/` (Next.js + TypeScript) on the feature branch, with its own build and deployment pipeline.
3. Keep the current Supabase project for now, but introduce a dedicated `builder` schema, separate storage bucket namespace, and strict RLS after policy review.
4. Use Supabase Auth for customer identity after verifying current Auth configuration; do not reuse custom admin password storage.
5. Build a validated JSON block document model and versioned page storage. Keep editor drafts separate from published snapshots.
6. Treat custom-domain routing, SSL, CDN, and customer site publishing as a separate infrastructure workstream; GitHub Pages is not the final customer hosting architecture.

## Security checks still required before any database write

- Inventory RLS enabled state and policies for all public tables.
- Inspect grants, functions, triggers, and storage buckets/policies.
- Confirm Supabase Auth settings and existing user identity model.
- Verify secrets are not committed to repository history or exposed in frontend bundles.
- Review branch deployment and environment secret handling.

## Current action status

Read-only audit completed for repository structure, static deployment workflow, selected Supabase schema metadata, and existing migration/function directory listings. No production data or schema was modified.
