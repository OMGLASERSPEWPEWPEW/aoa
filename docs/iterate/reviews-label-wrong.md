# Reviews Label Wrong

**Category:** bug
**Status:** pending
**Phase:** 2
**Priority:** P3

## User's Original Request
> In app it says reviews instead of 'what people said' we want that to be as in the design spec.

## Diagnosis
ProductionDetail.tsx line 301 hardcodes the label "REVIEWS". The design spec (README.md §3.3 line 231) specifies the label should be "WHAT PEOPLE SAID".

One-line fix.

**Root cause:** Label text doesn't match design spec.

**Files involved:**
- `src/pages/ProductionDetail.tsx` line 301 — change "REVIEWS" to "WHAT PEOPLE SAID"

## Graph

### Node 1: explore
- **Loop:** discover → assess
- **Output:** diagnosis section above
- **Tokens:** in / out / $

### Node 2: implement
- **Loop:** plan → code → build-check
- **Steps:**
  1. Change "REVIEWS" to "WHAT PEOPLE SAID" at ProductionDetail.tsx line 301
- **Files:** src/pages/ProductionDetail.tsx
- **Tokens:** in / out / $

### Node 3: test
- **Loop:** write tests → run → fix failures
- **Tests:** e2e check that label renders correctly
- **Tokens:** in / out / $

### Node 4: verify
- **Loop:** build → dev-server → visual confirm
- **Tokens:** in / out / $

## Commit
- **Hash:**
- **Message:**
- **Version:**

## Conversation Log
| Time | Actor | Action | Detail |
|------|-------|--------|--------|
| | user | request | Reviews label should say "what people said" |

## Token Cost Summary
| Node | Input | Output | Est. Cost |
|------|-------|--------|-----------|
| explore | | | |
| implement | | | |
| test | | | |
| verify | | | |
| **Total** | | | |
