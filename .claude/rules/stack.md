# Standard Stack

## Frontend
React + TypeScript + Vite + Tailwind CSS. Deployed to Vercel as a static SPA.

Vercel serves ONLY static files. No serverless functions, no API routes, no `api/` directory.
The vercel.json should contain only SPA rewrites:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

WHY: Vercel serverless functions use Node.js with different module resolution than Vite's
bundler. When package.json has "type": "module", Vercel requires explicit .js extensions on
all relative imports. This works locally but fails in production with ERR_MODULE_NOT_FOUND.
Supabase Edge Functions run Deno, which has proper ESM support and avoids this entirely.

## Server-Side Logic
ALL server-side logic goes in Supabase Edge Functions (`supabase/functions/`).
This includes: AI calls, webhooks, email sending, payment processing, scheduled tasks.

WHY: Edge Functions run Deno (native ESM, no bundler mismatch). They deploy independently
from the frontend. API keys stay server-side via `supabase secrets set`. They're included
in your Supabase plan — no extra Vercel compute cost.

## Database Access
Client-side code reads/writes Supabase directly via `@supabase/supabase-js`.
RLS policies enforce all access control. No server-side CRUD layer needed.

WHY: Direct access is faster (no middleman), cheaper (no function invocation), and simpler.
RLS is Postgres-native row security — it runs at the database level regardless of client.

## AI Integration
Use the ai-gateway pattern: single Edge Function routing to multiple providers.
Client calls `callModel()` which hits the Edge Function with a JWT.
Never expose AI API keys to the client.

## Auth
Supabase Auth (email/password + OAuth). Session persisted in localStorage via supabase-js.
Protected routes check `useAuth()` context. No custom auth middleware needed.
