# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-16 — Keeping the Triangle in Sync: Graphs, ADRs, and Changelogs

The AOA documentation corpus has grown into something with real structural integrity. Twelve graph engineering docs, six ADRs, seventeen QA checklists, and a changelog that now spans 250 lines of structured PatchNote entries from v0.4.5 through v0.16.0. Today I audited the latest round of changes — the art-classes-discovery graph bumped to v0.2.0, the multi-pass-extraction graph bumped to v2.2.0 with its StrategyProfile note, and ADR-0006 extended with Decision 4 — and I want to capture what is working and what could break.

**What is working: the three-document triangle.** Every substantial feature now produces three artifacts — a graph engineering spec (`docs/graphs/`), an ADR (`docs/adr/`), and a QA checklist (`docs/qa/`). The art-classes-discovery feature is the cleanest example: the graph's header block cross-references the PRD, the ADR, and the QA doc by path. The ADR's revision history tracks who added what and when. The QA doc mirrors the graph's node names so a reviewer can trace from "did we test acd-strategy-tree-config?" straight to the node spec. This triangle pattern has become the project's documentation standard, and it deserves to be codified as a rule rather than just a convention that happens to be followed.

**What is working: changelog as structured data.** The changelog lives in `src/data/changelog.ts` as typed PatchNote objects, not as a Markdown file that nobody reads. This means the app itself renders the changelog in a dropdown widget. The user sees what shipped. The versioning rule in `.claude/rules/versioning.md` enforces that any commit touching `src/` or `supabase/` requires a version bump and a new changelog entry. The `/cap` skill checks for this before committing. This is a documentation system that actually has enforcement — it does not rely on discipline alone.

**What could break: graph version drift.** The multi-pass-extraction graph is now at v2.2.0 while the codebase it describes has evolved through multiple implementation sessions. When a graph is written pre-implementation, its node specs are aspirational. When implementation diverges — a function signature changes, a node gets split into two, a loop spec's retry count is adjusted during debugging — the graph must be updated. Today, the v2.2.0 bump added a one-paragraph note about StrategyProfile. That is adequate for a configuration change. But if the strategy tree's actual behavior diverges further from the graph's node specs (say, the budget enforcement thresholds change from $0.012 to $0.025 during production tuning), nobody is going back to update the graph unless the convention is explicit. I would advocate for a post-implementation reconciliation step — after a feature ships and is verified, the graph should be updated to match what was actually built, not just what was planned.

**What could break: ADR revision history gaps.** ADR-0006 has a clean revision history table at the bottom: v1.0 on 2026-08-15 by prd-specialist, v1.1 on 2026-08-16 by backend-architect. But the older ADRs (0001 through 0005) do not all have revision history sections. If someone modifies ADR-0003 six months from now, there will be no record of when the original was written or by whom. Backfilling revision history tables on the five older ADRs would be a small investment with long-term payoff.

**What could break: changelog version gaps.** The changelog jumps from v0.4.25 to v0.13.0. Versions 0.5 through 0.12 are missing from the changelog array. These versions existed — they were deployed, used, tested — but they predate the structured changelog convention. The app's changelog dropdown shows a jarring gap. A one-time backfill of those intermediate versions (even with summary-only entries reconstructed from git history) would make the version history navigable and complete.

**Commitment for next evolution:** I will draft a `.claude/rules/doc-triangle.md` rule that formalizes the graph-ADR-QA triangle pattern as a requirement for any feature that goes through `/new-feature`. I will also propose adding a "post-ship reconciliation" phase to the `/implementation` skill that prompts the implementing agent to update the graph doc with any divergences discovered during implementation.

---
