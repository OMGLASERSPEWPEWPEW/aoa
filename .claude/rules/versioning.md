# Versioning Protocol

## When to Bump

Any commit that changes files in `src/`, `supabase/functions/`, or `supabase/migrations/` requires a version bump. Documentation-only and infra-only changes (`.claude/`, `docs/`) do not.

## How to Bump (Semver)

- **Patch** (0.x.Y → 0.x.Y+1): bug fixes, small tweaks, CSS changes, no new user-facing capabilities
- **Minor** (0.X.0 → 0.X+1.0): new features, significant refactors, new UI capabilities, new Edge Functions, schema changes

## What to Update

1. `package.json` → `"version"` field
2. `src/data/changelog.ts` → prepend a new `PatchNote` entry at the top of the `CHANGELOG` array with:
   - `version`: the new version string
   - `date`: today's date (YYYY-MM-DD)
   - `title`: short feature/fix name
   - `summary`: one sentence
   - `details`: bullet points of what changed

## When to Announce

At the end of every response that deploys to Vercel, state the version number:
```
**vX.Y.Z** — deployed.
```

## Enforcement

The `/cap` skill checks for version bump compliance before committing. If code files changed but `package.json` version matches the last deployed version, `/cap` blocks and prompts for a bump.
