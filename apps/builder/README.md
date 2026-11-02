# Digital Compass Builder (foundation)

Independent Next.js app scaffold; existing root website, GitHub Pages workflow, and social-media automation are intentionally untouched.

## Local development
```bash
cd apps/builder
npm install
npm run dev
```
Open http://localhost:3000.

## Current state
- Arabic-first RTL landing screen and responsive base styling.
- Placeholder controls are intentionally disabled.
- No editor, authentication, database writes, publishing, billing, or customer-site hosting is implemented yet.

## Environment
Copy `.env.example` to `.env.local` only when Supabase integration is introduced. Keep service-role secrets server-side; never expose them to the browser.

## Architecture direction
Keep builder data isolated from existing social workflows. Implement tenant/workspace authorization and RLS policies before connecting persistence. Draft editing and published snapshots must be separate.