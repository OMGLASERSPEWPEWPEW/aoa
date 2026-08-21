---
name: new-app
description: End-to-end workflow for creating a new application from scratch. Produces domain research, PRD, architecture, and an AI graph engineering document (task graph + loop specs) so thorough that any AI agent can execute the build node-by-node.
---

# New Application Workflow

You are executing the **new application workflow**. This skill takes a product idea from zero to a working app skeleton, producing an **AI graph engineering document** as the central artifact — a formal task graph with loop specifications that Claude Code agents can execute node-by-node through subagent infrastructure.

**This skill produces documentation AND a working skeleton.** Phases 1-5 produce specs and the graph engineering doc. Phases 6-7 scaffold and wire the app. Features come later via `/new-feature` (which now includes an Execute phase).

Unlike `/new-feature` (which adds features to an existing codebase), `/new-app` creates the codebase itself. The graph engineering document (`docs/graph-engineering.md`) is the living roadmap — any future Claude Code session reads it to know exactly what to build next, with what agent, in what order, verified how.

<!-- === CONFIGURATION START === -->
## Configuration

| Setting | Value |
|---------|-------|
| **Patterns Directory** | `~/Development/patterns/` |
| **Port Registry** | `~/Development/patterns/port-registry.md` |
| **Blueprint Checklist** | `~/Development/patterns/blueprint/checklist.md` |
| **Projects Root** | `~/Development/` |
| **PRD Directory** | `.claude/docs/prd/` |
| **ADR Directory** | `docs/adr/` |
| **Graph Engineering Doc** | `docs/graph-engineering.md` |
| **Roadmap Directory** | `docs/roadmap/` |
| **Main Documentation File** | `CLAUDE.md` |

<!-- === CONFIGURATION END === -->

---

## Waterfall Process

Execute these phases IN ORDER. Do not skip phases. Phases 1-4 produce documents. Phase 5 produces the graph engineering specification. Phases 6-7 produce a working project.

```
+----------------------------------------------------------------------+
|                    NEW APPLICATION WATERFALL                           |
+----------------------------------------------------------------------+
|                                                                       |
|  Phase 1: DOMAIN RESEARCH                                            |
|  +-> Understand the problem space before any code                    |
|  +-> Gather existing domain knowledge (docs/, conversations)         |
|                          |                                            |
|  Phase 2: LANDSCAPE ANALYSIS                                        |
|  +-> What exists, what's missing, where the gap is                   |
|                          |                                            |
|  Phase 3: PRODUCT DEFINITION                                         |
|  +-> User journeys, progression model, core PRD                     |
|  +-> App identity, named agent persona (if applicable)               |
|                          |                                            |
|  Phase 4: ARCHITECTURE + PATTERN SELECTION                           |
|  +-> Which patterns from ~/Development/patterns/ to install          |
|  +-> Data models, route structure, component hierarchy               |
|  +-> ADR for key architectural decisions                             |
|                          |                                            |
|  Phase 5: GRAPH ENGINEERING                                          |
|  +-> Task graph: nodes, edges, state schema                         |
|  +-> Loop specs: trigger, cycle, evaluator, stop condition           |
|  +-> Build phases: topological sort of the graph                     |
|  +-> THE single source of truth for "what do I build next?"          |
|                          |                                            |
|  Phase 6: PROJECT SCAFFOLDING                                        |
|  +-> Run blueprint checklist: Vite, Tailwind, Supabase, port claim   |
|  +-> Install patterns in graph-defined order                         |
|  +-> Set up agents, hooks, skills                                    |
|                          |                                            |
|  Phase 7: SKELETON IMPLEMENTATION                                    |
|  +-> Core app shell: routing, layout, auth, AI gateway, PWA         |
|  +-> Placeholder pages for each major route                          |
|  +-> Build passes, dev server starts, app loads in browser           |
|                                                                       |
+----------------------------------------------------------------------+
```

<!-- === PHASE AGENTS START === -->

