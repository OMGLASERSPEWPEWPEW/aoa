# Project Architecture

## Directory Layout
```
src/                        # React app
  lib/supabase.ts           # Singleton Supabase client + token helpers
  lib/gateway.ts            # AI gateway client (calls Edge Functions)
  lib/models.ts             # Model registry (feature-to-model mapping)
  contexts/                 # React contexts (Auth, Settings, etc.)
  hooks/                    # Custom hooks (data fetching, realtime)
  pages/                    # Route-level components
  components/               # Shared UI components
supabase/
  config.toml               # Edge Function settings
  functions/                # Edge Functions (Deno)
    _shared/                # Shared utilities across functions
    ai-gateway/index.ts     # Multi-provider AI routing
  migrations/               # SQL schema migrations
public/                     # Static assets
```

## Decision Framework
- "Does it need an API key or secret?" --> Edge Function
- "Does it need server-side validation beyond RLS?" --> Edge Function
- "Is it a database read/write with RLS?" --> Direct client access
- "Is it a scheduled task?" --> Edge Function + pg_cron
- "Is it a UI concern?" --> src/

## Version Stamp
Every app displays a version badge next to its title in the header:
- Version comes from `package.json` → injected at build time via Vite `define`
- Format: `v0.1.0 · Apr 8, 5:11 PM` (version + build timestamp)
- Declare `__APP_VERSION__` and `__BUILD_TIME__` in `src/global.d.ts`
- Also pass version to diagnostics and metrics if those patterns are installed

## Edge Function Conventions
- One function per concern (ai-gateway, stripe-webhook, send-email)
- Shared code in `supabase/functions/_shared/`
- JWT verification: `supabase.auth.getUser(token)` inside every function
- CORS: explicit allowlist of origins, handle preflight OPTIONS
- Deno imports use https:// URLs or import maps, not npm
- Deploy: `supabase functions deploy <name>`
- Secrets: `supabase secrets set KEY=value` (never in code or .env)
