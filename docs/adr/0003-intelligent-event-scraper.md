# ADR 0003: Deterministic Crawl Pipeline with AI Extraction (Scraper v2)

**Date:** 2026-08-11
**Status:** Proposed
**Feature:** Intelligent Event Scraper (Multi-Pass Extraction v2)

## Context

The v1 event scraper fetches one URL per venue and calls DeepSeek twice (extract then verify). 60% of extracted events have NULL start_date because many theater calendar pages list show titles without dates — the actual dates are on linked detail pages. The scraper needs multi-page extraction capability.

Four external AI models (GPT-5.5, Gemini 3.1 Pro, DeepSeek V4 Pro, Claude Opus 4.8) were consulted on architecture. All four agreed on the core pattern.

## Decision

**Deterministic mini-crawler with AI-assisted extraction.** The LLM is used ONLY for HTML→JSON extraction (the thing it's uniquely good at). Everything else — completeness scoring, link extraction, link ranking, loop control, merge logic, gap annotation — is pure deterministic code.

This is distinct from a "fully agentic" approach where the LLM drives decisions about what to do next.

## Alternatives Considered

- **Fully agentic AI loop (LLM decides completeness, scores links, picks actions):** Maximally flexible but blows the $0.01/venue budget — every decision costs an API call. Non-deterministic, hard to debug, latency stacks against 120s wall clock. All four external models recommended against this.

- **Aggregator-first strategy (scrape HotTix/TodayTix before venue sites):** Clean structured data, but doesn't cover smaller indie theaters, adds ToS/legal risk, requires separate pipelines per aggregator. Deferred to a future phase as a fallback source after primary scraping.

- **Per-venue custom rules/templates:** Very effective for 135 known venues, but maintenance burden when websites change. Fragile and not generalizable. Rejected.

- **Two-phase batch (discover URLs in one call, extract in another):** Natural fit but adds orchestration complexity and requires persisting crawl state between Edge Function invocations. Rejected for v2 — if single-call link following proves insufficient, this is the next step.

## Consequences

- **Positive:** Deterministic pipeline is testable, debuggable, reproducible. Budget constraints are enforced in code. Link scoring heuristics are fast and free. Strategy traces enable data-driven optimization.
- **Positive:** Gap annotation (extraction_status, missing_fields) prevents infinite retry loops on venues that genuinely don't have dates online.
- **Negative:** Heuristic link scoring may miss some relevant pages. Requires tuning after initial deployment.
- **Negative:** JS-rendered content (dates only visible after JavaScript runs) will still be missed — annotated for manual review but not solved.
- **Neutral:** Batch size reduced from 2 to 1 venue per Edge Function call. More calls from the frontend loop, but each one completes reliably.
