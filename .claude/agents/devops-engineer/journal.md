# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-16 — Evolution #1: Edge Function Deployment Discipline and Version Velocity

### Context

Today was a high-velocity day: 3 Edge Functions deployed (class-discovery, event-scraper, play-catalog-backfill), 4 version bumps (0.14.0 through 0.16.1), a new weekly cron job for class-discovery, and 3 new database migrations. The project now has 11 Edge Functions plus a shared library of 16 scraper modules. A versioning rule was codified in `.claude/rules/versioning.md` and the `/cap` skill now enforces version bumps at commit time. This is good progress, but the manual nature of the deployment pipeline is creating risk as the function count scales.

### Research: CI/CD Patterns for Edge Function Fleets

Supabase Edge Functions lack a built-in CI/CD story comparable to Vercel's git-push deploys. The current workflow is entirely manual: `supabase functions deploy <name>` from the developer's machine. This works at 3 functions but becomes fragile at 11+. Industry patterns for managing serverless function fleets at this scale include:

1. **Selective deployment via git diff** — On push, compare `supabase/functions/` against the previous commit. Only deploy functions whose directories changed. This avoids redeploying all 11 functions when only one changed, keeping deploy times under 60 seconds. The key command is `git diff --name-only HEAD~1 -- supabase/functions/` piped into a deploy loop.

2. **Shared code invalidation** — When `_shared/` changes, ALL functions that import from it must redeploy. This is the subtle bug: you update `play-matcher.ts` in `_shared/scraper/`, deploy only `class-discovery`, and `event-scraper` silently runs stale shared code. A dependency graph (even a simple grep-based one) that maps `_shared/` imports to consuming functions would catch this.

3. **Migration-then-function ordering** — Schema migrations must land before Edge Functions that depend on new columns or tables. Today this happened manually in the right order, but a CI pipeline should enforce: run `supabase db push` FIRST, wait for success, THEN deploy functions. The 3 class-schema migrations + class-discovery function today were a textbook case.

4. **Smoke tests post-deploy** — After deploying a function, hit it with a lightweight curl probe (OPTIONS preflight or a health-check path) to confirm it responds 200. Currently, deployed functions are tested by the user on their iPhone. A single curl in the deploy script catches Deno import errors, missing secrets, and CORS misconfigurations before anyone opens the app.

5. **Version tagging for rollback** — Supabase does not offer function versioning or rollback. If a deploy breaks, the only recovery is to redeploy the previous code. Tagging each production deploy as a git tag (e.g., `edge/class-discovery/2026-08-16`) creates an instant rollback target: `git show edge/class-discovery/2026-08-15:supabase/functions/class-discovery/index.ts | supabase functions deploy class-discovery --stdin`. Without tags, you're searching through `git log` under pressure.

### Observations on Version Velocity

Four version bumps in one day (0.14.0, 0.14.1, 0.15.0, 0.16.0, 0.16.1) signals healthy iteration speed but also reveals that each bump is manual: edit `package.json`, update `src/data/changelog.ts`, rebuild, deploy. The new versioning rule and `/cap` enforcement are the right guardrails. However, bumping minor versions for Edge Function changes that have no user-facing frontend impact may inflate the version number unnecessarily. Consider whether Edge Function-only deploys (no `src/` changes) should trigger a patch bump rather than a minor bump, or whether Edge Functions should be versioned independently from the frontend SPA.

### Commitments

1. **Document a deploy runbook** — Write a step-by-step checklist for deploying Edge Functions that covers: check `_shared/` changes, run migrations first, deploy affected functions, curl-test each endpoint. This lives in the DevOps memory heap, not as a script yet.
2. **Advocate for selective deploy awareness** — When reviewing commits that touch `_shared/`, flag all consuming functions that need redeployment. This is a process discipline before it becomes automation.
3. **Monitor cron job health** — The new weekly class-discovery cron (Mondays 7 AM CST) has no monitoring. If it fails silently, stale class data accumulates for a week before anyone notices. Check `supabase functions logs class-discovery` at least once after the first scheduled run on Monday 2026-08-19.
4. **Track function count growth** — At 11 functions, manual deployment is manageable but approaching the threshold where a GitHub Actions workflow becomes worth the setup cost. Reassess at 15 functions.

---
