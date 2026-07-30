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

## NEVER skip JWT verification in Edge Functions
Even with `--no-verify-jwt` (needed for CORS preflight to work), always verify the JWT
inside the function body: `const { data: { user } } = await supabase.auth.getUser(token)`
