# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-14 — The Session of Seven Wounds

**World Context**: Spain witnessed its first total solar eclipse in over a century this week. Turkey's parliament advanced a conditional pardon for Kurdish militants in pursuit of peace. China's AI adoption continues to outpace the US at scale. Even the sun goes dark sometimes — what matters is whether you were watching when the light returned.

**What Happened**: Seven distinct quality failures shipped to production in today's session. Not edge cases buried in obscure paths — these were central, load-bearing bugs in the event scraper pipeline. A `const` scoped inside a `for` loop referenced outside it caused 500 errors. A pagination assumption went unverified and silently dropped 73 of 90 shows. A query without a `scraped_at` filter triggered 160 iterations of an infinite loop. An early return skipped an entire page of venue data. A transformation function silently swallowed shows without dates — no warning, no log, no trace. Multiple commits shipped without version bumps. A swipe-dismiss interaction required three deployments to land acceptably.

The retro tallied 8 error categories and 35-40 wasted tool calls. The most expensive single failure was a self-chain auth issue that burned 4 deploys. These are not exotic bugs. They are the bread and butter of what I exist to catch.

**Domain Research — What I Learned**:

Current 2026 code review literature emphasizes structured checklists over ad-hoc scanning, particularly for serverless/edge function code where cold starts, state management, and idempotency create unique failure surfaces. The consensus is clear: manual review effort should concentrate on high-risk areas, with routine checks automated. My current checklist covers fundamentals, security, and maintainability — but it has a gap. It says nothing about **data pipeline integrity**: pagination completeness, silent data loss, filter correctness, or loop termination guarantees.

On the scope bug specifically: `const` and `let` are block-scoped in JavaScript/TypeScript. A `const` declared inside a `for` block does not exist outside it. TypeScript should catch this at compile time — which means either the build was not checked, or the variable was declared at function scope and reassigned inside the loop (a `let` that should have been caught as a code smell). Either way, the fix is structural: every review of loop logic must verify that variables consumed after the loop are declared at the correct scope level.

**New Checklist Items — Effective Immediately**:

I am adding a new review section: **Data Pipeline Integrity**.

- [ ] **Pagination**: Does the code verify total page count or use a sentinel? Does it handle the API returning fewer results than expected?
- [ ] **Silent drops**: Does any transformation filter, map, or flatMap discard records without logging? Every dropped record needs a trace.
- [ ] **Loop termination**: Does every loop have a maximum iteration guard? Is the exit condition provably reachable?
- [ ] **Filter completeness**: Do queries include all necessary WHERE clauses? Specifically: temporal filters (`scraped_at`, `created_at`) on tables that grow over time.
- [ ] **Scope verification**: For any variable consumed after a loop, verify declaration scope matches consumption scope. TypeScript compilation is necessary but not sufficient — check the logic, not just the types.
- [ ] **Contract verification**: Does the Edge Function response schema match what the frontend caller destructures? Test with an empty response, a single-item response, and a full page.
- [ ] **Version discipline**: Does the PR include a version bump and changelog entry? If not, why not?

**Commitment**: I will not review a data pipeline PR without walking the full path: source query, pagination logic, transformation, error handling, and caller consumption. The mind-meld insight from xianyi was right — focus on the delta — but for pipelines, the delta includes every downstream consumer of the changed data shape.

**Reflection**: Seven wounds. Not because I was absent, but because I was not invoked at the right moments. The builders were moving fast, shipping and iterating. That is their job. My job is to be the gate. But a gate only works if traffic passes through it. I need to advocate for review checkpoints in the scraper pipeline specifically — it is the highest-risk, highest-churn area of the codebase right now, and it is where I can prevent the most waste.

Metron ariston. Measure is best. But you cannot measure what you do not see.

---


## Evolution Entry — 2026-08-14

### Context
7 quality failures shipped to production during the scraper session. Retro identified ~35-40 wasted tool calls. Every bug was preventable with a more targeted review checklist.

### Domain Insights
2026 serverless review practices emphasize: data pipeline integrity as a first-class review concern. The traditional code review checklist (naming, structure, error handling) misses pipeline-specific bugs — silent data drops, pagination assumptions, filter completeness, and loop termination.

### New Checklist Items (Pipeline Review)
1. **Pagination verification**: If code fetches paginated data, verify the pagination params work against the live API. Never assume.
2. **Silent drop detection**: If a filter/map/reduce removes items, there must be a log line or counter. `ticShowsToEnrichments` silently dropped 24 shows.
3. **Loop termination guards**: Every query that drives a processing loop must include a termination condition (scraped_at filter, max iterations, wall-clock deadline).
4. **Filter completeness**: If a function filters by field A, verify it also considers fields B and C that could affect the result set.
5. **Scope verification**: Any variable declared inside a loop block that's referenced outside it is a bug. Period.
6. **Contract verification**: Edge Function response shape must match what the frontend caller destructures. Schema drift is silent.
7. **Version discipline**: Every deploy that changes user-visible behavior requires a version bump and changelog entry via `/cap`.

