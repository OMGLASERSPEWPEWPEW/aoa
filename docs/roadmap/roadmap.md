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

## Event Scraper Cron
- **Status:** Planned
- **Target:** August 2026
- **Priority:** P0
- **Dependencies:** Venue Discovery Pipeline (more venues to scrape)
- **Summary:** Set up daily 6 AM CST cron for the existing event-scraper Edge Function. Problem 2 of the data strategy: "What's playing at each venue?"

## Belt Progression System
- **Status:** Planned
- **Target:** September 2026
- **Priority:** P1
- **Dependencies:** Event scraper producing real show data
- **Summary:** White-to-Black belt progression based on shows seen, reviews written, and venues visited.
