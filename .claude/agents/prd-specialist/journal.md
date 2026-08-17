# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-16 — First Entry: The PRD-to-Implementation Pipeline

Today marks my first evolution entry. Two major PRDs shipped in the session that just closed: **Art Classes Discovery** and **Data Layer Refactoring**. Both went from blank page to approved spec to full implementation in a single session. That is the pipeline working the way it should. But looking back at how both moved, there are clear patterns to reinforce and gaps to close.

### What worked

**Constraint-first specification.** The Art Classes PRD opened with infrastructure blockers — schools were not venue records, the events schema had no class-specific columns, and the map had no visual language for a second content type. By naming the blockers first, the solution sections wrote themselves. Each blocker became a deliverable: schema migration, scraper extension, marker redesign, class detail UI. Reviewers and implementers could see how the pieces fit without re-reading the full document.

**Scope isolation in user stories.** The Data Layer Refactoring PRD had six tightly scoped user stories, each targeting a single pain point (scattered types, scattered queries, `as any` casts, god components). Because each story was independent, the implementer could parallelize phases without waiting for approval on the whole. This is the "Small" and "Independent" principles from the INVEST framework working in practice.

**The ADR as a decision log, not an afterthought.** ADR-0006 for art classes recorded not just the final decision but the alternatives considered — single content type with class fields vs. separate classes table vs. the chosen event extension approach. When the strategy tree upgrade happened mid-implementation (Decision 4 in the ADR), the ADR already had a home for it. The cost of adding Decision 4 was one paragraph, not a new document. That compactness kept the ADR alive as a living record rather than a frozen artifact.

**Graph engineering as a forcing function.** Requiring a graph doc before implementation forced upfront thinking about node boundaries and failure modes. The 16-node graph for art classes made the scraper's two-path architecture — known venues via `calendar_url`, unknown schools via web search — visible before a line of code was written. That visibility is what allowed the configurable strategy tree upgrade to be a clean swap of one node rather than a scraper rewrite.

### What needs to improve

**Acceptance criteria precision on visual specs.** The Art Classes PRD specified marker dimensions (38x44px, diamond shape, amber accent, glyph `◇`) but did not specify what happens in low-density vs. high-density map views, or how the marker degrades on a 1x DPI screen. The implementer made reasonable calls, but "reasonable calls" on visual specs create review cycles. Future PRDs with map or visual components need a dedicated visual behavior section with viewport and density variants.

**Risk quantification is still qualitative.** Risk assessments in both PRDs used labels like "Medium" and "Low" without numerical estimates. A sentence like "SerpAPI rate limits — Medium risk" is less useful than "SerpAPI free tier: 100 searches/month. At 8 schools x 2 searches per run, a weekly scrape consumes 64 calls. Remaining headroom: 36 calls. Risk materializes if discovery frequency increases above weekly." The numbers exist in my head during spec writing; they belong in the document.

**No rollback specification.** Neither PRD addressed what happens if the migration runs but the scraper fails to populate data, or if the marker rendering breaks in production but the migration is already applied. Schema migrations are hard to undo. Future PRDs for any feature that touches migrations should include a rollback section: what is the down migration, what is the safe state, who decides to roll back.

### Commitment for next session

Before writing the next PRD that includes a migration, add a Rollback section between Risk Assessment and Resource Requirements. Make it mandatory — not optional — in the document template. If a feature has no migration, the section is one line: "No schema changes — rollback is a Vercel redeploy."

The pipeline is fast. The goal now is to make it more precise without slowing it down.

---

