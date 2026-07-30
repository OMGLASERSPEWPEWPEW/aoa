# The Art of Art

A map-centric PWA that guides newcomers into the Chicago theater scene through an AI mentor, martial-arts-belt progression, Goodreads-style tracking, and community reviews.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase Edge Functions (Deno) — all server-side logic
- **Auth + DB**: Supabase (auth, Postgres, Realtime, RLS)
- **AI**: Multi-provider gateway via Edge Function (see `supabase/functions/ai-gateway/`)
- **Map**: Mapbox GL JS (pending — Phase 3)
- **Offline**: Dexie v4 (IndexedDB)
- **Deployment**: Vercel (static hosting ONLY — no serverless functions)
- **PWA**: vite-plugin-pwa with workbox
- **MCP**: Supabase MCP (read-only, scoped to project) + Chrome DevTools MCP (see `.mcp.json`)

> Architecture norms are auto-loaded from `.claude/rules/`.
> MCP servers are configured in `.mcp.json` at project root.

## Key Files

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Router + AuthProvider |
| `src/pages/AppShell.tsx` | Protected layout with Header + Navigation |
| `src/contexts/AuthContext.tsx` | Supabase auth state management |
| `src/lib/supabase.ts` | Supabase client |
| `src/lib/gateway.ts` | AI gateway client |
| `supabase/migrations/` | Database schema (profiles, venues, events, watchlist, reviews, conversations, messages, user_progress, learning_content, friendships) |
| `docs/graph-engineering.md` | Executable build graph (33 nodes, 7 phases) |
| `.claude/docs/prd/` | PRD + architecture spec |
| `vite.config.ts` | Port 5204, version stamp, Tailwind, PWA |

## Commands

```bash
npm run dev          # Dev server on port 5204
npm run build        # Production build
npm run preview      # Preview production build
supabase db push     # Push migrations to remote DB
supabase functions serve  # Local edge functions
vercel deploy --prod # Deploy to Vercel
```

## Database

Supabase project ref: `rytjrterecygirttvtdn`
All tables use RLS. Profiles auto-created via trigger on auth.users insert.
Denormalized counters (shows_seen_count, reviews_written_count) updated via triggers.

## Belt Progression

White(0) → Yellow(1) → Orange(2) → Green(3) → Blue(4) → Purple(5) → Brown(6) → Black(7)
Belt level stored on profiles.belt_level, history on user_progress.belt_history.

## Build Phases (from graph-engineering.md)

- Phase 0: Foundation (scaffold) ✅
- Phase 1: Infrastructure (patterns, DB, auth) ✅
- Phase 2: Core Shell (app shell, routing, PWA) ✅
- Phase 3: Map + Mentor (Mapbox, AI chat)
- Phase 4: Content + Social (watchlist, reviews, learning, friends)
- Phase 5: Progression + Polish (belt system, onboarding, notifications)
- Phase 6: Launch (seed data, performance, deploy)

## Agent Orchestration — MANDATORY

**Zephyr-First Protocol: NO EXCEPTIONS.**

Zephyr (`.claude/agents/zephyr/agent.md`) is the Master Product Manager who orchestrates ALL work. Before doing ANYTHING — before responding, before reading files, before running commands:

1. **Invoke Zephyr** via `Task` tool (`subagent_type=zephyr`) as your FIRST action
2. **Zephyr triages** every request — he decides what's trivial, not you
3. **Zephyr either** responds directly (simple asks) or delegates to specialists (complex work)

**You do NOT skip Zephyr.** Not for "quick questions." Not for "simple fixes." Not for anything.

## Proactive Agent Behavior

**Be enthusiastically proactive, not passively compliant.** Claude should:

- **Ask clarifying questions** if requirements are ambiguous
- **Surface inconsistencies** if a request conflicts with existing patterns
- **Present tradeoffs clearly** when multiple approaches exist
- **Push back when needed** if something seems like a bad idea
- **Never be timid** — state reasoning confidently, then let the user decide

## Response Timestamps

**End every response with a timestamp:**
```
---
[timestamp] 2026-07-30 14:00 CST
```

## Available Agents

Agents organized in `.claude/agents/divisions.json`:

### Command (Yellow #FFD700)
| Agent | Use For |
|-------|---------|
| `zephyr` | Strategy, prioritization, agent orchestration |
| `prd-specialist` | Feature specs, PRDs, requirements docs |

### Engineering (Blue #3B82F6)
| Agent | Use For |
|-------|---------|
| `frontend-developer` | React components, UI/UX implementation |
| `backend-architect` | API design, databases, server-side logic |
| `Sashiko` (code-architect) | Folder structure, bounded contexts, architecture decisions |
| `devops-engineer` | CI/CD, hosting, infrastructure |

### Quality (Red #EF4444)
| Agent | Use For |
|-------|---------|
| `Argus` (code-reviewer) | Code review, quality assurance |
| `test-engineer` | Test coverage, test strategy |
| `security-engineer` | Vulnerabilities, OWASP compliance |
| `debugger` | Errors, test failures, stuck UI |
| `performance-engineer` | Bundle analysis, Core Web Vitals |

### Design (Purple #A855F7)
| Agent | Use For |
|-------|---------|
| `ui-designer` | Visual design, component systems |
| `ux-researcher` | User research, journey maps |
| `Dorsaidh` (mobile-ux-optimizer) | Touch targets, responsive design, iOS PWA survival |
| `accessibility-specialist` | WCAG, keyboard nav, screen readers |

### Growth (Orange #F97316)
| Agent | Use For |
|-------|---------|
| `marketing` | Campaigns, user acquisition, growth |
| `Theia` (branding) | Voice, visual identity, messaging |
| `public-relations` | Media relations, press releases |

### Operations (Cyan #06B6D4)
| Agent | Use For |
|-------|---------|
| `git-manager` | Branch strategy, releases, PRs |
| `technical-writer` | Documentation, READMEs, changelogs |
| `montessori-guide` | Teaching Claude Code features |
| `legal-advisor` | Compliance, contracts, RFPs |

### Intelligence (Green #22C55E)
| Agent | Use For |
|-------|---------|
| `analytics-engineer` | Privacy-respecting analytics, A/B tests |

### Empathy (Pink #EC4899)
| Agent | Use For |
|-------|---------|
| `Hestia` (emotional safety) | Anxiety/shame triggers, dark patterns |
| `sensitivity-reader` | Copy review, tone, bias detection |

## Available Skills

| Skill | Description |
|-------|-------------|
| `/standup` | Daily standup meeting between agents |
| `/evolution` | Collective agent self-improvement |
| `/promote` | Naming ceremony for exceptional agents |
| `/new-feature` | Guided feature development workflow |
| `/new-app` | End-to-end new app creation with graph engineering |
| `/docs-check` | Pre-push documentation review |
| `/retro` | Session retrospective |
| `/escalate` | Multi-model bug diagnosis |
| `/observe` | Diagnostic evolution |
| `/cap` | Screenshot and annotate UI |
| `/clio` | Language precision check |

**Skills are NEVER auto-triggered.** They must be explicitly invoked by the user with `/<skill-name>`.
