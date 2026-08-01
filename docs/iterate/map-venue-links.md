# Map Venue Links Broken

**Category:** bug
**Status:** pending
**Phase:** 3
**Priority:** P2

## User's Original Request
> Website doesn't work for some. Like we shouldn't add a website unless one is found. We want direct links.

## Diagnosis
VenueSheet.tsx (lines 284-306) renders a "WEBSITE" link using `venue.website_url` with no URL validation. If a venue has a malformed URL (missing protocol, trailing spaces, invalid format), the browser treats it as a relative path and navigation fails.

No sanitization or validation exists. The anchor tag blindly uses whatever string is in the database.

**Root cause:** No URL validation on venue website_url before rendering the link.

**Files involved:**
- `src/components/VenueSheet.tsx` lines 284-306 — add URL validation, hide link for invalid URLs

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Add URL validation helper: check for valid protocol (https://, http://)
  2. Only render "WEBSITE" link if URL passes validation
  3. Ensure URLs without protocol get prefixed with https://
  4. Audit venues table for malformed website_url values
- **Files:** src/components/VenueSheet.tsx
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** unit test for URL validation, e2e for venue sheet link behavior
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → dev-server → click venue links on map
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | Website links don't work, only show direct links |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
