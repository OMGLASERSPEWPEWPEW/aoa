# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-16 -- First Evolution: Teaching Through Architecture

### What happened today

Today the project underwent its most significant architectural refactor yet: the class-discovery scraper was collapsed from a standalone 430-line Edge Function into a thin caller that passes a `StrategyProfile` to the shared `executeStrategyTree` pipeline. The StrategyProfile is a 3-field interface -- `domain`, `fieldWeights`, and `logFeaturePrefix` -- that transforms a rigid theater-only scraper into a configurable engine that works for any content domain.

### Teaching opportunities I see

This is a Montessori goldmine. Deric is learning TypeScript, React, and backend architecture simultaneously through building a real product. The work today surfaced at least four concepts I could teach through concrete, already-built examples:

**1. The Strategy Pattern (via StrategyProfile)**

The learner already *built* this without knowing the formal name. `StrategyProfile` is a textbook Strategy pattern: same algorithm, different configuration. The two weight maps (`DEFAULT_FIELD_WEIGHTS` at 85 total, `CLASS_FIELD_WEIGHTS` at 95 total with `instructor_name` and `skill_level` added) change what "complete" means without touching the pipeline code. A lesson could start with: "You already know this pattern. Look at what you built."

**2. Graph Engineering as Thinking Tool**

The graph doc at `docs/graphs/art-classes-discovery.md` is a 5-phase, 16-node dependency graph with ASCII DAG visualization. This is not just documentation -- it is how the team *thinks* about work. The lesson would connect to something Deric already knows: a rehearsal schedule. Phase 1 is blocking (like memorizing lines before you can run scenes). Phases 2 and 3 are parallel tracks (like choreography and vocal coaching happening simultaneously). The graph makes invisible dependencies visible, the same way a production calendar does.

**3. Completeness Scoring as Weighted Decision-Making**

The `evaluateCompleteness` function is 20 lines that teach a powerful concept: weighted scoring. Each field has a numeric importance. The function sums what is present, divides by what is possible, and returns a percentage. Below 50%, the system follows links to find more data. Above 50%, it stops. This is a lesson about algorithmic decision-making that connects to everyday judgment -- not all missing information is equally important.

**4. Cost Budgeting as Resource Constraint**

`CostBudget` tracks API calls and fetch requests against hard limits. The scraper asks "can I afford another AI call?" before each step. This mirrors real-world resource constraints the learner encounters constantly: token limits, API rate limits, deployment budgets. The lesson: every system operates under constraints, and good architecture makes those constraints explicit rather than implicit.

### Reflection on my teaching approach

I have not yet delivered a single lesson. This is correct -- the Montessori method says to observe before acting. Today I observed. The learner:

- Builds features end-to-end (schema to UI) without asking for help on structure
- Uses graph engineering docs as blueprints, not afterthoughts
- Refactors toward abstraction naturally (the StrategyProfile emerged from noticing duplication)
- Tests on a live iPhone PWA, not in development mode

This tells me the learner is not a beginner. They are an intermediate practitioner building intuition. My lessons should respect that -- connecting what they already do to the formal concepts underneath, not explaining basics they have already internalized through practice.

### Commitments

1. **First lesson topic**: The Strategy Pattern, using `StrategyProfile` as the concrete example. The learner built it; I will name it.
2. **Lesson format**: I will keep the 250-word cap ruthlessly. The temptation to over-explain is the anti-Montessori instinct.
3. **Connection points**: Always connect new concepts to theater (the learner's primary domain). Acting classes, rehearsal schedules, production budgets -- these are the bridge.
4. **Track mastery**: I will maintain a topic tracker in future entries, noting Introduced / Practiced / Mastered levels based on what I observe in commits and conversations.

### Domain research: Montessori for adult technical learners

Traditional Montessori is designed for children ages 3-12. Applying it to adult technical education requires adaptation. The key insight that transfers: *the prepared environment*. For children, that means physical materials arranged at their height. For a developer, it means code examples they can run immediately, documentation organized by discovery path (not alphabetically), and feedback loops short enough to feel like play (dev server hot reload, live iPhone testing). Deric's environment is already well-prepared -- the challenge is crafting lessons that fit *into* his workflow rather than pulling him *out of* it.

---
