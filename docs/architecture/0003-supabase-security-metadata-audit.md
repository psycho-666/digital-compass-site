# Supabase Security Metadata Audit — Website Builder Baseline

Date: 2026-11-02
Project: gaqjrbvhyuylqecwfaoq

Read-only metadata checks only. No data rows, secrets, or credentials were queried.

## Results

- Public tables: 74
- Tables with RLS enabled: 74
- Tables without RLS: 0
- Policies in public schema: 10
- Storage buckets: 0

The 10 policies are distributed one each across:
- automation_runs
- discovery_requests
- outreach_drafts
- project_settings
- prospects
- prototypes
- website_legacy_admin_users
- website_legacy_audits
- website_legacy_opportunities
- website_settings

The remaining 64 public tables have RLS enabled but no policies visible in pg_policies. Under normal Supabase client access, RLS with no matching policy is default-deny; however, service-role credentials bypass RLS. This audit did not verify every role grant, security-definer function, or Edge Function code path, so this is not a complete security certification.

## Implications for the new builder

1. Do not add builder tables to public by default. Prefer a dedicated `builder` schema and grant only the minimum required API access.
2. Define explicit tenant membership policies before enabling customer-facing access.
3. Keep privileged operations in narrowly scoped server-side functions; never expose service-role keys to browser code.
4. Storage currently has no buckets. Design a new private bucket and tenant-scoped object paths only after ownership policies are ready.
5. Review existing functions, grants, and storage configuration before reusing the project for customer SaaS.

## No-change confirmation

This audit used catalog metadata only. No schema, RLS policy, storage bucket, user, or application data was changed.
