# ADR 0001: Technology Stack and Pattern Selection

**Date:** 2026-07-30
**Status:** Accepted
**Feature:** Application foundation

## Context

The Art of Art is a new PWA built from scratch. We need to choose a tech stack, select which reusable patterns from `~/Development/patterns/` to install, and decide what to exclude.

The founder has 19+ existing projects using a standardized stack. Reusing this stack eliminates learning curve, enables pattern reuse, and leverages hard-won lessons (HKDF bug in push notifications, RLS silent failures, Vercel serverless trap).

## Decision

**Stack:** React 19 + Vite + TypeScript + Tailwind CSS + Supabase (Auth + Postgres + Edge Functions + Realtime) + Dexie v4 + vite-plugin-pwa + Vercel (static only)

**Map library:** Mapbox GL JS (not Google Maps)

**Patterns installed:**
- blueprint, harbormoon, claudehooks, claudeskills (core four)
- auth (Google + Apple OAuth)
- ai-gateway (Claude as primary for mentor agent)
- web-push (infrastructure only in MVP, active in P2)
- diagnostics (browser telemetry)
- project-sota (TODO tracking)

**Patterns excluded:**
- stripe (no monetization in Phase 1)
- bridge (can add later if needed)
- kb (single-app scope doesn't warrant cross-project knowledge base)

## Alternatives Considered

- **Next.js instead of Vite**: Rejected. Server components add complexity without benefit for a PWA. SSR not needed — map-centric app is inherently client-rendered. Consistent with all other projects.
- **Google Maps instead of Mapbox**: Rejected. Google Maps requires billing account from day one, API key management is more complex, and marker customization is more limited. Mapbox free tier (50K loads/month) is sufficient for launch.
- **Native app instead of PWA**: Rejected. PWA is the founder's proven deployment model. Installable on iOS/Android, no app store friction, uses existing Vercel + vite-plugin-pwa patterns.
- **Prisma instead of Supabase direct access**: Rejected. All 19 existing projects use Supabase directly. Prisma adds an ORM layer without benefit and breaks the Edge Function pattern.

## Consequences

- **Positive:** Full pattern library available. No learning curve. Hard-won lessons (HKDF, RLS, etc.) inherited automatically. Agent crew (harbormoon) available for development.
- **Negative:** Tied to Supabase ecosystem. Mapbox is a dependency for the core experience.
- **Neutral:** Standard stack means any Claude Code session can pick up development using existing CLAUDE.md conventions.