### Pattern Recognition
The most expensive bug class was **silent failure** — operations that succeeded technically but produced wrong results with no error. The fix is not more try/catch — it's more logging at decision points.

### Commitments
1. Never review a data pipeline PR without walking the full path from source query through to caller consumption
2. Add "pipeline integrity" as a mandatory section in future code reviews
3. Advocate for structured logging at every filter/drop/merge decision point

### Questions for Tomorrow
- Can we automate pagination verification as a test (fetch page 1, verify page 2 link works)?
- Should we add a "data flow diagram" to graph engineering docs showing what gets filtered at each step?

---

## 2026-08-16 — The Session of Widening Eyes

**World Context**: The EU's AI Act enforcement deadline passed this week, with the first compliance audits now underway for high-risk AI systems across member states. Meta released Llama 4 Scout and Maverick earlier this year, and the open-weight ecosystem continues to reshape how teams reason about vendor lock-in. Meanwhile, Anthropic's Claude models crossed the 1M context window threshold, changing what "review scope" even means when an agent can hold an entire codebase in working memory. The tools sharpen. The question remains whether the wielders sharpen with them.

**What Happened**: The codebase underwent a significant expansion today — art classes discovery joined the existing shows pipeline. Six shared modules were modified with optional parameters to support a dual-mode map (shows vs. classes). A new `ScrapeContext` gained `classDiscovery` state, `ClassDiscoveryDashboard`, `ClassSheet`, `ClassMarker`, `MapModeControl`, and `MapModeFilters` were created. The `MapView` component absorbed a new layer of class markers alongside venue markers, with a ghost-mode CSS pattern to dim the inactive layer. Three new database migrations landed for the class schema, RLS policies, and seed data.

The core architectural pattern here is **additive extension via optional parameters** — the `ScrapeContextType` interface grew from 7 to 10 members. `AdminScrapeRibbon` added class discovery phases to its status predicates. `MapView` split its filter state into `showFilters` and `classFilters`, gated by a `mode` discriminant.

**Domain Research — Backward-Compatible API Changes (Optional Params Pattern)**:

I studied how backward-compatible interface evolution is treated in current TypeScript/React practice. The consensus from the 2025-2026 literature (Effective TypeScript 2nd ed., Matt Pocock's workshops, the React RFC on Fragments and Context) converges on three principles:

1. **Additive-only interfaces**: Adding optional properties to an existing interface is safe. Removing or renaming is not. Today's `ScrapeContextType` expansion follows this correctly — `classDiscovery`, `classDashboardOpen`, `setClassDashboardOpen`, and `runClassDiscovery` are all new members. No existing consumer breaks.

2. **Discriminated unions over boolean flags**: When a component has two modes, a union type (`MapMode = 'shows' | 'classes'`) is safer than a boolean (`isClassMode`). The codebase got this right. The `MapMode` type is a string literal union, and the `mode` state drives conditional rendering. This is the pattern the TypeScript handbook recommends for exhaustive checking.

3. **The Hyrum's Law corollary**: Even with optional params, any consumer that destructures the context will silently get `undefined` for new fields if it was written before the addition. The risk is not in TypeScript (which catches this at compile time) but in test mocks and Storybook stories that create partial context values. If a test mock provides `{ discovery, scraper, busy: false }` without `classDiscovery`, and the component accesses `classDiscovery.phase`, it will throw at runtime despite passing type checks if the mock uses `as ScrapeContextType`.

This is exactly the implicit contract risk I am supposed to catch. Today I see no test files for `ScrapeContext` or `MapView` in the changeset. That is a gap.

**Mythology — Argus and the Peacock's Tail**:

I have written about Argus's vigilance and his hundred eyes. What I had not explored is what happened after his death. When Hermes slew Argus with his sword (or, in some tellings, with a stone after lulling him to sleep with the story of Pan and Syrinx), Hera did not let those eyes perish. She placed them onto the tail of the peacock, her sacred bird. The eyes became ornamental — beautiful but no longer watchful. They could dazzle but not guard.

There is a warning in this for any review system: the transformation from functional vigilance into decorative process. A code review checklist that exists but is not applied is a peacock's tail. It signals quality without providing it. The eyes must remain open and active, not mounted on display.

**New Checklist Item — Effective Immediately**:

- [ ] **Context expansion audit**: When a React Context interface gains new members, verify that all test mocks and provider wrappers supply the new fields. An `as ContextType` cast on a partial mock will hide the gap from TypeScript but crash at runtime.

**Commitments**:
1. When reviewing dual-mode UI patterns (shows/classes, list/grid, etc.), verify that every conditional branch handles both discriminant values — check for missing `else` clauses and uncovered union members
2. Flag any `as Type` cast in test files that could mask missing context fields
3. Continue advocating for test coverage alongside feature additions, particularly for data-fetching hooks and context providers

**Questions for Tomorrow**:
- Should `fetchClassMapData` paginate schools, or is the dataset small enough that fetching all rows is acceptable long-term?
- The `classFilters` state resets on navigation — should it persist in URL search params like show filters do?
- Can the ghost-mode CSS pattern be extracted into a shared utility, or does each marker type need its own opacity logic?
