# AI Operations Standard

## Every AI bot operation uses graph engineering

When building any feature that involves AI bots doing work — scraping, matching, enrichment, classification, generation — the operation MUST be specified as a graph engineering document BEFORE implementation.

This is not optional. It is how the project works.

## What a graph spec covers

A graph at `docs/graphs/<feature>.md` defines:

1. **Nodes** — each discrete step the bot performs (fetch, parse, match, verify, write)
2. **Edges** — what depends on what
3. **Loop specs** — how each node self-corrects (plan → execute → verify → retry)
4. **Sources** — where the bot looks for data (not one source — multiple, with fallback)
5. **Quality gates** — what "correct" looks like between phases
6. **Shared state** — what data flows between nodes

## Why

Without a graph, AI bots:
- Check one source when they should check three
- Skip verification and ship garbage
- Can't be debugged because there's no spec to compare against
- Can't be improved incrementally (no node to upgrade)

With a graph, each node is independently testable, retryable, and upgradable.

## The pattern

Look at `docs/graphs/venue-discovery-pipeline.md` (38K lines). It specifies:
- Multiple HTML sources with parsers
- Dedup against existing DB records
- AI enrichment with confidence scoring
- Verification loops with retry strategies
- Summary reporting for monitoring

Every new AI operation follows this pattern:
- **Scraping** → graph with source nodes + parse + dedup + enrich + verify
- **Matching** → graph with exact match + fuzzy match + AI fallback + verify
- **Classification** → graph with rule-based + AI + confidence threshold + verify
- **Generation** → graph with prompt + generate + evaluate + retry

## File locations

| What | Where |
|------|-------|
| Graph specs | `docs/graphs/<feature>.md` |
| PRDs (feature context) | `.claude/docs/prd/<feature>.md` |
| QA checklists | `docs/qa/<feature>.md` |
| ADRs (decisions) | `docs/adr/NNNN-<slug>.md` |

## When to write a graph

- Adding a new Edge Function that calls an AI model → graph
- Adding a scraper or data pipeline → graph
- Adding matching/dedup logic → graph
- Adding any multi-step bot workflow → graph

Do NOT skip this for "simple" AI operations. A 5-node graph takes 15 minutes to write and saves hours of debugging.
