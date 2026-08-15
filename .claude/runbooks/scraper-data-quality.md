# Scraper Data Quality — Operational Runbook

## TIC (theatreinchicago.com) Integration

### Rule: Always test pagination params against the live site

**Wrong**: Assumed `?viewall=1` worked. Shipped code that only parsed 17 of 90 shows.
**Right**: `curl` the live page, check pagination links, extract the actual URL params. TIC uses `?pageNum_rsComingSoon=N&totalRows_rsComingSoon=90`.
**Why**: Aggregator sites have custom pagination — there's no standard. Always verify by inspecting the actual HTML.

### Rule: TIC lookups must search ALL listing pages, not short-circuit

**Wrong**: `if (comingSoon.matches.length > 0) return` — skipped Now Playing entirely.
**Right**: Search Coming Soon AND Now Playing, return combined matches.
**Why**: A show can be on Now Playing (currently running) while a different show at the same venue is on Coming Soon. Short-circuiting misses the now-playing show.

### Rule: TIC Now Playing has NO dates on listing — always fetch detail pages

**Wrong**: `ticShowsToEnrichments` filtered out shows without dates, silently dropping all Now Playing shows.
**Right**: For shows without dates, fetch the TIC detail page (`/show-slug/ID/`) which has full dates, times, and tickets.
**Why**: Only Coming Soon listings have `<span class="open-date">`. Now Playing shows require a detail page fetch.

### Rule: "Thru" date format means show is running NOW — set start_date to today

**Wrong**: TIC detail page says "Thru - Aug 23, 2026" → parser only extracted `endDate`, left `startDate` null.
**Right**: When date text matches `/thru/i`, set `startDate` to today's date.
**Why**: "Thru" means "currently running until X". The show opened at some unknown past date but is active now.

## Time Filters

### Rule: Events with end_date but no start_date should still show on the map

**Wrong**: `if (!event.start_date) return false` in both `isUpTonight` and `overlapsWindow`.
**Right**: `if (!event.start_date && !event.end_date) return false` — if end_date exists and is in the future, the event is probably running now.
**Why**: "Thru" events, backfilled events, and imported events may have end_date without start_date.

## Venue Name Matching

### Rule: Handle "Company at Venue" format by trying both the full name and the venue-only part

**Wrong**: "Music Theater Works at North Shore Center" scored 0.50 against "North Shore Center for the Performing Arts".
**Right**: If score < 0.6 and name contains " at ", split and try matching just the venue part after " at ".
**Why**: TIC listing pages include the producing company in the venue name field.