### Phase-to-Agent Mapping

| Phase | Agent(s) | Fallback (if agent unavailable) |
|-------|----------|--------------------------------|
| 1. Domain Research | (main context) | — |
| 2. Landscape Analysis | (main context) | — |
| 3. Product Definition | `prd-specialist`, `ui-designer`, `mobile-ux-optimizer` | Perform in main context |
| 4. Architecture | `code-architect` | Perform in main context |
| 5. Graph Engineering | (main context) | — |
| 6. Project Scaffolding | (main context) | — |
| 7. Skeleton | `frontend-developer`, `backend-architect` | Perform in main context |

Agents won't exist until Phase 6 installs harbormoon. Before that, perform all phases in main context. After Phase 6, agents are available for Phase 7.

<!-- === PHASE AGENTS END === -->

---

## Phase 1: Domain Research

Before writing a single line of code or spec, understand the problem space deeply.

### 1.1 Gather Existing Knowledge

Check for pre-existing research:

1. **Conversation transcripts** — look in `docs/` for notes, transcripts, or conversation logs
2. **Reference materials** — bookmarks, articles, competitor URLs the user has shared
3. **User's own experience** — what they already know from personal involvement

Read everything the user has already captured. Do NOT skip this.

### 1.2 Domain Deep Dive

For each domain the app touches, answer:

| Question | Why It Matters |
|----------|---------------|
| Who are the users? | Defines persona, age groups, experience levels |
| What is the core problem? | The pain point the app solves |
| What does "success" look like for a user? | Drives the progression model |
| What domain vocabulary matters? | Users expect domain-native language |
| What is the emotional arc? | From intimidation/curiosity to mastery/belonging |
| What are the local/geographic factors? | City-specific content, regional differences |
| What existing communities exist? | Potential user acquisition channels |

### 1.3 Ask the User

After reading existing materials, identify gaps and ask targeted questions:

- What is the first experience you want a new user to have?
- What does a power user look like 6 months in?
- What content already exists vs. what needs to be created?
- Is this single-city or multi-city? What is the launch city?
- What is the monetization model?
- Are there age/experience segments that get different content?

**Output**: `.claude/docs/domain-research.md`

---

## Phase 2: Landscape Analysis

### 2.1 Competitive Survey

For each competitor, document:

| Field | Content |
|-------|---------|
| Name + URL | What is it? |
| What it does well | Features worth learning from |
| What it does poorly | Gaps and pain points |
| Business model | How it makes money |
| User sentiment | App Store reviews, Reddit, social media |

### 2.2 Gap Analysis

1. **Unserved needs** — what no existing product does
2. **Poorly served needs** — what existing products do badly
3. **Positioning statement** — "Unlike [competitor], our app [differentiator] because [reason]"

### 2.3 Content Strategy

- Where does initial content come from? (curated, user-generated, AI-generated)
- What is the content update cadence?
- Is there a cold-start problem? How do you solve it?

**Output**: `.claude/docs/landscape.md`

---

## Phase 3: Product Definition

### 3.1 User Journey Mapping

Map Level 0 (first-time) through power user:

```markdown
### Level 0: First Contact
- How does the user discover the app?
- What do they see in the first 30 seconds?
- What is the first action they take?
- What reward/value do they get immediately?

### Level 1-N: Progression
- What milestones mark advancement?
- What unlocks at each level?
- How does the experience deepen?
```

### 3.2 Progression Model (if applicable)

| Level | Name | Criteria to Reach | Unlocks |
|-------|------|-------------------|---------|
| 0 | (starting) | Sign up | Core features |
| 1 | ... | ... | ... |

For each level: visual indicator, concrete criteria (quantifiable), what unlocks.

### 3.3 Core PRD

