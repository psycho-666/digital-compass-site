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
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Public form submissions also require `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable. Never place a service-role or secret key in a `NEXT_PUBLIC_` variable or commit its value.

The builder schema uses seven dedicated tables: `builder_workspaces`, `builder_workspace_members`, `builder_sites`, `builder_pages`, `builder_page_versions`, `builder_form_submissions`, and `builder_form_rate_limits`. All seven tables have RLS enabled. Anonymous access to builder data and form submissions is explicitly restricted; authenticated access is governed by workspace policies. Draft versions are append-only. SQL migrations are in `../../supabase/migrations/`.

## Implemented foundation
- Arabic and English interface switching, with persisted language preference and automatic RTL/LTR direction.
- Email/password signup and login using Supabase Auth.
- Editor section insertion, editing, deletion, drag-and-drop ordering, keyboard-accessible up/down controls, per-section text alignment and background colors, editable hero call-to-action labels and safe destinations, and testimonial sections.
- Seven editable section types (hero, text, services/features, testimonials, image-with-caption, multi-image gallery, and contact/reservation forms) plus three bilingual starter templates: business/services, portfolio, and restaurant/café, each with its own color and typography preset. Testimonial template content is clearly marked as placeholder copy to be replaced with genuine customer feedback.
- Typed page-document schema with runtime validation before persistence.
- Private `builder-media` Storage bucket (10 MB per file; JPEG, PNG, WebP, GIF only) with workspace-member read access and owner/admin/editor write access.
- Section and gallery image uploads stored under workspace/site paths; gallery supports up to 30 images per block, multiple-file upload, removal, and reordering. Editor previews use one-hour signed URLs. Save the site once before uploading its first image.
- Public contact and reservation forms submit through a server route using a server-only service-role client into a private submissions table. The RPC is restricted to `service_role`; the public browser cannot call it directly. Database checks enforce published-form existence, field limits, a honeypot, a 1.5-second minimum completion time, and a limit of five submissions per IP/site per 15 minutes. Only workspace owners and admins can read submissions through authenticated database access; the editor links to a private inbox showing the latest 100 requests. The rate-limit table has no client privileges and an explicit deny-all RLS policy. Configure the hosting proxy to overwrite trusted client-IP headers before enabling public forms in production.
- Desktop/mobile page preview.
- Page-level theme controls for accent, background, and text colors plus modern/classic typography; theme settings are validated and saved with each page version.
- Multi-page site management: create, switch, reorder, and delete pages; published pages appear in the public navigation, with a language switch when a translated page is also published.
- Save-then-publish flow backed by an atomic, invoker-secured database operation; only the newest selected version remains published while a new draft is edited.
- Public website routes at `/sites/<site-slug>` (default locale home) and `/sites/<site-slug>/<locale>/<page-slug>`; anonymous reads are limited by RLS to published pages and published versions only.
- Published page images are still stored in the private media bucket; anonymous storage access is allowed only for object paths referenced by a published page version and matching that page’s owning workspace and site. Public image URLs expire after 10 minutes.
- Save creates/reuses the user's default workspace and site, then stores a new locale-specific immutable draft version.

## Ecommerce store foundation
- Store administration at `/store`, linked from the builder home page.
- Product catalog management: create, edit, archive, publish, search, and delete products; SKU, base/compare-at pricing, category assignment, inventory quantity and tracking, and digital-product flag.
- Category creation and store enablement/currency settings (IQD, USD, EUR, SAR, AED).
- Order inbox with status updates for existing orders.
- Dedicated RLS-protected tables for store settings, categories, products, variants, inventory movements, coupons, shipping zones/rates, tax rates, orders, and order items.
- Public catalog reads are restricted to active products/variants/categories when the store is enabled. Customer/order records remain private; service-role access is reserved for future trusted checkout processing.
- Migration set includes tenant-scoped foreign keys, inventory/order snapshots, catalog indexes, and role-specific grants.

## Blog foundation
- Blog management at `/blog`: create/edit/delete articles, draft/publish/archive states, author, excerpt, category, SEO title/description, and comment permission.
- Public blog index at `/blog/<site-slug>` and article pages at `/blog/<site-slug>/<post-slug>`.
- Dedicated RLS-protected categories, posts and comments tables. Public readers see published posts and approved comments only; workspace editors manage posts and moderate comments.
- Public comment creation is not enabled yet; a trusted server endpoint with spam/rate-limit protection is required before accepting comments.

## Bookings and events foundation
- Booking administration at `/bookings`: service setup, duration and price, weekly availability windows, slot length and capacity, plus booking status management.
- Event administration at `/events`: create/edit/publish/cancel events, venue, start/end, capacity, ticket price, registration toggle, and registration status management.
- Dedicated RLS-protected services, availability, bookings, events and registrations tables. Public reads are limited to active services/availability and published upcoming events; booking and attendee records remain private.
- Public event pages are available at `/events/<site-slug>` and `/events/<site-slug>/<event-slug>`. Public booking/event-registration intake is not enabled yet; secure server endpoints, capacity locking, spam controls and confirmation workflows are required before accepting public submissions.

## Not yet production-ready
- Public cart and secure checkout endpoint; no live payment provider is connected.
- Product image upload UI, product variants/options editor, coupon administration, tax/shipping configuration screens, and inventory adjustment workflows.
- End-to-end checkout, payment, stock reservation, order creation and refund tests.
- Real browser end-to-end tests for signup, login, save, and reload.
- End-to-end browser testing of media uploads, signed URL expiry/refresh, gallery rendering, and contact/reservation submission flow.
- Additional rich blocks such as pricing tables and FAQs; advanced visual styling controls, responsive layout editing, and reusable components.
- Public preview URLs, production deployment, and custom domains.
- End-to-end verification with a real authenticated account, including publish, anonymous viewing, and draft-isolation tests.
- Team invitation and complete role-management workflows.
- Production deployment and operational monitoring.

## Verification status
The builder CI runs `npm run build` on pushes to `feature/website-builder-foundation`. Check the latest GitHub Actions result before treating new modules as verified.

## Safety and deployment
The builder is developed on `feature/website-builder-foundation`. Do not deploy it through the root GitHub Pages workflow or merge it into `main` until the separate app deployment and end-to-end checks are complete. Keep all Supabase secrets server-side.
