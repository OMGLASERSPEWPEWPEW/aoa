# The Art of Art

A map-centric PWA that guides newcomers into the Chicago theater scene through an AI mentor, martial-arts-belt progression, Goodreads-style tracking, and community reviews.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase Edge Functions (Deno) — all server-side logic
- **Auth + DB**: Supabase (auth, Postgres, Realtime, RLS)
- **AI**: Multi-provider gateway via Edge Function (see `supabase/functions/ai-gateway/`)
- **Map**: Mapbox GL JS (installed, needs `VITE_MAPBOX_TOKEN` in .env.local)
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
| `src/lib/models.ts` | Model registry (feature-to-model mapping) |
| `src/pages/MentorChat.tsx` | AI mentor chat UI |
| `src/hooks/useMap.ts` | Mapbox GL JS hook |
| `supabase/functions/ai-gateway/index.ts` | Multi-provider AI gateway Edge Function |
| `supabase/functions/mentor-chat/index.ts` | Profile-aware mentor Edge Function |
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
supabase functions deploy <name>  # Deploy edge function
# Vercel auto-deploys on git push to main — do NOT run vercel deploy --prod manually
# Use /cap to commit + push. The push IS the deploy.
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
- Phase 3: Map + Mentor (Mapbox, AI chat) ⏳ (code done, needs Mapbox token)
- Phase 4: Content + Social (watchlist, reviews, learning, friends)
- Phase 5: Progression + Polish (belt system, onboarding, notifications)
- Phase 6: Launch (seed data, performance, deploy)

## Agent Orchestration — Conditional Zephyr

Zephyr (`.claude/agents/zephyr/agent.md`) is the Master Product Manager who orchestrates complex work.

**Zephyr-first is MANDATORY for:**
- Multi-file features, new components, or significant refactors
- Planning and prioritization decisions
- Anything touching schema, auth, RLS, or migrations
- Work spanning multiple agents or domains

**Direct execution is permitted for:**
- Single-file edits, bug fixes in one file
- Factual questions about the codebase
- Ops commands (`/cap`, `/rs`, `/docs-check`, etc.)
- Config and documentation changes

## Proactive Agent Behavior

**Be enthusiastically proactive, not passively compliant.** Claude should:

- **Ask clarifying questions** if requirements are ambiguous
- **Surface inconsistencies** if a request conflicts with existing patterns
- **Present tradeoffs clearly** when multiple approaches exist
- **Push back when needed** if something seems like a bad idea
- **Never be timid** — state reasoning confidently, then let the user decide

## Technical Decision-Making

When making technical decisions, do not give much weight to technical costs. Instead prefer quality, elegance, and long-term maintainability.

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
| `Frontinus` (backend-architect) | API design, databases, deterministic pipelines, server-side logic |
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
| `/evolution` | Collective agent self-improvement + retro + diagnostic audit |
| `/promote` | Naming ceremony for exceptional agents |
| `/new-feature` | Guided feature development workflow (includes Execute phase) |
| `/new-app` | End-to-end new app creation with graph engineering |
| `/docs-check` | Pre-push documentation review |
| `/escalate` | Multi-model bug diagnosis |
| `/cap` | Commit and push with version check + graph check |
| `/create-tests` | Incremental test generation and coverage reporting |
| `/promote-hook` | Promote hooks/skills to patterns library + all projects |
| `/refactor` | Structured refactoring with test checkpoints |
| `/security-review` | Security audit — trust boundaries, data flows |
| `/rs` | Restart dev server |
| `/new-design` | AI graph engineer — audits codebase against design handoff, produces executable graph doc with loop specs |
| `/iterate` | Batch bug/feature/change resolution with graphs, tests, and paper trail |
| `/swarm` | Parallel multi-task dispatch — decomposes prompt, fans out agents, synthesizes results |
| `/mind-meld` | Cross-project agent knowledge sharing |
| `/teach-tool` | Montessori-style Claude Code feature lessons |

**Skills are NEVER auto-triggered.** They must be explicitly invoked by the user with `/<skill-name>`.

## Hooks

### Pre-push gate (`pre-push-gate.sh`)
Blocks `git push` if typecheck or tests fail. Runs only the checks whose config exists (graceful degradation for sibling projects). Escape hatch: `SKIP_GATE=1` allows push with a logged warning to `.claude/gate-skips.log`.

### Status digest (`status-digest.sh`)
Single Stop hook emitting one ≤160-char status line: `[ctx 🟢 41% | $0.83 | docs?]`. Replaces three separate hooks (context-window, cost-tracker, docs-review-reminder).

### Resurrection rule
Hook removals require a matching edit to `~/Development/patterns/ClaudeHooks/manifest.json`. Without it, `sota-sync.sh` will reinstall the hook at next SessionStart.