1. **App Identity**: Name, tagline, one-paragraph description
2. **Target Users**: Primary persona, secondary personas, anti-personas
3. **Core User Stories**: The 5-8 stories that define the MVP
4. **Feature Inventory (MVP)**: Numbered features with P0/P1/P2 priority
5. **Feature Inventory (Post-MVP)**: Features explicitly deferred
6. **Non-Functional Requirements**: Performance, offline, accessibility
7. **Monetization Model**: How the app makes money (or doesn't)
8. **Success Metrics**: DAU, retention, engagement
9. **Content Architecture**: Content types, structure, delivery
10. **City/Region Model** (if applicable): How geographic specificity works

### 3.4 Agent Persona (if applicable)

If the app includes a named AI character:

- **Name and backstory** — who is this character?
- **Voice and tone** — how do they speak? What vocabulary?
- **Visual design direction** — avatar style, speech bubble aesthetic
- **Knowledge boundaries** — what do they know? What do they defer on?
- **Personality traits** — 3-5 defining characteristics

### 3.5 App Aesthetic

- Color palette (primary, secondary, accent)
- Typography intent
- Tone of voice
- UI paradigm (map, chat, cards, etc.)

**Output**: `.claude/docs/prd/app-prd.md`, `.claude/docs/user-journey.md`

---

## Phase 4: Architecture + Pattern Selection

### 4.1 Pattern Audit

Read `~/Development/patterns/` and determine which patterns this app needs.

#### Core Patterns (every app)

| Pattern | Install Order |
|---------|---------------|
| `blueprint/` | 1st |
| `harbormoon/` | 2nd |
| `claudehooks/` | 3rd |
| `claudeskills/` | 4th |

#### Code Patterns (selected per app)

| Pattern | When to Include |
|---------|----------------|
| `auth/` | App has user accounts |
| `ai-gateway/` | App uses AI features |
| `stripe/` | App has purchases or credits |
| `web-push/` | App sends push notifications |
| `diagnostics/` | App needs session telemetry |
| `project-sota/` | App uses TODO tracking |

For each pattern, confirm: needed (yes/no), install order, customization needed.

### 4.2 Architecture Design

Using the standard stack (React 19 + Vite + TypeScript + Tailwind + Supabase + Dexie + vite-plugin-pwa + Vercel), define:

- **Route structure**: every route with path and purpose
- **Data models**: every table with columns, types, RLS policy sketch
- **Component hierarchy**: component tree from App down
- **PWA configuration**: name, colors, icons, offline strategy

### 4.3 Write ADR(s)

At minimum: `docs/adr/0001-tech-stack-and-patterns.md` documenting why this stack, which patterns, what's excluded.

**Output**: `.claude/docs/prd/architecture.md`, `docs/adr/0001-*.md`

---

## Phase 5: Graph Engineering

This is the phase that makes `/new-app` different from ad-hoc project creation. The graph engineering document is a formal, executable specification — not a prose roadmap.

### 5.1 Concepts

**Graph engineering** represents the app's build plan as an executable graph:
- **Nodes** = build tasks (scaffold, install auth, build mentor chat, etc.)
- **Edges** = dependencies between tasks (auth must exist before ai-gateway)
- **Shared state** = artifacts that flow between nodes (project path, installed patterns, migration files)

**Loop engineering** defines the iterative cycle within each node:
- **Trigger** = what must be true for this node to start
- **Inner cycle** = discover → plan → execute → verify
- **Evaluator** = how to check if the node succeeded
- **Retry strategy** = what to do on failure (max attempts, re-plan approach)
- **Stop condition** = when the node is done

This maps directly onto Claude Code's infrastructure:
- Harbormoon agents → graph nodes
- Claude Code subagents → parallel node execution (fan-out)
- `/new-feature` skill → loop pattern for feature nodes
- `attempts.jsonl` convention → retry tracking

### 5.2 Build the Graph Document

Create `docs/graph-engineering.md` with four sections:

---

#### Section 1: Task Graph Topology

List every node and edge. Use a text-based graph notation:

```markdown
## Task Graph

### Nodes
scaffold, supabase-init, blueprint, harbormoon, hooks, skills,
auth-migration, auth-ui, ai-gateway-edge-fn, ai-gateway-client,
app-shell, [feature-nodes...]

### Edges (arrows = "must complete before")
scaffold → supabase-init
supabase-init → blueprint → harbormoon → hooks → skills
supabase-init → auth-migration → auth-ui
auth-ui → app-shell
auth-migration → ai-gateway-edge-fn → ai-gateway-client
app-shell → [feature-nodes]
```

Visualize the graph as an ASCII DAG showing parallel tracks.

---

#### Section 2: Node Specifications

For EVERY node, write a formal spec:

```markdown
### Node: <node-name>
- **Type**: scaffold | pattern-install | migration | feature | config
- **Agent**: <agent-name> or (main context)
- **Depends on**: <node-names>
- **Inputs**: <what this node reads — PRD sections, pattern files, prior node outputs>
- **Outputs**: <what this node produces — files, tables, configs>
- **Loop pattern**: <one-shot | plan-execute-verify>
- **Success criteria**: <observable, testable conditions>
- **Estimated effort**: Trivial | Small | Medium | Large
- **Pattern(s)**: <pattern paths from ~/Development/patterns/ if applicable>
```

For feature nodes, also include:
- **PRD reference**: which PRD section defines this feature
- **Skill invocation**: `/new-feature` for the documentation phase, then implementation

---

#### Section 3: Loop Specifications

For each node with `plan-execute-verify` loop pattern, write:

```markdown
## Loop: <node-name>
- **Trigger**: <which nodes must be in state "complete">
- **Inner cycle**:
  1. Discover: <what to read — patterns, existing code, PRD sections>
  2. Plan: <what to design — component tree, API contract, schema>
  3. Execute: <what to build — specific files, functions, migrations>
  4. Verify: <how to test — dev server, browser check, API call, build command>
- **Evaluator**: <concrete pass/fail criteria>
- **Retry**: on verify failure → <read error, re-plan, re-execute> (max <N> cycles)
- **Stop condition**: all success criteria pass
- **Attempt tracking**: append to `attempts.jsonl` on each cycle
```

One-shot nodes (scaffold, config, pattern-install) don't need loop specs — they either work or they don't.

---

#### Section 4: Shared State Schema

Define the state that flows between nodes:

```markdown
## Shared State

| Key | Type | Set by | Consumed by |
|-----|------|--------|-------------|
| project_path | string | scaffold | all subsequent nodes |
| supabase_ref | string | supabase-init | migrations, edge functions |
| port | number | scaffold | app-shell, skeleton verification |
| installed_patterns | string[] | pattern-install nodes | feature nodes |
| migration_files | string[] | migration nodes | verification |
| verified_features | string[] | verify steps | progress tracking |
```

---

#### Section 5: Build Phases (Topological Sort)

Sort the graph into executable phases. Nodes within a phase have no dependencies on each other and CAN run in parallel (via Claude Code subagents).

```markdown
## Build Phases

### Phase 0: Foundation
- [ ] scaffold (npm create vite)
- [ ] supabase-init

### Phase 1: Infrastructure (parallel tracks)
Track A: blueprint → harbormoon → hooks → skills
Track B: auth-migration → ai-gateway-edge-fn

### Phase 2: Core Shell
- [ ] auth-ui
- [ ] ai-gateway-client
- [ ] app-shell
- [ ] pwa-config

### Phase 3: Feature Set 1 (can fan out)
- [ ] [feature-a] (subagent 1)
- [ ] [feature-b] (subagent 2)

### Phase N: Polish + Deploy
- [ ] diagnostics
- [ ] web-push
- [ ] first deploy
```

Each phase is a checkpoint. All nodes in a phase must pass verification before the next phase begins.

---

### 5.3 Validate the Graph

Before declaring Phase 5 complete:

- [ ] Every node has all 8 required fields (type, agent, depends-on, inputs, outputs, loop-pattern, success-criteria, effort)
- [ ] Every edge represents a real dependency (removing it would cause a build failure)
- [ ] No circular dependencies exist
- [ ] Build phases are a valid topological sort
- [ ] Feature nodes reference their PRD sections
- [ ] Pattern nodes reference exact paths in `~/Development/patterns/`
- [ ] Loop specs have concrete evaluators (not "works correctly" — specific observable checks)
- [ ] State schema accounts for every artifact that flows between nodes

**Output**: `docs/graph-engineering.md`

---

## Phase 6: Project Scaffolding

Execute the foundation nodes from the graph. Follow `~/Development/patterns/blueprint/checklist.md` step by step.

### 6.1 Scaffold

```bash
cd ~/Development/
npm create vite@latest [project-name] -- --template react-ts
cd [project-name] && npm install
npm install -D tailwindcss @tailwindcss/vite
npm install @supabase/supabase-js react-router-dom dexie dexie-react-hooks
npm install -D vite-plugin-pwa
```

### 6.2 Claim a Port

Read `~/Development/patterns/port-registry.md`, pick next available in 5170-5299, set in `vite.config.ts`, update registry.

### 6.3 Version Stamp

Per blueprint checklist Section 2: `__APP_VERSION__`, `__BUILD_TIME__` in vite.config.ts + global.d.ts.

### 6.4 Supabase Setup

```bash
supabase init
supabase link --project-ref <ref>
```

Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### 6.5 Install Patterns (in graph-defined order)

Execute the pattern-install nodes from the graph in topological order:

```bash
~/Development/patterns/blueprint/install.sh .
~/Development/patterns/harbormoon/install.sh .
~/Development/patterns/claudehooks/install.sh .
~/Development/patterns/claudeskills/install.sh .
```

Then copy code patterns (auth/, ai-gateway/, etc.) as specified by the graph.

### 6.6 Initialize Git

```bash
git init
git add -A
git commit -m "Initial scaffold with patterns installed"
```

### 6.7 Vercel Setup

```bash
vercel link
```

Create `vercel.json` (static only, no serverless).

**Checkpoint**: `npm run dev` starts. All pattern files in place. `.claude/` directory has agents, hooks, skills, rules.

---

## Phase 7: Skeleton Implementation

Execute the core-shell nodes from the graph. Build the minimum app shell that proves every installed pattern works.

### 7.1 CLAUDE.md

Create with: project overview, stack snippet, agent orchestration section, directory layout, key files, dev commands, reference to `docs/graph-engineering.md`.

### 7.2 App Shell

| File | Purpose |
|------|---------|
| `src/App.tsx` | Router + providers |
| `src/pages/Landing.tsx` | Public landing page |
| `src/pages/AppShell.tsx` | Protected layout |
| `src/pages/Settings.tsx` | User settings |
| `src/components/Header.tsx` | Header with version badge |
| `src/components/Navigation.tsx` | Bottom nav (mobile) / sidebar (desktop) |

### 7.3 Auth Integration

Wire auth pattern: AuthProvider, login/signup pages, protected routes, logout. Test: signup → login → protected content → logout.

### 7.4 AI Gateway Integration

Deploy edge function, configure provider, wire `callModel()`. Test: prompt → response with JWT auth.

### 7.5 PWA Configuration

Follow `~/Development/patterns/kb/wiki/procedures/pwa-version-refresh.md` exactly. Summary:

1. Add VitePWA plugin to `vite.config.ts` with `registerType: 'autoUpdate'`, manifest, and workbox config (`skipWaiting: true`, `clientsClaim: true`)
2. Add `/// <reference types="vite-plugin-pwa/react" />` to `src/global.d.ts`
3. Create `src/components/UpdateBanner.tsx` with `useRegisterSW()` hook + bfcache detection
4. Render `<UpdateBanner />` in `App.tsx` root layout, outside routing
5. Create `VersionStamp` component, display in app header
6. Add Vercel cache headers for `sw.js`, `index.html`, and `manifest.webmanifest`

**The UpdateBanner is mandatory.** Without `useRegisterSW()`, the SPA will never reload when a new SW activates. Users get stuck on stale code indefinitely. See the procedure doc for the incident report.

### 7.6 Database Seed

Apply initial migrations from the graph's migration nodes. Verify RLS policies.

### 7.7 Verification Checklist

ALL must pass:

- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes without errors
- [ ] App loads in browser at claimed port
- [ ] Version badge shows in header
- [ ] Can sign up, log in, access protected routes, log out
- [ ] Can send test AI prompt and receive response
- [ ] PWA manifest served correctly
- [ ] Service worker registers
- [ ] First deploy to Vercel succeeds
- [ ] `.claude/` directory complete (agents, rules, hooks, skills)
- [ ] `CLAUDE.md` exists
- [ ] `docs/graph-engineering.md` exists
- [ ] No console errors in browser DevTools

**Output**: Running application skeleton with all patterns working

---

## Checkpoints

- [ ] **Phase 1 → 2**: Domain research doc exists, user answered key questions
- [ ] **Phase 2 → 3**: Landscape analyzed, positioning clear, content strategy defined
- [ ] **Phase 3 → 4**: PRD with MVP features, user journey mapped, progression defined
- [ ] **Phase 4 → 5**: Patterns selected, architecture designed, ADR written
- [ ] **Phase 5 → 6**: Graph engineering doc complete — all nodes specified, topology valid, loop specs written
- [ ] **Phase 6 → 7**: All patterns installed, `npm run dev` works, git initialized
- [ ] **Phase 7 → Done**: Skeleton verification checklist passes, first deploy succeeds

---

## After /new-app Completes

The app exists but has no features. Read `docs/graph-engineering.md` Build Phases to determine what to build next. For each feature node:

1. `/new-feature` — produce PRD, architecture, QA doc for the feature
2. Execute the node's loop spec — discover, plan, execute, verify
3. Update the graph: mark node as complete, update shared state
4. Advance to the next phase when all nodes in the current phase pass

| Next Step | Skill | When |
|-----------|-------|------|
| Build Phase 1 features | `/new-feature` per node | Immediately after skeleton |
| Agent growth | `/evolution` | End of each session |
| Doc check | `/docs-check` | Before each push |

---

## Shortcuts

**Small apps** (utility, single-feature, personal tool):
- Phases 1+2: Quick domain check, skip competitive analysis
- Phase 3: Mini-PRD inline, skip progression model
- Phase 5: Simplified graph — fewer nodes, one-shot loop patterns
- Phase 7: Minimal skeleton

**Large apps** (multi-feature, content-heavy, multi-region):
- Each phase may span multiple sessions
- Phase 5 graph becomes the project's living roadmap across sessions
- Consider feature branches per graph phase

---

## Anti-Patterns

1. **Skip domain research**: Building the wrong thing. Phase 1 exists because domain conversations produce insights no coding session would discover.
2. **Install patterns blindly**: Read each pattern's README. CORS origins, OAuth providers, and config values must be set per-app.
3. **Build features during scaffolding**: The skeleton is routing + auth + AI gateway + PWA. Features come later via `/new-feature`.
4. **Write a prose dependency list instead of a graph spec**: "Auth before gateway" is not a graph. A graph spec names the agent, inputs, outputs, loop pattern, and success criteria for every node.
5. **Skip loop specs**: Without verify steps and retry strategies, agents attempt once and move on. Loop specs force iteration until success criteria pass.
6. **Use Vercel serverless functions**: All server-side logic goes in Supabase Edge Functions.
7. **Put API keys in VITE_ variables**: Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` on the client.
8. **Scaffold without claiming a port**: Check `port-registry.md` first.

---

**Remember**: The graph engineering document is the artifact that makes this skill powerful. A new Claude Code session reads `docs/graph-engineering.md` and knows exactly what to build, with what agent, verified how, in what order. Without it, every session re-derives the build plan from scratch.
