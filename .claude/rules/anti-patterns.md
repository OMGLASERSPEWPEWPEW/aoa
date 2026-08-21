# Anti-Patterns

## NEVER use Vercel serverless functions
Do NOT create an `api/` directory. Do NOT import `@vercel/node`.
Vercel is a static host ONLY. All server-side logic goes in Supabase Edge Functions.

WHAT HAPPENS: ESM module resolution breaks in production. Node.js requires .js extensions
on relative imports when package.json has "type": "module". This works locally (Vite bundles
everything) but fails on Vercel with ERR_MODULE_NOT_FOUND. No local repro. Wastes hours.
SOURCE: familia project, April 2026.

## NEVER put API keys in VITE_ environment variables
Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong on the client.
All other keys go in Edge Function secrets: `supabase secrets set KEY=value`

WHAT HAPPENS: VITE_ vars are embedded in the JS bundle at build time. Anyone can view-source
and steal your AI/payment keys. The anon key is safe because RLS controls access.

## NEVER use .single() for queries that might return 0 rows
Use `.maybeSingle()` instead. `.single()` returns a 406 error when 0 rows match.
Only use `.single()` when a UNIQUE constraint guarantees exactly one result.

## NEVER query auth.users in RLS policies
The authenticated role cannot read `auth.users`. Use `auth.uid()` for the current user's ID
or `auth.jwt() ->> 'email'` for their email. Join against your own `profiles` table instead.

## NEVER manually insert or fill data
Do NOT write migrations with hardcoded data (coordinates, names, addresses, etc.).
Do NOT web-scrape addresses and paste them into SQL. Do NOT fill in data "for now."
All data comes from the automated pipeline — scrapers, discovery, enrichment.
If the pipeline can't produce the data, FIX THE PIPELINE.

WHAT HAPPENS: Manual data rots, can't scale, violates the whole point of building scrapers.
The user builds pipelines specifically so they don't have to hand-enter data.
SOURCE: Art of Art project, August 2026. Repeated offense.

## Scrapers are designed for any city, not just Chicago
Chicago is the first city. The next could be New York with 200 theater schools or
Boise with 3. Every design decision must hold for all of them.

This is why hardcoded values break things: a limit of 20 schools silently drops results
in New York and wastes iterations in Boise. A cost cap of $0.50 might cover Chicago
but starve a larger city, or overspend in a tiny one. These aren't fixes — they're
assumptions about one city baked into code that's supposed to serve all of them.

The right termination condition is always the data itself: the loop ends when there are
no more pending items in the database, not when a counter hits a number someone guessed.
When a loop runs away, the bug is in how "done" is determined — fix that, because a
hardcoded cap just hides the bug until the next city exposes it again.

The same applies to manual data curation. Hand-entering 18 Chicago schools doesn't scale
to city #2. If the pipeline can't discover and populate schools automatically, the
pipeline is what needs fixing.

SOURCE: Art of Art project, August 2026. Multiple sessions lost to this pattern.

## NEVER skip JWT verification in Edge Functions
Even with `--no-verify-jwt` (needed for CORS preflight to work), always verify the JWT
inside the function body: `const { data: { user } } = await supabase.auth.getUser(token)`
