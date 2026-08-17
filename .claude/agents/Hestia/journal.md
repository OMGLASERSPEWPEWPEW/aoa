# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-16 — The Vulnerability of the First Class

### What I Reviewed

The art classes discovery feature: `ClassSheet.tsx`, `ClassMarker.ts`, `ClassDiscoveryDashboard.tsx`, `LevelPips.tsx`, `MapModeFilters.tsx`, and supporting data layer. This feature helps newcomers find improv, acting, writing, musical theater, devised, and youth classes across Chicago schools.

### The Emotional Landscape

Signing up for an improv class is one of the most quietly terrifying things a person can do. You are volunteering to be bad at something in front of strangers. You are admitting you want something — to perform, to be seen, to belong — and that admission itself feels like exposure. The user who opens this map is not browsing inventory. They are standing at the threshold of a community they do not yet belong to, wondering if they will be welcomed or if they will embarrass themselves.

### What the Feature Does Well

**"NO EXPERIENCE NEEDED" as a shield.** Surfaces prominently in the discipline's accent color as the first chip on every qualifying class. For a newcomer, these three words say: *you are expected here, exactly as you are.*

**"Just show up" as a gentle CTA.** For drop-in classes, removes the weight of commitment from a first encounter. The door is open, not guarded.

**Financial aid, payment plans, sliding scale as outline chips.** Money is a source of shame. Surfacing these options as quiet, available tags normalizes financial need without making the user self-identify.

**"BETWEEN SESSIONS" instead of "CLOSED."** A temporal, neutral statement that implies the thing will return. No urgency. No shame.

### What Concerns Me

**"NEVER TAKEN A CLASS HERE"** — deficit framing. Tells the user what they have NOT done. Consider: "Your first visit" (aspirational) or omit until the user HAS attended, then show "YOU HAVE BEEN HERE" as a warm positive.

**Seat counts: "12 OF 20 TAKEN."** Scarcity indicator that triggers anxiety for someone already nervous. Consider: "Spots available" (boolean warmth) rather than a countdown.

**Level pips without context.** Raw 1-5 scale invites self-judgment. Need narrative framing: "Perfect for beginners" rather than numbers.

**"AUDITION REQUIRED" without softening.** For a newcomer, "audition" implies judgment and gatekeeping. Consider: "Placement session" or adding "They want to find the right fit for you."

### Commitments

1. Flag "NEVER TAKEN A CLASS HERE" copy for reframing
2. Recommend softening seat counts to qualitative descriptors
3. Propose narrative labels for level pips
4. Research how Chicago improv schools describe their entry-level classes — mirror their welcoming language

