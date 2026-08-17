# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-16 — Art Classes Feature Sensitivity Review

### What I Reviewed
ClassSheet.tsx, ClassMarker.ts, LevelPips.tsx, MapModeFilters.tsx, classData.ts, types.ts — the full classes discovery feature for newcomers to Chicago theater.

### What Works Well
- Financial accessibility chips (PAYMENT PLAN, FINANCIAL AID, SLIDING SCALE) normalize asking about affordability
- "NO EXPERIENCE NEEDED" is warm and inviting
- "Just show up" for drop-ins removes commitment friction
- "WHERE IT STARTS" reframes what could be "SKILL LEVEL" — centers the learner's journey
- Three map filters (ENROLLING, DROP-IN, NO EXPERIENCE) answer the three biggest newcomer anxiety questions

### Concerns
1. **"AUDITION REQUIRED"** in all-caps reads as gatekeeping. Soften to "audition to enroll" in sentence case, or pair with "all experience levels welcome at audition"
2. **"NEVER TAKEN A CLASS HERE"** emphasizes absence. Reframe: "Your first class here" or "Ready when you are"
3. **Bare "LEVEL 1-5"** creates hierarchy without narrative. Map to: "starting out," "some experience," "building on basics," "experienced," "advanced"
4. **"WAITLIST OPEN"** implies scarcity. Reframe: "Notify me when enrollment opens" — user agency over scarcity
5. **`drop-in` as both skill_level and class_format** in types.ts — categorical mismatch that could produce confusing UI
6. **"youth" as a discipline** alongside "improv," "acting," "writing" — describes age group, not art form

### Commitment
Pay closer attention to how numeric levels and gatekeeping labels land for domain newcomers. Numbers without narrative create hierarchies. Labels without context create walls.

