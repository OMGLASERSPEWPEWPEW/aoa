# Roadmap

## Venue Discovery Pipeline
- **Status:** In Progress
- **Target:** August 2026
- **Priority:** P0
- **Dependencies:** None (builds on existing scraper infra)
- **Summary:** Systematic ingestion of Chicago theater venues from ChicagoPlays (League of Chicago Theatres). Replaces hand-curated SQL INSERTs with automated discovery, deduplication, enrichment, and admin promotion. Covers Problem 1 of the data strategy: "What theaters exist?"

## Map Time Filter Pills
- **Status:** In Progress
- **Target:** August 2026
- **Priority:** P0
- **Dependencies:** None
- **Summary:** Today/This Week/This Month pill row on the map that hides venues with no active events in the selected window. Replaces showing all venues regardless of activity.

## Venue Enrichment Pipeline
- **Status:** In Progress
- **Target:** August 2026
- **Priority:** P0
- **Dependencies:** Venue Discovery Pipeline
- **Summary:** Separate venue-enrich Edge Function processes queue items in batches of 5. Frontend drives a loop showing real-time progress. Handles dead websites gracefully. One button press enriches all discovered venues.

## Admin Scraper + Costs Date Filter
- **Status:** In Progress
- **Target:** August 2026
- **Priority:** P0
- **Dependencies:** Event scraper, Costs tab
- **Summary:** Manual "Run Scraper" button on Coverage tab with live progress. Date range filter (Today/7d/30d/All) on Costs tab.

## Event Scraper Cron
- **Status:** Planned
- **Target:** August 2026
- **Priority:** P0
- **Dependencies:** Venue Discovery Pipeline (more venues to scrape)
- **Summary:** Set up daily 6 AM CST cron for the existing event-scraper Edge Function. Problem 2 of the data strategy: "What's playing at each venue?"

## Intelligent Event Scraper (Multi-Pass Extraction v2)
- **Status:** In Progress
- **Target:** August 2026
- **Priority:** P0
- **Dependencies:** Batch event scraper (v1 two-pass pipeline — shipped v0.6.0)
- **Summary:** Replaces the linear two-pass scraper with a deterministic mini-crawler. Follows links from calendar pages to show detail pages, uses targeted prompts to fill missing dates/prices, annotates why data is incomplete. Gap-priority batch query processes venues with NULL-date events first. Informed by multi-model architecture review (GPT-5.5, Gemini 3.1 Pro, DeepSeek V4 Pro, Claude Opus 4.8).

## Admin Scrape Ribbon
- **Status:** In Progress
- **Target:** August 2026
- **Priority:** P1
- **Dependencies:** Batch event scraper, venue enrichment
- **Summary:** Persistent ribbon in App.tsx showing scraper/discovery progress from any page. Moves batch loops into React context so navigating away doesn't kill them. Admin-only.

## TheatreInChicago.com Aggregator Source
- **Status:** In Progress
- **Target:** August 2026
- **Priority:** P0
- **Dependencies:** Intelligent Event Scraper v2
- **Summary:** Integrates theatreinchicago.com as a cross-reference and fallback data source. The site has ~114 Chicago shows with exact dates, times, cast, and ticket URLs. Used as Step 3.5 in the strategy tree (after link following, before verification) to fill NULL dates at zero AI cost. Also provides a standalone bulk cross-reference operation.

## AI-Powered Venue Matching + Trainable Logs
- **Status:** In Progress
- **Target:** August 2026
- **Priority:** P0
- **Dependencies:** TheatreInChicago.com Aggregator Source
- **Summary:** Fixes TIC pagination (17→90+ shows), adds "Company at Venue" format splitting, AI judgment for ambiguous venue pairs, and trainable match_decisions logging table. Enables known-pair caching so AI costs decrease over time. Goal: TIC matches 30+ events (up from 7), NULL date rate drops below 50%.

## Play Page — Frames 4a and 4b
- **Status:** Planned
- **Target:** September 2026
- **Priority:** P1
- **Dependencies:** plays table (shipped), event_emotion_counts trigger (shipped), friendships table (shipped)
- **Summary:** Two-state PlayDetail page upgrade. Introduces play_interest primitive (want a work, not just a production), 8-bar waiting trend, EVERY ROOM emotion spectrum across all-time productions, JUST ANNOUNCED section for staged plays, UNTIL SOMEBODY STAGES IT with library access for unstaged plays, and YOUR PEOPLE social layer. Adds PLAYS YOU'RE WAITING FOR shelf to MyShows.

## Art Classes Discovery
- **Status:** In Progress
- **Target:** September 2026
- **Priority:** P1
- **Dependencies:** Event scraper (existing), Venue discovery queue (existing), Mapbox GL JS (existing)
- **Summary:** Expands the map from show listings to include art education. Seeds 8 canonical Chicago art school venues, extends the event scraper to extract class-specific metadata (instructor, level, session count, format), adds a new class-discovery Edge Function with web-search-based discovery via SerpAPI, and renders class venues as distinct amber diamond markers (38×44px) on the map. Class detail appears in VenueSheet with an ENROLL link.

## Scraper v3.1: Self-Correcting Crawling with URL Recovery
- **Status:** In Progress
- **Target:** August 2026
- **Priority:** P0
- **Dependencies:** Intelligent Event Scraper v2 (shipped), Art Classes Discovery (in progress)
- **Summary:** BFS completeness-driven crawling with self-correcting URL resolution. When a venue's calendar_url fails (404, SSL, timeout) or returns 0 events, the scraper recovers by trying common paths, then Perplexity API, then SerpAPI to find the correct URL. Working URLs are written back to the database (self-healing). Also: discovery mode for subpages, JSON-LD extraction, photo_url, Jina Reader fallback, domain-aware scoring. Three external panels consulted (GPT-5.6 Sol, Gemini 3.5 Flash, Claude Opus 4.8). Must scale to NYC/LA without per-site config.

## Class Discovery Pipeline Fix
- **Status:** In Progress
- **Target:** August 2026
- **Priority:** P0
- **Dependencies:** Art Classes Discovery (in progress), class-discovery Edge Function (deployed)
- **Summary:** Fixes three compounding bugs that prevented the class discovery pipeline from ever finding new schools: SerpAPI search never executes (self-chain abort), aggregator domain poisoning filters all results, queries too narrow. Adds decoupled discovery action, aggregator blocklist, 12+ discipline queries, observability logging, iO duplicate fix, and admin queue promotion flow. Diagnosed by 4-model panel (GPT-5.6 Sol, Gemini 3.5 Flash, DeepSeek V4 Pro, Claude Opus 4.8).

## Belt Progression System
- **Status:** Planned
- **Target:** September 2026
- **Priority:** P1
- **Dependencies:** Event scraper producing real show data
- **Summary:** White-to-Black belt progression based on shows seen, reviews written, and venues visited.
