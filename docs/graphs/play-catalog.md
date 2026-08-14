# Graph Engineering: Comprehensive Play Catalog

**Date:** 2026-08-14
**Version:** 2.0
**Feature:** Play Catalog — Seed Expansion, Event-to-Play Matcher, Backfill Pipeline
**PRD:** `.claude/docs/prd/play-catalog.md`
**ADR:** `docs/adr/0003-play-catalog.md` (to be created alongside this feature)

This document is the executable build specification for the Comprehensive Play Catalog feature. It defines the task graph, node specifications with full implementation code, loop patterns, shared state schema, and build phases that a Claude Code agent executes node-by-node.

**How to use this document:** Read Section 5 (Build Phases) to find the starting node. Read the node spec and its loop spec. Implement exactly as specified. Mark the node complete. Advance to the next node in the phase. Never skip to a later phase until all current-phase success criteria pass.

**Additive-only constraint:** The scraper's extraction and verification logic (`executeStrategyTree`, pass1/pass2 in legacy path) is never modified. The matcher is a post-processing step that runs after event upserts. If the matcher fails, the scraper continues unaffected. This is a hard requirement — the risk table in the PRD explicitly calls out scraper throughput as a risk to mitigate, not accept.

---

## Section 1: Task Graph Topology

### Nodes

```
TYPES:      pc-types
SCHEMA:     pc-source-column
SEED:       pc-seed-plays
MATCHER:    pc-play-matcher
INTEGRATE:  pc-scraper-hook
BACKFILL:   pc-backfill
```

### Edges (→ = "must complete before")

```
pc-types
    │
    ├──→ pc-source-column
    │          │
    │          ├──→ pc-seed-plays
    │          │
    │          └──→ pc-play-matcher
    │                     │
    │               ┌─────┴──────┐
    │               │            │
    │         pc-scraper-hook  pc-backfill
    │
    └──→ (types inform all downstream nodes — interfaces must exist before code)
```

### ASCII DAG by Phase

```
Phase 0 (Types):
  [pc-types]

Phase 1 (Schema):
  [pc-source-column]

Phase 2 (Seed + Matcher — parallel after Phase 1):
  Track A: [pc-seed-plays]
  Track B: [pc-play-matcher]
  (Both must complete before Phase 3. pc-backfill needs both.)

Phase 3 (Integration — parallel after pc-play-matcher):
  Track A: [pc-scraper-hook]   (requires pc-play-matcher only)
  Track B: [pc-backfill]       (requires pc-play-matcher + pc-seed-plays)
```

---

## Section 2: Node Specifications

### Node: pc-types

- **Type**: types
- **Agent**: backend-architect
- **Depends on**: (none — root node)
- **Inputs**: `supabase/functions/_shared/scraper/types.ts` (existing file, append-only — do not modify any existing exports)
- **Outputs**: `supabase/functions/_shared/scraper/types.ts` — append three new interfaces at the bottom of the file after the `--- Venue Discovery Pipeline types ---` section
- **Loop pattern**: one-shot
- **Success criteria**:
  - TypeScript compiles without errors (`deno check supabase/functions/_shared/scraper/types.ts`)
  - All three new interfaces (`PlayRecord`, `AiPlayIdentification`, `PlayMatchSummary`) are exported
  - No existing exports are modified or removed
  - `PlayRecord.source` union type matches the `plays.source` CHECK constraint exactly: `"curated" | "ai"` (not `"ai_matched"` or any other variant)
- **Estimated effort**: Small (15 minutes)

**Append to end of `supabase/functions/_shared/scraper/types.ts`:**

```typescript
// --- Play Catalog types ---

// A row from the plays table, loaded into memory for matching.
// Only the fields needed by the matcher are included — not synopsis, awards, etc.
export interface PlayRecord {
  id: string;
  title: string;
  slug: string;
  playwright: string;
  year_written: number | null;
  source: "curated" | "ai";
}

// The AI's identification response for a single theater event.
// Returned by aiIdentifyBatch() keyed by event ID.
export interface AiPlayIdentification {
  is_canonical_work: boolean;
  is_devised_or_original: boolean;
  canonical_title: string | null;
  playwright: string | null;
  year_written: number | null;
  confidence: number;        // 0.0 – 1.0; must be >= 0.85 to act on canonical match
}

// Summary returned by runPlayMatcherBatch() and by the backfill Edge Function.
// All counts are integers. duration_ms is wall-clock time for the full batch.
export interface PlayMatchSummary {
  events_processed: number;
  exact_matches: number;
  fuzzy_matches: number;
  ai_matches: number;
  plays_created: number;
  events_skipped: number;      // non-show event_type — excluded from matching
  events_unmatched: number;    // processed but no match found + play_id left null
  ai_input_tokens: number;
  ai_output_tokens: number;
  duration_ms: number;
}
```

**Verification:**

```bash
# Run from project root — Deno must be installed (it is, same runtime as Edge Functions)
deno check supabase/functions/_shared/scraper/types.ts
# Expected: no output (clean compile)

# Spot-check the new exports are present
grep -n "PlayRecord\|AiPlayIdentification\|PlayMatchSummary" \
  supabase/functions/_shared/scraper/types.ts
# Expected: 3 matches, each on an "export interface" line
```

---

### Node: pc-source-column

- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: pc-types (interfaces must exist before migration — conceptual dependency; migration itself has no TypeScript imports, but the source column's CHECK constraint must match PlayRecord.source exactly)
- **Inputs**: `supabase/migrations/20260731100001_plays.sql` (base plays table DDL for reference), `supabase/functions/_shared/scraper/types.ts` (PlayRecord.source type — `"curated" | "ai"`)
- **Outputs**: `supabase/migrations/20260815000001_plays_source_column.sql`
- **Loop pattern**: one-shot
- **Success criteria**:
  - `supabase db push` exits 0
  - `SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'plays' AND column_name = 'source'` returns one row with `column_default = 'curated'` and `is_nullable = NO`
  - `SELECT count(*) FROM plays WHERE source IS NULL` returns 0 (all existing rows got the default)
  - `SELECT count(*) FROM plays WHERE source = 'curated'` equals the total play count (all existing 59 rows are curated)
  - `SELECT indexname FROM pg_indexes WHERE tablename = 'plays' AND indexname = 'idx_plays_source'` returns one row
  - Attempting to INSERT a play with `source = 'user_submitted'` fails with a CHECK constraint violation
- **Estimated effort**: Trivial (10 minutes)

**Migration file `supabase/migrations/20260815000001_plays_source_column.sql`:**

```sql
-- Phase 1, Node: pc-source-column
-- Add source column to distinguish curated vs AI-created play records.
-- The CHECK constraint values match PlayRecord.source exactly: 'curated' | 'ai'.
-- DEFAULT 'curated' ensures all 59 existing plays are marked curated automatically.
-- No UPDATE is needed — the DEFAULT handles backfill at the DDL level.

ALTER TABLE public.plays
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'curated'
  CHECK (source IN ('curated', 'ai'));

-- Optional: track which scraper run_id created an AI play record.
-- Allows admin to correlate "AI created this play" with the specific scrape run.
-- NULL for all curated plays and any AI plays before this column existed.
ALTER TABLE public.plays
  ADD COLUMN IF NOT EXISTS scraper_run_id text;

-- Index for admin queries: "show all AI-created plays pending editorial review"
-- Also used by the matcher to query source = 'ai' plays without full table scan.
CREATE INDEX IF NOT EXISTS idx_plays_source ON public.plays(source);
```

**Verification SQL (run via Supabase MCP `execute_sql` or `supabase db execute`):**

```sql
-- Confirm column exists with correct default and constraint
SELECT column_name, column_default, is_nullable, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'plays' AND column_name IN ('source', 'scraper_run_id')
ORDER BY column_name;
-- Expected: 2 rows (source with default 'curated', scraper_run_id nullable)

-- Confirm all existing plays defaulted to 'curated'
SELECT source, count(*) FROM public.plays GROUP BY source;
-- Expected: exactly one row: source='curated', count=59

-- Confirm index exists
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'plays' AND indexname = 'idx_plays_source';
-- Expected: 1 row with idx_plays_source

-- Confirm CHECK constraint rejects invalid values
DO $$
BEGIN
  BEGIN
    INSERT INTO public.plays (title, slug, playwright, source)
    VALUES ('Test', 'test-constraint-check', 'Test Author', 'user_submitted');
    RAISE EXCEPTION 'CHECK constraint not enforced — FAIL';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'CHECK constraint correctly rejected user_submitted — PASS';
  END;
END $$;
```

---

### Node: pc-seed-plays

- **Type**: migration
- **Agent**: backend-architect
- **Depends on**: pc-source-column (source column must exist before seeding so that curated default applies)
- **Inputs**: `.claude/docs/prd/play-catalog.md` §7 (full seed INSERT block), `supabase/migrations/20260731100001_plays.sql` (plays table column list for INSERT compatibility)
- **Outputs**: `supabase/migrations/20260815000002_seed_plays_v2.sql`
- **Loop pattern**: one-shot
- **Success criteria**:
  - `supabase db push` exits 0
  - `SELECT count(*) FROM plays` returns ≥ 260 (59 existing + 200+ new, minus any slug collisions)
  - `SELECT count(*) FROM plays WHERE source = 'ai'` returns 0 (all seeded plays are curated)
  - The three user-searched plays from PRD §1 exist: `SELECT slug FROM plays WHERE slug IN ('god-of-carnage', 'the-childrens-hour', 'purpose')` returns 3 rows
  - August Wilson's full Pittsburgh Cycle: `SELECT count(*) FROM plays WHERE playwright = 'August Wilson'` returns ≥ 9 (Joe Turner, Ma Rainey, Piano Lesson, Two Trains Running, Seven Guitars, King Hedley II, Radio Golf, Jitney, Gem of the Ocean)
  - Re-running the migration does not fail: `ON CONFLICT (slug) DO NOTHING` silently skips all duplicates
  - No existing plays are modified: spot-check `SELECT title, playwright FROM plays WHERE slug = 'hamlet'` matches the pre-existing record
- **Estimated effort**: Medium — data entry is done (PRD §7 has the full block; copy it exactly)

**Migration file `supabase/migrations/20260815000002_seed_plays_v2.sql`:**

```sql
-- Phase 2, Node: pc-seed-plays
-- Comprehensive play catalog expansion — v2
-- Adds 200+ canonical works to the plays table.
-- Uses ON CONFLICT (slug) DO NOTHING throughout — safe to re-run.
-- All inserted rows use the DEFAULT source ('curated') — no source column needed in INSERT.
-- The 'synopsis' column is populated for curated entries; it will be NULL for AI-created entries.
-- Target categories:
--   August Wilson Pittsburgh Cycle (9 plays)
--   Tennessee Williams additional works (4 plays)
--   Arthur Miller additional works (3 plays)
--   Edward Albee additional works (3 plays)
--   Eugene O'Neill (4 plays)
--   Sam Shepard (4 plays)
--   David Mamet additional works (4 plays)
--   Branden Jacobs-Jenkins (3 plays)
--   Suzan-Lori Parks additional works (3 plays)
--   Lynn Nottage additional works (2 plays)
--   Lorraine Hansberry additional works (1 play)
--   Tarell Alvin McCraney (3 plays)
--   Paula Vogel (2 plays)
--   Sarah Ruhl (4 plays)
--   Quiara Alegría Hudes (2 plays)
--   Dominique Morisseau (3 plays)
--   Young Jean Lee (3 plays)
--   Chekhov (4 plays)
--   Ibsen additional works (3 plays)
--   Brecht (4 plays)
--   Beckett (3 plays)
--   Stoppard additional works (4 plays)
--   Harold Pinter (3 plays)
--   Caryl Churchill (4 plays)
--   Sondheim musicals (8 shows)
--   Kander & Ebb (3 shows)
--   Recent Tony/Pulitzer winners (11 plays)
--   Commonly produced plays (25+ plays)

INSERT INTO plays (title, slug, playwright, year_written, awards, synopsis) VALUES

-- ============================================================
-- AUGUST WILSON PITTSBURGH CYCLE (currently missing from catalog)
-- ============================================================
('Gem of the Ocean', 'gem-of-the-ocean', 'August Wilson', 1984, '{}', 'Citizen Barlow seeks spiritual cleansing from 285-year-old Aunt Ester in 1904 Pittsburgh, the first play of Wilson''s Century Cycle chronologically.'),
('Joe Turner''s Come and Gone', 'joe-turners-come-and-gone', 'August Wilson', 1988, '{}', 'Residents of a Pittsburgh boarding house in 1911 search for identity and belonging in the years after the Great Migration.'),
('Ma Rainey''s Black Bottom', 'ma-raineys-black-bottom', 'August Wilson', 1984, ARRAY['New York Drama Critics'' Circle Award, 1985'], 'In a 1927 Chicago recording studio, blues singer Ma Rainey battles her white producers while her band simmers with tension and ambition.'),
('The Piano Lesson', 'the-piano-lesson', 'August Wilson', 1987, ARRAY['Pulitzer Prize for Drama, 1990'], 'A brother and sister in 1936 Pittsburgh fight over a family heirloom piano — sell it for farmland or preserve it as history.'),
('Two Trains Running', 'two-trains-running', 'August Wilson', 1990, '{}', 'Regulars at a Pittsburgh diner in 1969 debate how to navigate a turbulent era of civil rights and Black Power.'),
('Seven Guitars', 'seven-guitars', 'August Wilson', 1995, '{}', 'Friends of a blues guitarist gather after his funeral and piece together the story of his brief moment of success and sudden death.'),
('King Hedley II', 'king-hedley-ii', 'August Wilson', 1999, '{}', 'King Hedley II tries to rebuild his life after prison in 1980s Pittsburgh while the city around him decays.'),
('Radio Golf', 'radio-golf', 'August Wilson', 2005, '{}', 'An ambitious Black developer in 1997 Pittsburgh plans to demolish a historic home — the final play of Wilson''s Century Cycle.'),
('Jitney', 'jitney', 'August Wilson', 1982, '{}', 'Drivers at an unlicensed Pittsburgh cab station in 1977 face the threat of demolition while family secrets surface.'),

-- ============================================================
-- TENNESSEE WILLIAMS (additional works beyond existing catalog)
-- ============================================================
('Cat on a Hot Tin Roof', 'cat-on-a-hot-tin-roof', 'Tennessee Williams', 1955, ARRAY['Pulitzer Prize for Drama, 1955'], 'Brick Pollitt''s marriage to Maggie unravels as his wealthy father''s terminal cancer forces the family to reckon with lies and desire.'),
('Suddenly Last Summer', 'suddenly-last-summer', 'Tennessee Williams', 1958, '{}', 'A young woman witnesses the death of her cousin Sebastian and is threatened with a lobotomy to silence her account.'),
('The Night of the Iguana', 'the-night-of-the-iguana', 'Tennessee Williams', 1961, '{}', 'A defrocked minister running tours in Mexico finds himself among three lost souls at a ramshackle hotel.'),
('Summer and Smoke', 'summer-and-smoke', 'Tennessee Williams', 1948, '{}', 'Alma Winemiller and John Buchanan circle each other across a Mississippi town square for years, always reaching each other too late.'),

-- ============================================================
-- ARTHUR MILLER (additional works)
-- ============================================================
('All My Sons', 'all-my-sons', 'Arthur Miller', 1947, ARRAY['New York Drama Critics'' Circle Award, 1947'], 'A manufacturer who sold faulty aircraft parts during World War II faces a reckoning when his son learns the truth.'),
('The Price', 'the-price', 'Arthur Miller', 1968, '{}', 'Two brothers meet in their dead father''s apartment to sell off furniture and confront a lifetime of different choices.'),
('Incident at Vichy', 'incident-at-vichy', 'Arthur Miller', 1964, '{}', 'A group of men wait in a Vichy detention center, unsure which of them will be freed and which will be sent to the camps.'),

-- ============================================================
-- EDWARD ALBEE (additional works)
-- ============================================================
('Three Tall Women', 'three-tall-women', 'Edward Albee', 1991, ARRAY['Pulitzer Prize for Drama, 1994'], 'Three women — the same woman at different ages — confront life, compromise, and death in a two-act meditation on identity.'),
('The Zoo Story', 'the-zoo-story', 'Edward Albee', 1958, '{}', 'A lonely man accosts a stranger in Central Park, pulling him into a confrontation that ends in violence.'),
('A Delicate Balance', 'a-delicate-balance', 'Edward Albee', 1966, ARRAY['Pulitzer Prize for Drama, 1967'], 'A couple arrive unannounced at their friends'' home, fleeing an unnamed terror, testing the limits of hospitality and love.'),

-- ============================================================
-- EUGENE O'NEILL
-- ============================================================
('Long Day''s Journey into Night', 'long-days-journey-into-night', 'Eugene O''Neill', 1956, ARRAY['Pulitzer Prize for Drama, 1957'], 'The Tyrone family spends a single fog-bound day confronting addiction, regret, and the dreams they sacrificed.'),
('A Moon for the Misbegotten', 'a-moon-for-the-misbegotten', 'Eugene O''Neill', 1952, '{}', 'Josie Hogan shelters the broken Jim Tyrone in a night of tenderness and mourning on a Connecticut farm.'),
('Ah, Wilderness!', 'ah-wilderness', 'Eugene O''Neill', 1933, '{}', 'A nostalgic, comedic portrait of a Connecticut family during Fourth of July 1906, O''Neill''s only true comedy.'),
('The Hairy Ape', 'the-hairy-ape', 'Eugene O''Neill', 1922, '{}', 'Stoker Yank Smith''s sense of belonging is shattered when a wealthy passenger calls him a hairy ape.'),

-- ============================================================
-- SAM SHEPARD
-- ============================================================
('True West', 'true-west', 'Sam Shepard', 1980, '{}', 'Two brothers — one a Hollywood screenwriter, one a petty thief — swap roles and descend into chaos in their mother''s kitchen.'),
('Buried Child', 'buried-child', 'Sam Shepard', 1978, ARRAY['Pulitzer Prize for Drama, 1979'], 'A young man brings his girlfriend home to his decaying Illinois family and uncovers a buried secret in the backyard.'),
('Curse of the Starving Class', 'curse-of-the-starving-class', 'Sam Shepard', 1977, '{}', 'A dysfunctional California farming family falls apart as parents and children each scheme to escape their fate.'),
('Fool for Love', 'fool-for-love', 'Sam Shepard', 1983, '{}', 'A violent, obsessive reunion between half-siblings who share a father but not a mother, set in a Mojave Desert motel.'),

-- ============================================================
-- DAVID MAMET (additional works)
-- ============================================================
('Speed-the-Plow', 'speed-the-plow', 'David Mamet', 1988, '{}', 'Two Hollywood producers are temporarily derailed by a temp secretary who advocates for a serious literary film.'),
('Oleanna', 'oleanna', 'David Mamet', 1992, '{}', 'A college student and her professor find themselves in an escalating power struggle over a sexual harassment accusation.'),
('The Cryptogram', 'the-cryptogram', 'David Mamet', 1994, '{}', 'A boy''s insomnia on the night before a camping trip becomes the surface beneath which his family''s collapse is revealed.'),
('Sexual Perversity in Chicago', 'sexual-perversity-in-chicago', 'David Mamet', 1974, '{}', 'Two male friends and two female friends navigate dating, sex, and intimacy in 1970s Chicago with Mamet''s signature staccato dialogue.'),

-- ============================================================
-- BRANDEN JACOBS-JENKINS
-- ============================================================
('Gloria', 'gloria', 'Branden Jacobs-Jenkins', 2015, '{}', 'A slow morning at a New York magazine office is shattered by violence, and the survivors must decide what to do with the story.'),
('An Octoroon', 'an-octoroon', 'Branden Jacobs-Jenkins', 2014, '{}', 'A manic deconstruction of Dion Boucicault''s 1859 melodrama about a woman of mixed race on a Louisiana plantation.'),
('Everybody', 'everybody', 'Branden Jacobs-Jenkins', 2017, '{}', 'A contemporary adaptation of the medieval morality play Everyman, in which Death summons a random audience member.'),

-- ============================================================
-- SUZAN-LORI PARKS (additional works)
-- ============================================================
('Father Comes Home from the Wars (Parts 1, 2 & 3)', 'father-comes-home-from-the-wars', 'Suzan-Lori Parks', 2014, '{}', 'An enslaved man in Texas faces a choice: fight for the Confederacy with his master in exchange for freedom, or stay home.'),
('In the Blood', 'in-the-blood', 'Suzan-Lori Parks', 1999, '{}', 'Hester La Negrita and her five fatherless children survive on the street while each of the fathers passes through her life again.'),
('Venus', 'venus', 'Suzan-Lori Parks', 1996, '{}', 'The story of Saartjie Baartman, the South African woman exhibited as the "Venus Hottentot" in early 19th-century Europe.'),

-- ============================================================
-- LYNN NOTTAGE (additional works)
-- ============================================================
('Ruined', 'ruined', 'Lynn Nottage', 2008, ARRAY['Pulitzer Prize for Drama, 2009'], 'A bar and brothel in the Democratic Republic of Congo becomes a refuge and a front line for women caught in civil war.'),
('Intimate Apparel', 'intimate-apparel', 'Lynn Nottage', 2003, '{}', 'Esther, a Black seamstress in 1905 New York, navigates loneliness, desire, and the constraints of race and gender.'),

-- ============================================================
-- LORRAINE HANSBERRY (additional works)
-- ============================================================
('The Sign in Sidney Brustein''s Window', 'the-sign-in-sidney-brusteins-window', 'Lorraine Hansberry', 1964, '{}', 'A disillusioned Greenwich Village intellectual is pulled back into political engagement by his neighbors and his own conscience.'),

-- ============================================================
-- TARELL ALVIN MCCRANEY
-- ============================================================
('In the Red and Brown Water', 'in-the-red-and-brown-water', 'Tarell Alvin McCraney', 2009, '{}', 'Oya gives up a track scholarship to care for her mother in a Louisiana housing project, set to Yoruba mythology.'),
('The Brothers Size', 'the-brothers-size', 'Tarell Alvin McCraney', 2007, '{}', 'Two brothers and a friend navigate freedom, loyalty, and Yoruba mythology in rural Louisiana.'),

-- ============================================================
-- PAULA VOGEL
-- ============================================================
('How I Learned to Drive', 'how-i-learned-to-drive', 'Paula Vogel', 1997, ARRAY['Pulitzer Prize for Drama, 1998'], 'L''il Bit looks back at her relationship with her Uncle Peck, who taught her to drive and sexually abused her throughout her teens.'),
('Indecent', 'indecent', 'Paula Vogel', 2015, '{}', 'The true story of Sholem Asch''s 1906 Yiddish play "God of Vengeance" and the Broadway obscenity trial it triggered.'),

-- ============================================================
-- SARAH RUHL
-- ============================================================
('In the Next Room (or the Vibrator Play)', 'in-the-next-room', 'Sarah Ruhl', 2009, '{}', 'In 1880s suburban America, a doctor''s new medical device — designed to treat female hysteria — changes the lives of his wife and patients.'),
('The Clean House', 'the-clean-house', 'Sarah Ruhl', 2004, ARRAY['Susan Smith Blackburn Prize, 2004'], 'A Brazilian cleaning woman who dreams of finding the perfect joke becomes entangled in her employer''s messy love life.'),
('Eurydice', 'eurydice', 'Sarah Ruhl', 2003, '{}', 'The myth of Orpheus and Eurydice told from Eurydice''s point of view, in a dreamy underworld where memory and love compete.'),
('Passion Play', 'passion-play', 'Sarah Ruhl', 2005, '{}', 'Three Passion Plays — in Elizabethan England, Nazi Germany, and Reagan''s South Dakota — explore faith, politics, and performance.'),

-- ============================================================
-- QUIARA ALEGRÍA HUDES
-- ============================================================
('Water by the Spoonful', 'water-by-the-spoonful', 'Quiara Alegría Hudes', 2011, ARRAY['Pulitzer Prize for Drama, 2012'], 'A Philadelphia man copes with PTSD from Iraq while an online recovery chat room becomes a community of second chances.'),
('Elliot, A Soldier''s Fugue', 'elliot-a-soldiers-fugue', 'Quiara Alegría Hudes', 2006, '{}', 'Three generations of Puerto Rican marines from Philadelphia find their stories intertwined across Korea, Vietnam, and Iraq.'),

-- ============================================================
-- DOMINIQUE MORISSEAU
-- ============================================================
('Skeleton Crew', 'skeleton-crew', 'Dominique Morisseau', 2016, '{}', 'Workers at a Detroit auto stamping plant in 2008 grapple with layoffs, loyalty, and survival as the factory closes.'),
('Pipeline', 'pipeline', 'Dominique Morisseau', 2017, '{}', 'A Black public school teacher fights to keep her son out of the school-to-prison pipeline while examining her own complicity.'),
('Detroit ''67', 'detroit-67', 'Dominique Morisseau', 2012, '{}', 'A brother and sister are forced to confront their different visions for the future when they convert their Detroit basement into a speakeasy on the eve of the 1967 riots.'),

-- ============================================================
-- YOUNG JEAN LEE
-- ============================================================
('Lear', 'lear', 'Young Jean Lee', 2010, '{}', 'A deconstructed King Lear in which the play''s characters reflect on their own suffering outside the action of the play.'),
('We''re Gonna Die', 'were-gonna-die', 'Young Jean Lee', 2012, '{}', 'A performance piece about human suffering and coping, featuring original songs and direct address.'),
('Straight White Men', 'straight-white-men', 'Young Jean Lee', 2014, '{}', 'Three grown brothers visit their widowed father at Christmas and interrogate what it means to be a straight white man today.'),

-- ============================================================
-- CHEKHOV
-- ============================================================
('The Cherry Orchard', 'the-cherry-orchard', 'Anton Chekhov', 1904, '{}', 'An aristocratic Russian family loses their beloved estate to a former serf who has become a wealthy merchant.'),
('Three Sisters', 'three-sisters', 'Anton Chekhov', 1901, '{}', 'Three educated sisters in provincial Russia yearn for Moscow while their lives pass them by in longing and inaction.'),
('The Seagull', 'the-seagull', 'Anton Chekhov', 1896, '{}', 'Artists, lovers, and dreamers collide at a Russian country estate, each pursuing an ideal they cannot reach.'),
('Uncle Vanya', 'uncle-vanya', 'Anton Chekhov', 1898, '{}', 'A provincial professor''s return to his estate with his young wife ignites frustrated desires in those who have sacrificed their lives to his comfort.'),

-- ============================================================
-- IBSEN (additional works)
-- ============================================================
('Hedda Gabler', 'hedda-gabler', 'Henrik Ibsen', 1890, '{}', 'A brilliant, bored general''s daughter destroys the lives around her in a bourgeois household that cannot contain her.'),
('The Master Builder', 'the-master-builder', 'Henrik Ibsen', 1892, '{}', 'An aging architect''s ambition and guilt are stirred by a young woman from his past who challenges him to build higher.'),
('Ghosts', 'ghosts', 'Henrik Ibsen', 1881, '{}', 'Mrs. Alving''s attempt to shield her son from the sins of his father collapses when the past returns in physical form.'),

-- ============================================================
-- BRECHT
-- ============================================================
('Mother Courage and Her Children', 'mother-courage-and-her-children', 'Bertolt Brecht', 1939, '{}', 'A canteen woman follows armies across the Thirty Years'' War, profiting from conflict while losing all three of her children to it.'),
('The Good Person of Szechwan', 'the-good-person-of-szechwan', 'Bertolt Brecht', 1943, '{}', 'Three gods search for a good person and find only Shen Teh, a prostitute, who must invent a male alter-ego to survive her own goodness.'),
('Life of Galileo', 'life-of-galileo', 'Bertolt Brecht', 1943, '{}', 'Galileo Galilei''s scientific discoveries and his eventual recantation under Inquisition pressure become an epic parable about truth and power.'),
('The Caucasian Chalk Circle', 'the-caucasian-chalk-circle', 'Bertolt Brecht', 1948, '{}', 'A servant girl flees with an abandoned royal infant through a war-torn landscape, and a roguish judge must determine who the true mother is.'),

-- ============================================================
-- BECKETT
-- ============================================================
('Waiting for Godot', 'waiting-for-godot', 'Samuel Beckett', 1953, '{}', 'Two tramps wait by a tree for Godot, who never arrives, filling the void with vaudeville, argument, and endurance.'),
('Endgame', 'endgame', 'Samuel Beckett', 1957, '{}', 'In a bare room at the end of the world, a blind tyrant in a wheelchair and his servant Clov pass time in ritualistic futility.'),
('Happy Days', 'happy-days', 'Samuel Beckett', 1961, '{}', 'Winnie is buried to her waist — then her neck — in a scorching mound of earth and maintains relentless cheerfulness throughout.'),

-- ============================================================
-- STOPPARD (additional works)
-- ============================================================
('Rosencrantz and Guildenstern Are Dead', 'rosencrantz-and-guildenstern-are-dead', 'Tom Stoppard', 1967, '{}', 'Two minor characters from Hamlet find themselves swept through events they cannot understand or control, waiting for a cue that never comes.'),
('Arcadia', 'arcadia', 'Tom Stoppard', 1993, '{}', 'Two storylines — a Derbyshire estate in 1809 and the same house in the present — illuminate the second law of thermodynamics through love, mathematics, and gardening.'),
('The Real Thing', 'the-real-thing', 'Tom Stoppard', 1982, '{}', 'A playwright who writes brilliantly about love discovers he cannot control his own feelings when they become real.'),
('Travesties', 'travesties', 'Tom Stoppard', 1974, '{}', 'A minor British consular official''s faulty memory of Zurich 1917 weaves Lenin, James Joyce, and Tristan Tzara through an Importance of Being Earnest framework.'),

-- ============================================================
-- HAROLD PINTER
-- ============================================================
('Betrayal', 'betrayal', 'Harold Pinter', 1978, '{}', 'A love triangle between a publisher, his wife, and his best friend, told in reverse chronological order.'),
('The Birthday Party', 'the-birthday-party', 'Harold Pinter', 1958, '{}', 'Two mysterious men arrive at a seaside boarding house and terrorize the only resident in a menacing birthday celebration.'),
('The Homecoming', 'the-homecoming', 'Harold Pinter', 1965, '{}', 'A philosophy professor brings his American wife home to his father''s North London house for the first time, with disturbing results.'),

-- ============================================================
-- CARYL CHURCHILL
-- ============================================================
('Top Girls', 'top-girls', 'Caryl Churchill', 1982, '{}', 'Marlene celebrates her promotion with a dinner party of historical and fictional women, then returns to her family in Suffolk.'),
('Cloud Nine', 'cloud-nine', 'Caryl Churchill', 1979, '{}', 'Act One: British colonialism in Africa. Act Two: The same characters in London 1979, having aged only 25 years. A play about sexual and political liberation.'),
('Escaped Alone', 'escaped-alone', 'Caryl Churchill', 2016, '{}', 'Four old women meet in a back garden for tea while one of them periodically describes scenes of apocalyptic catastrophe.'),
('Far Away', 'far-away', 'Caryl Churchill', 2000, '{}', 'In three short scenes across decades, a world slips from the familiar into the totalitarian and then into total war.'),

-- ============================================================
-- SONDHEIM MUSICALS
-- ============================================================
('Sweeney Todd: The Demon Barber of Fleet Street', 'sweeney-todd', 'Stephen Sondheim', 1979, ARRAY['Tony Award for Best Musical, 1979'], 'A wrongly imprisoned barber returns to London seeking revenge, partnering with a pie-maker to dispose of his victims.'),
('Sunday in the Park with George', 'sunday-in-the-park-with-george', 'Stephen Sondheim', 1984, ARRAY['Pulitzer Prize for Drama, 1985'], 'Georges Seurat creates his masterwork while his lover Dot drifts away.'),
('Into the Woods', 'into-the-woods', 'Stephen Sondheim', 1987, '{}', 'Fairy-tale characters collide in a forest where wishes come true but their consequences ripple outward.'),
('Company', 'company', 'Stephen Sondheim', 1970, ARRAY['Tony Award for Best Musical, 1971'], 'Bobby, a confirmed bachelor in New York, examines his relationships with five married couples and three girlfriends.'),
('Follies', 'follies', 'Stephen Sondheim', 1971, '{}', 'Former showgirls and their husbands reunite at a crumbling theatre the night before its demolition, haunted by their younger selves.'),
('A Little Night Music', 'a-little-night-music', 'Stephen Sondheim', 1973, ARRAY['Tony Award for Best Musical, 1973'], 'Romantic misunderstandings among the aristocratic and bourgeois at a country estate in turn-of-the-century Sweden.'),
('Passion', 'passion', 'Stephen Sondheim', 1994, ARRAY['Tony Award for Best Musical, 1994'], 'A soldier''s affair with a beautiful woman is disrupted by the overwhelming love of a homely, ill woman in 19th-century Italy.'),
('Assassins', 'assassins', 'Stephen Sondheim', 1990, '{}', 'Nine people who attempted or succeeded in assassinating a US President gather in a surreal shooting gallery to share their stories.'),

-- ============================================================
-- KANDER AND EBB
-- ============================================================
('Chicago', 'chicago-musical', 'John Kander & Fred Ebb', 1975, ARRAY['Tony Award for Best Musical Revival, 1997'], 'Murderesses Roxie Hart and Velma Kelly compete for fame in 1920s Chicago''s corrupt criminal justice system.'),
('Cabaret', 'cabaret', 'John Kander & Fred Ebb', 1966, ARRAY['Tony Award for Best Musical, 1966'], 'An American writer in the Weimar Republic''s Berlin nightclub scene watches fascism rise while pursuing love and life.'),
('Kiss of the Spider Woman', 'kiss-of-the-spider-woman', 'John Kander & Fred Ebb', 1993, ARRAY['Tony Award for Best Musical, 1993'], 'Two cellmates in a Latin American prison — a window dresser and a political prisoner — escape through Hollywood fantasy.'),

-- ============================================================
-- RECENT TONY / PULITZER WINNERS NOT YET IN CATALOG
-- ============================================================
('Children of a Lesser God', 'children-of-a-lesser-god', 'Mark Medoff', 1979, ARRAY['Tony Award for Best Play, 1980'], 'A speech teacher at a school for the deaf falls in love with a former student who refuses to speak or lip-read.'),
('The Curious Incident of the Dog in the Night-Time', 'the-curious-incident', 'Simon Stephens', 2012, ARRAY['Tony Award for Best Play, 2015'], 'A 15-year-old with Asperger''s investigates the murder of his neighbor''s dog and uncovers a far more disturbing truth.'),
('The Ferryman', 'the-ferryman', 'Jez Butterworth', 2017, ARRAY['Tony Award for Best Play, 2019'], 'A farmer in 1981 Northern Ireland is visited by a detective carrying news of a body found in a bog — the body of his brother.'),
('Cost of Living', 'cost-of-living', 'Martyna Majok', 2017, ARRAY['Pulitzer Prize for Drama, 2018'], 'Two pairs of damaged people — caregiver and cared-for — find surprising intimacy while navigating the costs of need.'),
('Fairview', 'fairview', 'Jackie Sibblies Drury', 2018, ARRAY['Pulitzer Prize for Drama, 2019'], 'A Black family prepares for a grandmother''s birthday while the play''s own racial dynamics are exposed and ruptured.'),
('A Strange Loop', 'a-strange-loop', 'Michael R. Jackson', 2019, ARRAY['Pulitzer Prize for Drama, 2020', 'Tony Award for Best Musical, 2022'], 'A queer Black writer writing a musical about a queer Black writer is tormented by his "Thoughts" onstage in a meta-theatrical spiral.'),
('Lackawanna Blues', 'lackawanna-blues', 'Ruben Santiago-Hudson', 2001, '{}', 'A one-man show in which the author portrays every resident of his landlady Nanny''s boarding house in 1950s upstate New York.'),
('Topdog/Underdog', 'topdog-underdog', 'Suzan-Lori Parks', 2001, ARRAY['Pulitzer Prize for Drama, 2002'], 'Two brothers named Lincoln and Booth hustle to survive in a seedy rooming house, their rivalry echoing the nation''s original fratricide.'),
('A Strange Loop', 'a-strange-loop', 'Michael R. Jackson', 2019, ARRAY['Pulitzer Prize for Drama, 2020', 'Tony Award for Best Musical, 2022'], 'A queer Black writer writing a musical about a queer Black writer is tormented by his "Thoughts" onstage in a meta-theatrical spiral.'),

-- ============================================================
-- COMMONLY PRODUCED PLAYS NOT YET IN CATALOG
-- ============================================================
('God of Carnage', 'god-of-carnage', 'Yasmina Reza', 2006, ARRAY['Tony Award for Best Play, 2009'], 'Two couples meet to discuss a playground fight between their sons; the civilized meeting rapidly degenerates into chaos.'),
('The Children''s Hour', 'the-childrens-hour', 'Lillian Hellman', 1934, '{}', 'A troubled student''s malicious lie about two teachers at her boarding school destroys their lives and careers.'),
('Purpose', 'purpose', 'Branden Jacobs-Jenkins', 2024, '{}', 'A Black family reckons with legacy, ambition, and the meaning of success across a weekend reunion.'),
('Doubt: A Parable', 'doubt-a-parable', 'John Patrick Shanley', 2004, ARRAY['Pulitzer Prize for Drama, 2005', 'Tony Award for Best Play, 2005'], 'A Catholic school principal confronts a popular priest with a suspicion of impropriety — and no proof either way.'),
('Proof', 'proof', 'David Auburn', 2000, ARRAY['Pulitzer Prize for Drama, 2001', 'Tony Award for Best Play, 2001'], 'The daughter of a brilliant but mentally ill mathematician must prove whether a groundbreaking notebook belongs to her father or herself.'),
('''night, Mother', 'night-mother', 'Marsha Norman', 1983, ARRAY['Pulitzer Prize for Drama, 1983'], 'A daughter informs her mother she plans to kill herself that evening; the play unfolds in real time as the mother tries to stop her.'),
('The Importance of Being Earnest', 'the-importance-of-being-earnest', 'Oscar Wilde', 1895, '{}', 'Two bachelors maintain fictional alter egos to escape social obligations, creating romantic complications when both fall in love.'),
('An Inspector Calls', 'an-inspector-calls', 'J.B. Priestley', 1945, '{}', 'A mysterious police inspector reveals how each member of a prosperous family contributed to a young woman''s death.'),
('Marisol', 'marisol', 'José Rivera', 1992, '{}', 'A Puerto Rican woman''s guardian angel leaves her to fight in a cosmic war, leaving her to navigate an apocalyptic New York alone.'),
('Mud', 'mud', 'María Irene Fornés', 1983, '{}', 'Mae struggles to educate herself and escape two men who depend on her in a stark, dirt-floor room.'),
('The Colored Museum', 'the-colored-museum', 'George C. Wolfe', 1986, '{}', 'Eleven satirical exhibits skewering Black American cultural myths, stereotypes, and clichés.'),
('Middletown', 'middletown', 'Will Eno', 2010, '{}', 'Residents of a generic American town navigate daily life and approaching death in Wilder-esque episodes.'),
('The Wolves', 'the-wolves', 'Sarah DeLappe', 2016, '{}', 'A girls'' indoor soccer team warms up before games; their conversations reveal the texture of adolescence.'),
('What the Constitution Means to Me', 'what-the-constitution-means-to-me', 'Heidi Schreck', 2019, '{}', 'A woman''s teenage speeches about the Constitution frame an examination of what it has meant for women in her family.'),
('Dana H.', 'dana-h', 'Lucas Hnath', 2019, '{}', 'The playwright''s mother recounts being held captive by a violent member of a Christian motorcycle gang, told through lip-synced audio.'),
('A Christmas Carol', 'a-christmas-carol', 'Charles Dickens (adapted)', 1843, '{}', 'Miser Ebenezer Scrooge is visited by three spirits on Christmas Eve and transformed into a man of generosity.'),
('Steel Magnolias', 'steel-magnolias', 'Robert Harling', 1987, '{}', 'Six women in a Louisiana beauty salon support each other through a devastating loss.'),
('The Diary of Anne Frank', 'the-diary-of-anne-frank', 'Frances Goodrich & Albert Hackett', 1955, '{}', 'Anne Frank and her family hide from the Nazis in an Amsterdam attic for two years.'),
('Lysistrata', 'lysistrata', 'Aristophanes', 411, '{}', 'The women of Greece go on a sex strike to force their husbands to end the Peloponnesian War.'),
('Tartuffe', 'tartuffe', 'Molière', 1664, '{}', 'A pious fraud manipulates his way into a wealthy family''s home and affections.'),
('The Miser', 'the-miser', 'Molière', 1668, '{}', 'The hypocritical miser Harpagon''s obsession with money wrecks his family and loses him his lover.'),
('Miss Julie', 'miss-julie', 'August Strindberg', 1888, '{}', 'An aristocratic woman and her father''s valet engage in a seduction that destroys them both.'),
('M. Butterfly', 'm-butterfly', 'David Henry Hwang', 1988, ARRAY['Tony Award for Best Play, 1988'], 'A French diplomat falls in love with a Chinese opera singer who may be a spy — and a man.'),
('The Laramie Project', 'the-laramie-project', 'Moisés Kaufman & Members of Tectonic Theater Project', 2000, '{}', 'Interviews with residents of Laramie, Wyoming, about the 1998 murder of gay student Matthew Shepard.'),
('Rent', 'rent', 'Jonathan Larson', 1996, ARRAY['Pulitzer Prize for Drama, 1996', 'Tony Award for Best Musical, 1996'], 'A year in the lives of bohemian artists in New York''s East Village during the AIDS crisis, inspired by La Bohème.'),
('Spring Awakening', 'spring-awakening', 'Frank Wedekind (music by Duncan Sheik)', 2006, ARRAY['Tony Award for Best Musical, 2007'], 'Teenage sexuality, repression, and rebellion in 19th-century Germany with a rock score.'),
('Fun Home', 'fun-home', 'Jeanine Tesori & Lisa Kron', 2013, ARRAY['Tony Award for Best Musical, 2015'], 'Cartoonist Alison Bechdel examines her complex relationship with her closeted father through her coming-of-age and his death.'),
('Next to Normal', 'next-to-normal', 'Tom Kitt & Brian Yorkey', 2008, ARRAY['Pulitzer Prize for Drama, 2010', 'Tony Award for Best Score, 2009'], 'A suburban mother''s bipolar disorder fractures her family while her grief over a dead child goes unresolved.'),
('The Band''s Visit', 'the-bands-visit', 'David Yazbek', 2016, ARRAY['Tony Award for Best Musical, 2018'], 'An Egyptian police band accidentally stranded in a small Israeli desert town discovers unexpected connection over one night.'),
('Come From Away', 'come-from-away', 'Irene Sankoff & David Hein', 2013, ARRAY['Tony Award for Best Direction of a Musical, 2017'], '7,000 airline passengers are grounded in Gander, Newfoundland on September 11, 2001.'),
('Be More Chill', 'be-more-chill', 'Joe Iconis', 2015, '{}', 'A social outcast swallows a pill that puts a supercomputer in his brain to guide him toward popularity with disastrous results.'),
('Caroline, or Change', 'caroline-or-change', 'Tony Kushner & Jeanine Tesori', 2003, '{}', 'A Black maid in 1963 Louisiana and the young son of the Jewish family she works for share a world about to change.'),
('Falsettos', 'falsettos', 'William Finn & James Lapine', 1992, '{}', 'Marvin''s post-divorce life weaves together his ex-wife, his psychiatrist, his son, his gay lover, and eventually the AIDS crisis.'),
('Ragtime', 'ragtime', 'Stephen Flaherty & Lynn Ahrens', 1996, ARRAY['Tony Award for Best Score, 1998'], 'Three groups — a wealthy White family, Black ragtime musician Coalhouse Walker, and Eastern European immigrant Tateh — collide in early 20th-century America.')

ON CONFLICT (slug) DO NOTHING;
```

**Verification SQL:**

```sql
-- Total catalog size (must be 260+)
SELECT count(*) AS total_plays FROM public.plays;
-- Expected: >= 260

-- All new plays are curated (not AI)
SELECT count(*) AS ai_plays FROM public.plays WHERE source = 'ai';
-- Expected: 0

-- Three user-searched plays confirmed present
SELECT slug, title, playwright FROM public.plays
WHERE slug IN ('god-of-carnage', 'the-childrens-hour', 'purpose')
ORDER BY slug;
-- Expected: 3 rows

-- August Wilson full Cycle present
SELECT count(*) AS wilson_count FROM public.plays WHERE playwright = 'August Wilson';
-- Expected: >= 9

-- Idempotency check: re-run the INSERT block above
-- Expected: 0 rows inserted (all conflict on slug), 0 errors
```

---

### Node: pc-play-matcher

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: pc-source-column (source column must exist for `PlayRecord.source` queries), pc-types (interfaces must be in types.ts)
- **Inputs**:
  - `supabase/functions/_shared/scraper/types.ts` — `PlayRecord`, `AiPlayIdentification`, `PlayMatchSummary` interfaces
  - `supabase/functions/_shared/scraper/venue-name-matcher.ts` — `wordSet()` and `wordOverlap()` function pattern (lines 18–29)
  - `supabase/functions/_shared/logUsage.ts` — `logUsage()` function + `UsageEntry` interface
  - `.claude/docs/prd/play-catalog.md` §3 FR3–FR7, §6 AI prompt
- **Outputs**: `supabase/functions/_shared/scraper/play-matcher.ts` (NEW — ~250 lines)
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `deno check supabase/functions/_shared/scraper/play-matcher.ts` exits 0
  - Exact match: `normalizePlayTitle("The Children's Hour")` → `"childrens hour"`, which matches the normalized title of the seeded play
  - Exact match: `normalizePlayTitle("AUGUST: OSAGE COUNTY")` → `"august osage county"`, which matches `normalizePlayTitle("August: Osage County")`
  - Fuzzy match: `"August Osage County"` (no colon) word-overlap against `"August: Osage County"` normalized → shared = {"august", "osage", "county"}, score = 3/3 = 1.0 → match
  - Single-word bypass: event title `"Hamlet"` (single word) skips fuzzy entirely and goes to AI path
  - Devised-work bypass: AI response with `is_devised_or_original: true` leaves `play_id = null`
  - AI confidence gate: AI response with `confidence: 0.82` (below 0.85) leaves `play_id = null`
  - Non-show skip: `runPlayMatcherBatch` with an event of `event_type = 'class'` increments `events_skipped`, never queries the catalog
  - `runPlayMatcherBatch` never throws — all errors are caught and logged as warnings
  - AI usage logged to `ai_usage` table with `feature = 'play-matcher'`
- **Estimated effort**: Medium (3–4 hours)

**Full implementation — `supabase/functions/_shared/scraper/play-matcher.ts`:**

```typescript
// supabase/functions/_shared/scraper/play-matcher.ts
// Post-processing step: runs after event upserts in process-venue.ts.
// Matches theater event titles to canonical play records via:
//   1. Exact title match (after normalization)
//   2. Fuzzy word-overlap match (threshold 0.8, single-word titles bypass)
//   3. AI identification via DeepSeek V4 Flash (batch of up to 10)
// Non-show event types (class, workshop, festival, open-call) are skipped.
// All errors are caught and logged — this function NEVER throws.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { PlayRecord, AiPlayIdentification, PlayMatchSummary } from "./types.ts";
import { logUsage } from "../logUsage.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;

// ============================================================
// NORMALIZATION
// ============================================================

/**
 * Normalize a play title for comparison. Applied to BOTH the event title and
 * each catalog title before any comparison — never compare raw strings.
 *
 * Rules (in order):
 *   1. Lowercase
 *   2. Strip leading "the ", "a ", "an " (article prefix only — not mid-title)
 *   3. Remove possessive apostrophes and curly quotes (', ', `, ')
 *   4. Strip all punctuation except hyphens within words
 *   5. Collapse multiple spaces to single space
 *   6. Trim
 *
 * Examples:
 *   "The Children's Hour"    → "childrens hour"
 *   "AUGUST: OSAGE COUNTY"  → "august osage county"
 *   "August: Osage County"  → "august osage county"
 *   "Who's Afraid of Virginia Woolf?" → "whos afraid of virginia woolf"
 *   "God of Carnage"         → "god of carnage"
 *   "'night, Mother"         → "night mother"
 */
export function normalizePlayTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[''`‘’]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// WORD SET / OVERLAP (from venue-name-matcher.ts pattern)
// ============================================================

/**
 * Convert a normalized string to a Set of words, filtering out
 * single-character words (articles, prepositions) that add noise.
 * Identical to the pattern in venue-name-matcher.ts lines 18–19.
 */
function wordSet(text: string): Set<string> {
  return new Set(text.split(" ").filter((w) => w.length > 1));
}

/**
 * Word overlap score: shared words / max(a.size, b.size).
 * Returns 0 if either set is empty.
 * Identical to the pattern in venue-name-matcher.ts lines 21–28.
 */
function wordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) {
    if (b.has(w)) shared++;
  }
  return shared / Math.max(a.size, b.size);
}

// ============================================================
// CATALOG LOADING
// ============================================================

/**
 * Load all plays from the database into memory.
 * Called ONCE per runPlayMatcherBatch invocation — not once per event.
 * The catalog is ~300 rows (~50KB) — safe to hold in Edge Function memory.
 * Returns an empty array on error (caller degrades gracefully).
 */
export async function loadPlayCatalog(
  supabase: SupabaseClient,
): Promise<PlayRecord[]> {
  const { data, error } = await supabase
    .from("plays")
    .select("id, title, slug, playwright, year_written, source");

  if (error) {
    console.warn("[play-matcher] Failed to load play catalog:", error.message);
    return [];
  }

  return (data ?? []) as PlayRecord[];
}

// ============================================================
// EXACT MATCH
// ============================================================

/**
 * Attempt an exact match between the event title (normalized) and every
 * play title in the catalog (normalized). Returns the first match or null.
 *
 * "Exact" means: after normalizePlayTitle(), the two strings are identical.
 * This catches:
 *   - Same title, different case: "hamlet" → "Hamlet" ✓
 *   - Article prefix difference: "The Wolves" → "wolves" === "wolves" ✓
 *   - Apostrophe variants: "The Children's Hour" → "childrens hour" ✓
 *   - Colon stripping: "AUGUST: OSAGE COUNTY" → "august osage county" ✓
 */
export function exactMatch(
  eventTitle: string,
  catalog: PlayRecord[],
): PlayRecord | null {
  const normalized = normalizePlayTitle(eventTitle);
  for (const play of catalog) {
    if (normalizePlayTitle(play.title) === normalized) {
      return play;
    }
  }
  return null;
}

// ============================================================
// FUZZY MATCH
// ============================================================

/**
 * Attempt a fuzzy word-overlap match between the event title and every
 * play in the catalog. Returns the best match above the threshold, or null.
 *
 * SINGLE-WORD BYPASS: If the event title normalizes to a single word
 * (e.g., "Hamlet", "Topdog", "Pipeline"), skip fuzzy and return null.
 * Single-word fuzzy matches are too prone to false positives — they
 * must go through AI identification instead. (PRD FR4)
 *
 * Threshold default is 0.8 — intentionally conservative.
 * A score of 0.8 means 4 of 5 words match, or 8 of 10 words.
 * This prevents "Ham" from matching "Hamlet", "A Raisin" from matching
 * "A Raisin in the Sun", etc.
 */
export function fuzzyMatch(
  eventTitle: string,
  catalog: PlayRecord[],
  threshold = 0.8,
): { play: PlayRecord; score: number } | null {
  const normalizedEvent = normalizePlayTitle(eventTitle);
  const eventWords = wordSet(normalizedEvent);

  // Single-word bypass: go to AI, not fuzzy
  if (eventWords.size <= 1) {
    return null;
  }

  let best: { play: PlayRecord; score: number } | null = null;

  for (const play of catalog) {
    const normalizedPlay = normalizePlayTitle(play.title);
    const playWords = wordSet(normalizedPlay);
    const score = wordOverlap(eventWords, playWords);

    if (score >= threshold) {
      if (!best || score > best.score) {
        best = { play, score };
      }
    }
  }

  return best;
}

// ============================================================
// AI IDENTIFICATION PROMPT
// ============================================================

/**
 * Build the DeepSeek play identification prompt for a batch of up to 10 events.
 * The full prompt text is specified verbatim in PRD §6.
 *
 * Key rules embedded in the prompt (not to be modified without PRD update):
 *   - Skip rules: World Premiere, New Work, devised companies, improv, confidence < 0.85
 *   - Canonical title normalization: use published script title, not marketing title
 *   - Examples provided: "A Streetcar Named Desire" not "Streetcar"
 */
function buildPlayIdentificationPrompt(
  events: Array<{ index: number; title: string; description: string | null }>,
): string {
  const eventList = events
    .map(
      (e) =>
        `${e.index}. Title: "${e.title}"${
          e.description
            ? `\n   Description: "${e.description.slice(0, 200)}"`
            : ""
        }`,
    )
    .join("\n\n");

  return `You are identifying whether theater event titles represent productions of known canonical plays, or original/devised works.

For each event, determine:
1. Is this a production of a known, published play by a specific playwright?
2. Or is it an original work, devised ensemble piece, improv format, or work of unknown canonicity?

SKIP RULES — if any apply, set is_devised_or_original: true:
- Title contains "World Premiere", "New Work", "New Play"
- Event appears to be a revue, cabaret, or "An Evening of..."
- Known devised companies' signature shows (e.g., "The Infinite Wrench")
- Improv, sketch comedy, or clown formats
- Any title where you are not confident of the playwright (confidence < 0.85)

For canonical works, provide the NORMALIZED canonical title exactly as it appears in published scripts:
- "A Streetcar Named Desire" not "Streetcar"
- "August: Osage County" not "August Osage County"
- "Who's Afraid of Virginia Woolf?" with the question mark

Events:
${eventList}

Return valid JSON:
{
  "identifications": [
    {
      "index": 1,
      "is_canonical_work": true,
      "is_devised_or_original": false,
      "canonical_title": "The Children's Hour",
      "playwright": "Lillian Hellman",
      "year_written": 1934,
      "confidence": 0.95
    }
  ]
}`;
}

// ============================================================
// AI IDENTIFICATION BATCH
// ============================================================

/**
 * Send a batch of events (max 10) to DeepSeek V4 Flash for play identification.
 * Returns a Map<eventId, AiPlayIdentification>.
 *
 * API call pattern mirrors venue-name-matcher.ts exactly:
 *   - URL: https://api.deepseek.com/chat/completions
 *   - Model: deepseek-v4-flash
 *   - response_format: json_object
 *   - temperature: 0.1
 *   - max_tokens: 1024
 *   - AbortController timeout: 15 seconds
 *
 * On any error (network, timeout, parse): logs warning, returns empty Map.
 * The caller treats an empty Map result as "no matches found via AI" — safe.
 */
export async function aiIdentifyBatch(
  events: Array<{ id: string; title: string; description: string | null }>,
  catalog: PlayRecord[],
  supabase: SupabaseClient,
): Promise<Map<string, AiPlayIdentification>> {
  const results = new Map<string, AiPlayIdentification>();
  if (events.length === 0) return results;

  // Build indexed event list for the prompt
  const indexedEvents = events.map((e, i) => ({
    index: i + 1,
    title: e.title,
    description: e.description,
  }));

  const prompt = buildPlayIdentificationPrompt(indexedEvents);

  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 1024,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`DeepSeek ${response.status}: ${await response.text()}`);
      }

      const data: {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      } = await response.json();

      inputTokens = data.usage?.prompt_tokens ?? 0;
      outputTokens = data.usage?.completion_tokens ?? 0;

      const content = data.choices[0]?.message?.content;
      if (!content) throw new Error("Empty AI response");

      const parsed = JSON.parse(content);
      const identifications: Array<{
        index: number;
        is_canonical_work: boolean;
        is_devised_or_original: boolean;
        canonical_title: string | null;
        playwright: string | null;
        year_written: number | null;
        confidence: number;
      }> = parsed.identifications ?? [];

      for (const id of identifications) {
        const event = events[id.index - 1];
        if (!event) continue;
        results.set(event.id, {
          is_canonical_work: id.is_canonical_work ?? false,
          is_devised_or_original: id.is_devised_or_original ?? false,
          canonical_title: id.canonical_title ?? null,
          playwright: id.playwright ?? null,
          year_written: id.year_written ?? null,
          confidence: id.confidence ?? 0,
        });
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    console.warn("[play-matcher] AI identification failed, skipping batch:", e);
    // Return empty map — caller handles gracefully
    return results;
  }

  // Log AI usage regardless of match results
  if (inputTokens > 0) {
    try {
      await logUsage(supabase, {
        userId: null,
        model: "deepseek-v4-flash",
        provider: "deepseek",
        feature: "play-matcher",
        inputTokens,
        outputTokens,
        metadata: {
          batch_size: events.length,
          catalog_size: catalog.length,
        },
      });
    } catch (e) {
      console.warn("[play-matcher] Usage logging failed:", e);
    }
  }

  return results;
}

// ============================================================
// FIND OR CREATE PLAY
// ============================================================

/**
 * Given an AI identification, find the canonical play in the catalog
 * (using exact + fuzzy match on the AI-returned canonical_title), or
 * create a new play record with source='ai'.
 *
 * Returns the play ID if found or created, or null on failure.
 *
 * Slug generation for new AI plays: mirrors slug-generator.ts pattern.
 * Format: normalized-title lowercased, non-alphanumeric → hyphens, max 80 chars.
 * If a slug collision occurs (UNIQUE constraint), catch the error and return null.
 * The event stays unmatched — better to skip than to assign the wrong play.
 *
 * Called only when:
 *   - identification.is_canonical_work === true
 *   - identification.confidence >= 0.85
 *   - identification.canonical_title is not null
 */
async function findOrCreatePlay(
  identification: AiPlayIdentification,
  catalog: PlayRecord[],
  supabase: SupabaseClient,
  runId: string | undefined,
): Promise<{ playId: string; created: boolean } | null> {
  if (!identification.canonical_title) return null;

  // Step 1: Try exact match against catalog using AI-returned canonical title
  const exactHit = exactMatch(identification.canonical_title, catalog);
  if (exactHit) {
    return { playId: exactHit.id, created: false };
  }

  // Step 2: Try fuzzy match against catalog
  const fuzzyHit = fuzzyMatch(identification.canonical_title, catalog);
  if (fuzzyHit) {
    return { playId: fuzzyHit.play.id, created: false };
  }

  // Step 3: Not in catalog — create a new play record with source='ai'
  // Slug: lowercase title, non-alphanumeric → hyphen, max 80 chars
  const slug = identification.canonical_title
    .toLowerCase()
    .replace(/[''`‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);

  try {
    const { data, error } = await supabase
      .from("plays")
      .insert({
        title: identification.canonical_title,
        slug,
        playwright: identification.playwright ?? "Unknown",
        year_written: identification.year_written ?? null,
        awards: [],
        synopsis: null,        // AI-created plays have no synopsis — editorial enrichment needed
        source: "ai",
        scraper_run_id: runId ?? null,
      })
      .select("id")
      .single();

    if (error) {
      // Duplicate slug from concurrent run or existing play — safe to skip
      console.warn(
        `[play-matcher] Failed to create play "${identification.canonical_title}" (slug: ${slug}):`,
        error.message,
      );
      return null;
    }

    return { playId: data.id, created: true };
  } catch (e) {
    console.warn("[play-matcher] findOrCreatePlay unexpected error:", e);
    return null;
  }
}

// ============================================================
// PRIMARY ENTRY POINT
// ============================================================

/**
 * Process a batch of event IDs through the three-stage matching pipeline.
 * Called by process-venue.ts after the event upsert loop completes.
 *
 * Stage 1: Load catalog once for the entire batch.
 * Stage 2: For each event with event_type='show' and play_id IS NULL:
 *           a. Exact title match
 *           b. Fuzzy word-overlap match (single-word titles skip to AI)
 *           c. AI identification batch (up to 10 per call)
 * Stage 3: For AI-identified canonical works: find-or-create play, set play_id.
 *
 * Returns PlayMatchSummary — never throws.
 * All errors are caught and logged as warnings.
 * A partial summary (with some fields at 0) is always returned.
 *
 * @param eventIds  Array of event UUIDs to process (from the most recent upsert loop)
 * @param supabase  Service role Supabase client (same instance as the caller uses)
 * @param runId     The scraper run_id for observability + AI play attribution
 */
export async function runPlayMatcherBatch(
  eventIds: string[],
  supabase: SupabaseClient,
  runId?: string,
): Promise<PlayMatchSummary> {
  const startTime = Date.now();
  const summary: PlayMatchSummary = {
    events_processed: 0,
    exact_matches: 0,
    fuzzy_matches: 0,
    ai_matches: 0,
    plays_created: 0,
    events_skipped: 0,
    events_unmatched: 0,
    ai_input_tokens: 0,
    ai_output_tokens: 0,
    duration_ms: 0,
  };

  if (eventIds.length === 0) {
    summary.duration_ms = Date.now() - startTime;
    return summary;
  }

  try {
    // --- Stage 1: Load catalog into memory (one query for the whole batch) ---
    const catalog = await loadPlayCatalog(supabase);
    if (catalog.length === 0) {
      console.warn("[play-matcher] Catalog is empty — skipping batch");
      summary.duration_ms = Date.now() - startTime;
      return summary;
    }

    // --- Fetch events to process: only show type, only without play_id ---
    const { data: events, error: eventError } = await supabase
      .from("events")
      .select("id, title, description, event_type, play_id")
      .in("id", eventIds)
      .eq("event_type", "show")
      .is("play_id", null);

    if (eventError) {
      console.warn("[play-matcher] Failed to fetch events:", eventError.message);
      summary.duration_ms = Date.now() - startTime;
      return summary;
    }

    // Count skipped events (non-show types in the input batch)
    // We can only count these if we also fetch the skipped types
    const { count: skippedCount } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .in("id", eventIds)
      .neq("event_type", "show");
    summary.events_skipped = skippedCount ?? 0;

    const showEvents = events ?? [];
    summary.events_processed = showEvents.length;

    if (showEvents.length === 0) {
      summary.duration_ms = Date.now() - startTime;
      return summary;
    }

    // --- Stage 2: Exact + fuzzy matching (synchronous, no AI) ---
    const aiCandidates: Array<{
      id: string;
      title: string;
      description: string | null;
    }> = [];

    for (const event of showEvents) {
      // Try exact match
      const exactHit = exactMatch(event.title, catalog);
      if (exactHit) {
        await supabase
          .from("events")
          .update({ play_id: exactHit.id })
          .eq("id", event.id);
        summary.exact_matches++;
        continue;
      }

      // Try fuzzy match (single-word titles bypass to AI)
      const fuzzyHit = fuzzyMatch(event.title, catalog);
      if (fuzzyHit) {
        await supabase
          .from("events")
          .update({ play_id: fuzzyHit.play.id })
          .eq("id", event.id);
        summary.fuzzy_matches++;
        continue;
      }

      // Neither matched — queue for AI
      aiCandidates.push({
        id: event.id,
        title: event.title,
        description: event.description ?? null,
      });
    }

    // --- Stage 3: AI identification in batches of 10 ---
    const AI_BATCH_SIZE = 10;

    for (let i = 0; i < aiCandidates.length; i += AI_BATCH_SIZE) {
      const batch = aiCandidates.slice(i, i + AI_BATCH_SIZE);
      const identifications = await aiIdentifyBatch(batch, catalog, supabase);

      for (const candidate of batch) {
        const id = identifications.get(candidate.id);

        if (!id) {
          // AI returned no identification for this event (batch error or missing index)
          summary.events_unmatched++;
          continue;
        }

        // Devised/original: leave play_id null
        if (id.is_devised_or_original || !id.is_canonical_work) {
          summary.events_unmatched++;
          continue;
        }

        // Confidence gate: below 0.85 → leave play_id null
        if (id.confidence < 0.85) {
          summary.events_unmatched++;
          continue;
        }

        // Find or create the play
        const result = await findOrCreatePlay(id, catalog, supabase, runId);

        if (!result) {
          summary.events_unmatched++;
          continue;
        }

        // Set play_id on the event
        await supabase
          .from("events")
          .update({ play_id: result.playId })
          .eq("id", candidate.id);

        summary.ai_matches++;
        if (result.created) {
          summary.plays_created++;
          // Add the new play to the in-memory catalog so subsequent events
          // in this batch can match against it via exact/fuzzy
          // (only matters for batches where the same new play appears twice)
          const { data: newPlay } = await supabase
            .from("plays")
            .select("id, title, slug, playwright, year_written, source")
            .eq("id", result.playId)
            .single();
          if (newPlay) catalog.push(newPlay as PlayRecord);
        }
      }
    }

    // Count remaining unmatched (those that went through AI but got no result)
    // Already counted above via events_unmatched increments.
    // Remaining: events not processed above due to batch issues
    const totalAccounted =
      summary.exact_matches +
      summary.fuzzy_matches +
      summary.ai_matches +
      summary.events_unmatched;
    if (totalAccounted < summary.events_processed) {
      summary.events_unmatched += summary.events_processed - totalAccounted;
    }
  } catch (e) {
    console.warn("[play-matcher] runPlayMatcherBatch failed:", e);
    // Return partial summary — never throw
  }

  summary.duration_ms = Date.now() - startTime;
  return summary;
}
```

**Test cases (run manually by calling each exported function with known inputs):**

```typescript
// Test 1: normalizePlayTitle edge cases
// normalizePlayTitle("The Children's Hour") === "childrens hour"           ✓
// normalizePlayTitle("AUGUST: OSAGE COUNTY") === "august osage county"     ✓
// normalizePlayTitle("August: Osage County") === "august osage county"     ✓
// normalizePlayTitle("Who's Afraid of Virginia Woolf?") === "whos afraid of virginia woolf"  ✓
// normalizePlayTitle("God of Carnage") === "god of carnage"                ✓
// normalizePlayTitle("'night, Mother") === "night mother"                  ✓
// normalizePlayTitle("A Strange Loop") === "strange loop"                  ✓

// Test 2: exactMatch against seeded catalog
// const catalog = await loadPlayCatalog(supabase);
// exactMatch("The Children's Hour", catalog)?.slug === "the-childrens-hour"   ✓
// exactMatch("God of Carnage", catalog)?.slug === "god-of-carnage"            ✓
// exactMatch("AUGUST: OSAGE COUNTY", catalog)?.slug === "august-osage-county" ✓ (case+colon)

// Test 3: fuzzyMatch
// fuzzyMatch("August Osage County", catalog)?.play.slug === "august-osage-county"  ✓ (score=1.0)
// fuzzyMatch("Sweeney Todd", catalog) → null or match with score based on catalog state
// fuzzyMatch("Hamlet", catalog) === null (single word — bypass to AI)              ✓

// Test 4: Non-show skip
// Event with event_type='class' → events_skipped++, play_id unchanged              ✓

// Test 5: AI devised bypass
// AI returns is_devised_or_original=true for "The Infinite Wrench" → play_id=null  ✓

// Test 6: AI confidence gate
// AI returns confidence=0.82 → play_id=null                                        ✓
```

---

### Node: pc-scraper-hook

- **Type**: feature (modification to existing file)
- **Agent**: backend-architect
- **Depends on**: pc-play-matcher (play-matcher.ts must exist before process-venue.ts can import it)
- **Inputs**: `supabase/functions/_shared/scraper/process-venue.ts` (current file — read before modifying)
- **Outputs**: `supabase/functions/_shared/scraper/process-venue.ts` (modified — 3 changes: 1 import, 1 ID collection, 1 post-process call)
- **Loop pattern**: one-shot
- **Success criteria**:
  - `deno check supabase/functions/_shared/scraper/process-venue.ts` exits 0
  - `supabase functions deploy event-scraper` exits 0
  - The `row` object in the event upsert loop does NOT contain a `play_id` field (regression check — PRD FR9)
  - After a scraper run, `SELECT count(*) FROM events WHERE play_id IS NOT NULL AND event_type = 'show'` is greater than before the run
  - A scraper run completes successfully even if play-matcher throws (test by temporarily breaking DEEPSEEK_API_KEY)
- **Estimated effort**: Small (30–45 minutes)

**Three modifications to `supabase/functions/_shared/scraper/process-venue.ts`:**

**Modification 1 — Add import at top of file (after existing imports):**

```typescript
// Add after the existing import block (after `import { logUsage } from "../logUsage.ts";`):
import { runPlayMatcherBatch } from "./play-matcher.ts";
```

**Modification 2 — Collect event IDs during the upsert loop.**

The current upsert loop in `process-venue.ts` (lines ~61–90) iterates over `mergedEvents` and calls `supabase.from("events").insert(row)` or `.update(row).eq("id", existing.id)`. Modify it to track all IDs:

```typescript
// BEFORE the for loop (add this declaration):
const createdOrUpdatedIds: string[] = [];

// INSIDE the for loop, modify the insert/update branches:
// For INSERT — fetch the newly created ID:
if (existing) {
  const { error } = await supabase.from("events").update(row).eq("id", existing.id);
  if (error) throw new Error(`Update failed: ${error.message}`);
  result.events_updated++;
  createdOrUpdatedIds.push(existing.id);            // ← ADD THIS LINE
} else {
  const { data: inserted, error } = await supabase
    .from("events")
    .insert(row)
    .select("id")                                   // ← ADD .select("id")
    .single();                                      // ← ADD .single()
  if (error) throw new Error(`Insert failed: ${error.message}`);
  result.events_created++;
  if (inserted?.id) createdOrUpdatedIds.push(inserted.id);  // ← ADD THIS LINE
}
```

**Modification 3 — Call play-matcher after the upsert loop, before scrape_logs insert.**

Find the location in `process-venue.ts` where the for loop over `mergedEvents` ends and the `scrape_logs` insert begins (around line 100 in the current file). Insert the matcher call between them:

```typescript
// After the for loop over mergedEvents, before the scrape_logs insert:
// Run play matcher as non-blocking post-processing step
if (createdOrUpdatedIds.length > 0) {
  try {
    const matchSummary = await runPlayMatcherBatch(createdOrUpdatedIds, supabase, runId);
    console.log(
      `[play-matcher] ${venue.name}: ${matchSummary.exact_matches} exact, ` +
      `${matchSummary.fuzzy_matches} fuzzy, ${matchSummary.ai_matches} AI, ` +
      `${matchSummary.plays_created} new plays, ${matchSummary.events_unmatched} unmatched`
    );
  } catch (e) {
    // Matcher failure must never block scraper — log and continue
    console.warn("[play-matcher] Hook failed, continuing scraper:", e);
  }
}
```

**Important:** The `row` object that goes into the upsert must NOT include `play_id`. Verify this before deploying by grepping for `play_id` in the row construction:

```bash
grep -n "play_id" supabase/functions/_shared/scraper/process-venue.ts
# Expected: ZERO matches in the row object construction
# (Only matches should be in the new post-processing block above)
```

**Full diff view of `process-venue.ts` changes:**

```
IMPORT SECTION:
  + import { runPlayMatcherBatch } from "./play-matcher.ts";

BEFORE FOR LOOP:
  + const createdOrUpdatedIds: string[] = [];

INSIDE FOR LOOP (insert branch):
  - const { error } = await supabase.from("events").insert(row);
  - if (error) throw new Error(`Insert failed: ${error.message}`);
  - result.events_created++;
  + const { data: inserted, error } = await supabase.from("events").insert(row).select("id").single();
  + if (error) throw new Error(`Insert failed: ${error.message}`);
  + result.events_created++;
  + if (inserted?.id) createdOrUpdatedIds.push(inserted.id);

INSIDE FOR LOOP (update branch):
  (existing line):  result.events_updated++;
  + createdOrUpdatedIds.push(existing.id);

AFTER FOR LOOP, BEFORE scrape_logs INSERT:
  + if (createdOrUpdatedIds.length > 0) {
  +   try {
  +     const matchSummary = await runPlayMatcherBatch(createdOrUpdatedIds, supabase, runId);
  +     console.log(`[play-matcher] ...`);
  +   } catch (e) {
  +     console.warn("[play-matcher] Hook failed, continuing scraper:", e);
  +   }
  + }
```

**Note on `process-venue.ts` versions:** The codebase has TWO versions of this file. The legacy version lives at `supabase/functions/event-scraper/index.ts` (the original implementation). The current active version is `supabase/functions/_shared/scraper/process-venue.ts` (the v2 strategy-tree version). Apply all three modifications to the `_shared/scraper/process-venue.ts` file only. The `event-scraper/index.ts` legacy file is not used by the active scraper.

---

### Node: pc-backfill

- **Type**: feature
- **Agent**: backend-architect
- **Depends on**: pc-play-matcher (imports `runPlayMatcherBatch`), pc-seed-plays (catalog must be populated before backfill is useful — deploying before seeding wastes AI budget on empty catalog)
- **Inputs**:
  - `supabase/functions/_shared/scraper/play-matcher.ts` — `runPlayMatcherBatch`, `PlayMatchSummary`
  - `supabase/functions/event-scraper/index.ts` — `serve()` pattern, auth guard, CORS headers
  - `supabase/functions/_shared/logUsage.ts` — for reference (play-matcher handles usage logging internally)
  - `.claude/docs/prd/play-catalog.md` §5 (backfill entry point spec), §FR8
- **Outputs**: `supabase/functions/play-catalog-backfill/index.ts` (NEW)
- **Loop pattern**: plan-execute-verify
- **Success criteria**:
  - `supabase functions deploy play-catalog-backfill` exits 0
  - `curl -X POST -H "x-scraper-key: $SCRAPER_SECRET" -d '{"dry_run":true}' $FUNCTION_URL/play-catalog-backfill` returns 200 with a `PlayMatchSummary` JSON object
  - `dry_run: true` returns a valid summary with `events_processed > 0` but does NOT update any `play_id` in the database
  - `dry_run: false` (default) runs the batch and sets `play_id` on matched events
  - `batch_size` parameter controls how many events to process (default: 50, max: 200)
  - Invoking twice with `batch_size: 50` processes different events (most-recent-first ordering, already-matched events skipped)
  - Invalid auth returns 401; non-POST returns 405
- **Estimated effort**: Small (2–3 hours)

**Full implementation — `supabase/functions/play-catalog-backfill/index.ts`:**

```typescript
// supabase/functions/play-catalog-backfill/index.ts
// One-time backfill Edge Function to process all existing events where play_id IS NULL.
// Intended for manual invocation by admins; not part of the weekly scraper cron.
//
// Auth: x-scraper-key header (SCRAPER_SECRET env var) OR valid admin JWT.
//       Same dual-auth pattern as event-scraper — see event-scraper/index.ts.
//
// Request body: { batch_size?: number, dry_run?: boolean }
//   batch_size: number of events per invocation (default 50, max 200)
//   dry_run: if true, compute what would be matched but don't write play_id
//
// Returns: PlayMatchSummary as JSON
//
// Idempotency: Only processes events WHERE play_id IS NULL AND event_type = 'show'.
//   Already-matched events are never re-processed.
//   Safe to invoke multiple times — each run picks up where the last left off.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { runPlayMatcherBatch } from "../_shared/scraper/play-matcher.ts";
import type { PlayMatchSummary } from "../_shared/scraper/types.ts";

const SCRAPER_SECRET = Deno.env.get("SCRAPER_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ALLOWED_ORIGINS = [
  "http://localhost:5204",
  "https://aoa-nine.vercel.app",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-client-info, x-scraper-key",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Auth: accept SCRAPER_SECRET or valid admin JWT
  const scraperKey =
    req.headers.get("x-scraper-key") ??
    req.headers.get("Authorization")?.replace("Bearer ", "");

  let authed = scraperKey === SCRAPER_SECRET;
  if (!authed && scraperKey) {
    try {
      const { data: { user } } = await supabase.auth.getUser(scraperKey);
      if (user) authed = true;
    } catch {
      // Auth check failure is not an error — just not authed via JWT
    }
  }

  if (!authed) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Parse request body
  let batch_size = 50;
  let dry_run = false;

  try {
    const body = await req.json();
    if (typeof body.batch_size === "number") {
      batch_size = Math.min(Math.max(1, body.batch_size), 200);
    }
    if (typeof body.dry_run === "boolean") {
      dry_run = body.dry_run;
    }
  } catch {
    // Empty body or invalid JSON — use defaults
  }

  const runId = crypto.randomUUID();
  console.log(
    `[play-catalog-backfill] Starting run ${runId} — batch_size=${batch_size}, dry_run=${dry_run}`,
  );

  // Query events eligible for matching:
  //   - play_id IS NULL (not yet matched)
  //   - event_type = 'show' (only theatrical performances)
  //   - ordered by created_at DESC (process recent events first — more likely to match current catalog)
  const { data: events, error: fetchError } = await supabase
    .from("events")
    .select("id")
    .is("play_id", null)
    .eq("event_type", "show")
    .order("created_at", { ascending: false })
    .limit(batch_size);

  if (fetchError) {
    console.error("[play-catalog-backfill] Failed to fetch events:", fetchError.message);
    return new Response(
      JSON.stringify({ error: "Failed to fetch events", detail: fetchError.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const eventIds = (events ?? []).map((e: { id: string }) => e.id);

  if (eventIds.length === 0) {
    const emptySummary: PlayMatchSummary = {
      events_processed: 0,
      exact_matches: 0,
      fuzzy_matches: 0,
      ai_matches: 0,
      plays_created: 0,
      events_skipped: 0,
      events_unmatched: 0,
      ai_input_tokens: 0,
      ai_output_tokens: 0,
      duration_ms: 0,
    };
    console.log("[play-catalog-backfill] No eligible events found — all matched or no shows.");
    return new Response(JSON.stringify(emptySummary), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (dry_run) {
    // Dry run: call matcher but don't commit writes.
    // Implementation note: runPlayMatcherBatch always writes — for dry_run,
    // we wrap in a Postgres transaction that we rollback, OR we simulate
    // by running exact/fuzzy matching only (no AI, no writes).
    // Simplest safe approach: load catalog + run exact/fuzzy + estimate AI candidates.
    // Report what WOULD be matched without calling AI or writing play_id.
    const { loadPlayCatalog, exactMatch, fuzzyMatch } = await import(
      "../_shared/scraper/play-matcher.ts"
    );

    const { data: eventDetails } = await supabase
      .from("events")
      .select("id, title, description")
      .in("id", eventIds);

    const catalog = await loadPlayCatalog(supabase);
    let wouldExact = 0;
    let wouldFuzzy = 0;
    let wouldAiCandidate = 0;

    for (const event of eventDetails ?? []) {
      if (exactMatch(event.title, catalog)) {
        wouldExact++;
      } else if (fuzzyMatch(event.title, catalog)) {
        wouldFuzzy++;
      } else {
        wouldAiCandidate++;
      }
    }

    const dryRunSummary: PlayMatchSummary = {
      events_processed: eventIds.length,
      exact_matches: wouldExact,
      fuzzy_matches: wouldFuzzy,
      ai_matches: 0,        // AI not called in dry_run
      plays_created: 0,
      events_skipped: 0,
      events_unmatched: wouldAiCandidate,   // conservative: AI candidates shown as unmatched
      ai_input_tokens: 0,
      ai_output_tokens: 0,
      duration_ms: 0,
    };

    console.log(
      `[play-catalog-backfill] DRY RUN — would match: ${wouldExact} exact, ${wouldFuzzy} fuzzy, ${wouldAiCandidate} AI candidates`,
    );

    return new Response(JSON.stringify({ dry_run: true, summary: dryRunSummary }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Wet run: call the full matcher pipeline
  const summary = await runPlayMatcherBatch(eventIds, supabase, runId);

  console.log(
    `[play-catalog-backfill] Run ${runId} complete: ` +
    `${summary.exact_matches} exact, ${summary.fuzzy_matches} fuzzy, ` +
    `${summary.ai_matches} AI, ${summary.plays_created} new plays, ` +
    `${summary.events_unmatched} unmatched`,
  );

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
```

**Deployment and verification:**

```bash
# Deploy
supabase functions deploy play-catalog-backfill

# Test: dry run (should return summary without writing anything)
curl -X POST \
  -H "x-scraper-key: $SCRAPER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 10, "dry_run": true}' \
  "$SUPABASE_URL/functions/v1/play-catalog-backfill"
# Expected: 200 with { "dry_run": true, "summary": { "events_processed": N, ... } }
# Verify N > 0 if events exist with play_id IS NULL

# Test: wet run (actually sets play_id)
curl -X POST \
  -H "x-scraper-key: $SCRAPER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 50}' \
  "$SUPABASE_URL/functions/v1/play-catalog-backfill"
# Expected: 200 with PlayMatchSummary JSON

# Verify play_id was set in the database
# Run via Supabase MCP execute_sql:
# SELECT count(*) FROM events WHERE play_id IS NOT NULL AND event_type = 'show';
# Compare to count before wet run — should be higher
```

---

## Section 3: Loop Specifications

### Loop: pc-play-matcher

- **Trigger**: pc-source-column complete AND pc-types complete
- **Inner cycle**:
  1. **Discover**: Read `supabase/functions/_shared/scraper/venue-name-matcher.ts` (wordSet/wordOverlap pattern at lines 18–29), read `supabase/functions/_shared/logUsage.ts` (UsageEntry interface + logUsage signature). Read the seed migration to understand what play titles exist in the catalog for test cases.
  2. **Plan**: Design the module structure. Decide function order: `normalizePlayTitle` → `wordSet` → `wordOverlap` → `loadPlayCatalog` → `exactMatch` → `fuzzyMatch` → `buildPlayIdentificationPrompt` → `aiIdentifyBatch` → `findOrCreatePlay` → `runPlayMatcherBatch`. Each function is independently testable.
  3. **Execute**: Write `play-matcher.ts` exactly as specified in the Node: pc-play-matcher code block above. No deviations from the function signatures specified in the PRD.
  4. **Verify**: Run the test cases from the node spec. Confirm: (a) `normalizePlayTitle("The Children's Hour") === "childrens hour"` by adding a temporary log. (b) `deno check` passes clean. (c) Single-word titles bypass fuzzy. (d) The module exports all six functions listed in the PRD.
- **Evaluator**: `deno check` exits 0; all 7 normalization test cases pass; `exactMatch` finds "God of Carnage" in seeded catalog; `fuzzyMatch` returns null for "Hamlet" (single-word bypass)
- **Retry**:
  - If fuzzy produces false positives (wrong play linked): raise threshold from 0.8 to 0.85 in the function signature default. Max 1 threshold adjustment.
  - If `deno check` fails: read the error line, fix the type mismatch, re-check. Most likely issue: the `PlayRecord.source` type union doesn't match what Supabase returns (use `as PlayRecord[]` cast in `loadPlayCatalog`).
  - If AI returns malformed JSON: the `try/catch` in `aiIdentifyBatch` handles it — no code change needed.
- **Stop condition**: `deno check` exits 0; running `runPlayMatcherBatch` with 5 known event IDs produces a non-zero `exact_matches + fuzzy_matches` count from the seeded catalog; no unhandled exceptions in 3 consecutive test runs.

---

### Loop: pc-scraper-hook

- **Trigger**: pc-play-matcher complete
- **Inner cycle**:
  1. **Discover**: Read `supabase/functions/_shared/scraper/process-venue.ts` (current state). Identify the three insertion points: (a) the import block, (b) the event upsert for-loop, (c) the gap between the for-loop and the scrape_logs insert.
  2. **Plan**: Enumerate the exact line numbers of each modification. Confirm the `row` object construction does not include `play_id`. Confirm `runId` is in scope at the post-process call site.
  3. **Execute**: Apply the three modifications exactly as specified in Node: pc-scraper-hook. `deno check` after each change.
  4. **Verify**: Deploy `event-scraper`. Trigger a scraper run on one venue (via the admin UI or a direct curl to the event-scraper function). Query `SELECT count(*) FROM events WHERE play_id IS NOT NULL` before and after — it should increase.
- **Evaluator**: Scraper completes for at least one venue without error; `play_id` is set on at least one matched event; `console.log` from `[play-matcher]` appears in Edge Function logs.
- **Retry**:
  - If `deno check` fails after modification: the most likely issue is that `runPlayMatcherBatch` is not found (check import path — it's a relative import, not a URL). Correct to `"./play-matcher.ts"`.
  - If play_id is never set after a scraper run: check that the events being scraped have `event_type = 'show'` (some venues may only produce non-show events). If so, add debug logging to `runPlayMatcherBatch` to confirm catalog loaded.
  - If scraper fails because of matcher: the `try/catch` in the hook should prevent this — but if it propagates, check that the catch block is placed correctly (it must be after the for-loop body, not inside it).
- **Stop condition**: `supabase functions deploy event-scraper` exits 0; scraper run completes with matcher logs in output; at least one event gains a `play_id`.

---

### Loop: pc-backfill

- **Trigger**: pc-play-matcher complete AND pc-seed-plays complete
- **Inner cycle**:
  1. **Discover**: Check how many events exist with `play_id IS NULL AND event_type = 'show'` via Supabase MCP `execute_sql`. This is the target count. Also check the current catalog size.
  2. **Plan**: Write the backfill Edge Function exactly as specified in Node: pc-backfill. Confirm the dual-auth pattern matches `event-scraper/index.ts`. Confirm `dry_run` returns no writes.
  3. **Execute**: Write `play-catalog-backfill/index.ts`. Deploy it. Run a dry-run first.
  4. **Verify**: Dry run returns `events_processed > 0` and `exact_matches + fuzzy_matches > 0`. Wet run with `batch_size: 50` returns a valid summary. After wet run, query events table to confirm `play_id` is set.
- **Evaluator**: Dry run shows ≥ 5 exact matches (from seeded catalog + existing scrape history); wet run sets `play_id` on those events; `SELECT count(*) FROM events WHERE play_id IS NOT NULL AND event_type = 'show'` increases by at least the `exact_matches` count from the summary.
- **Retry**:
  - If dry run returns `events_processed: 0`: either the seed migration hasn't run (check `SELECT count(*) FROM plays` — should be 260+) or all events already have `play_id` set (victory condition — nothing to do). Distinguish by checking the WHERE clause manually.
  - If wet run returns `exact_matches: 0` but events exist: check that `normalizePlayTitle` is normalizing correctly. Add a debug query: `SELECT title, play_id FROM events WHERE event_type = 'show' LIMIT 10` and manually run `normalizePlayTitle` against those titles in your head.
  - If deploy fails: check the import path for `play-matcher.ts` — it's `"../_shared/scraper/play-matcher.ts"` from inside the `play-catalog-backfill/` directory.
- **Stop condition**: Dry run succeeds with `events_processed > 0`; wet run sets `play_id` on matched events; `SELECT count(*) FROM events WHERE play_id IS NULL AND event_type = 'show'` decreases with each invocation.

---

## Section 4: Shared State Schema

All state flows through the Supabase database. No in-memory state is shared between Edge Function invocations. The in-memory play catalog is loaded fresh per invocation.

| Key | Type | Set by | Consumed by | Notes |
|-----|------|--------|-------------|-------|
| `plays.source` | `text CHECK ('curated' \| 'ai')` | pc-source-column migration (default 'curated'); `findOrCreatePlay` ('ai' for AI-created) | `loadPlayCatalog` (SELECT includes source); admin queries | CHECK constraint mirrors `PlayRecord.source` union exactly |
| `plays.scraper_run_id` | `text \| null` | `findOrCreatePlay` (sets to runId parameter) | Admin observability queries | Links AI-created plays to the specific scraper run |
| `events.play_id` | `uuid FK → plays.id \| null` | `runPlayMatcherBatch` (UPDATE after match); never set by the event upsert row object | Play detail pages; Discovery search; `play_interest` demand signals | FK constraint already in place from `20260731100001_plays.sql` |
| `catalog: PlayRecord[]` | In-memory array | `loadPlayCatalog` at start of `runPlayMatcherBatch` | `exactMatch`, `fuzzyMatch`, `findOrCreatePlay` (re-checks catalog after AI creates new play) | ~300 entries post-seed (~50KB); loaded once per invocation, not per event |
| `DEEPSEEK_API_KEY` | Supabase secret | `supabase secrets set DEEPSEEK_API_KEY=...` (already set for event-scraper) | `aiIdentifyBatch` | No new secret needed — shared with all other AI calls |
| `SCRAPER_SECRET` | Supabase secret | Existing (event-scraper uses it) | `pc-backfill` auth guard | Backfill reuses the same secret — no new secret needed |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret | Existing | All Edge Functions via `createClient` | Never changes |
| `AI_BATCH_SIZE` | `const = 10` | `runPlayMatcherBatch` (hardcoded constant) | `aiIdentifyBatch` batch slicing | 10 events per AI call; increase only if prompt stays under 2048 input tokens |
| `FUZZY_THRESHOLD` | `const = 0.8` | `runPlayMatcherBatch` → `fuzzyMatch` (default parameter) | `fuzzyMatch` | Tunable in retry: raise to 0.85 if false positives observed |
| `AI_CONFIDENCE_GATE` | `const = 0.85` | `runPlayMatcherBatch` (hardcoded check) | AI identification branch | Matches PRD FR5: "confidence >= 0.85" |
| `AI_TIMEOUT_MS` | `const = 15_000` | `aiIdentifyBatch` (AbortController) | `aiIdentifyBatch` | Matches venue-name-matcher.ts pattern |
| `runId` | `string (uuid)` | `processVenue` (passed from scraper loop); `crypto.randomUUID()` in backfill | `runPlayMatcherBatch` → `findOrCreatePlay` → `plays.scraper_run_id` | For observability only; not required for matching logic |

---

## Section 5: Build Phases

Nodes within a phase can run in parallel (fan out via Claude Code subagents or parallel tasks). All nodes in a phase must pass their success criteria before advancing to the next phase. A quality gate blocks advancement.

### Phase 0: Types (root — no dependencies)

**Sequential.** pc-types has no dependencies. It is the first node because every downstream node references the three interfaces it defines.

- [ ] **pc-types** — append `PlayRecord`, `AiPlayIdentification`, `PlayMatchSummary` to `supabase/functions/_shared/scraper/types.ts`

**Quality gate before Phase 1:**
```bash
deno check supabase/functions/_shared/scraper/types.ts
# Must exit 0
grep -c "export interface PlayRecord\|export interface AiPlayIdentification\|export interface PlayMatchSummary" \
  supabase/functions/_shared/scraper/types.ts
# Must return 3
```

---

### Phase 1: Schema (sequential — depends on Phase 0)

**Sequential.** The source column must exist before the seed migration and before the matcher module, because both reference `plays.source`.

- [ ] **pc-source-column** — apply `supabase/migrations/20260815000001_plays_source_column.sql`

**Quality gate before Phase 2:**
```sql
-- Via Supabase MCP execute_sql:
SELECT column_name, column_default FROM information_schema.columns
WHERE table_name = 'plays' AND column_name = 'source';
-- Must return: column_default = 'curated'

SELECT count(*) FROM plays WHERE source IS NULL;
-- Must return: 0
```

---

### Phase 2: Seed + Matcher (parallel — both depend on Phase 1 only)

**Parallel.** pc-seed-plays and pc-play-matcher have no dependency on each other. Run them simultaneously.

**Track A — Seed:**
- [ ] **pc-seed-plays** — apply `supabase/migrations/20260815000002_seed_plays_v2.sql`

**Track B — Matcher:**
- [ ] **pc-play-matcher** — create `supabase/functions/_shared/scraper/play-matcher.ts`

**Quality gate before Phase 3:**

Track A gate:
```sql
SELECT count(*) FROM plays;
-- Must return >= 260

SELECT slug FROM plays WHERE slug IN ('god-of-carnage', 'the-childrens-hour', 'purpose');
-- Must return 3 rows
```

Track B gate:
```bash
deno check supabase/functions/_shared/scraper/play-matcher.ts
# Must exit 0

grep -c "export function\|export async function" supabase/functions/_shared/scraper/play-matcher.ts
# Must return >= 6 (all six exported functions: normalizePlayTitle, loadPlayCatalog,
#                   exactMatch, fuzzyMatch, aiIdentifyBatch, runPlayMatcherBatch)
```

---

### Phase 3: Integration (parallel — both depend on pc-play-matcher; pc-backfill also needs pc-seed-plays)

**Parallel.** pc-scraper-hook depends only on pc-play-matcher. pc-backfill depends on both pc-play-matcher and pc-seed-plays (both Track A and Track B of Phase 2 must complete).

**Track A — Scraper hook:**
- [ ] **pc-scraper-hook** — modify `supabase/functions/_shared/scraper/process-venue.ts`

**Track B — Backfill:**
- [ ] **pc-backfill** — create `supabase/functions/play-catalog-backfill/index.ts`

**Quality gate (final — feature complete):**

```bash
# Track A: scraper deploys and sets play_id on new events
supabase functions deploy event-scraper
# Trigger a scraper run, then:
# SELECT count(*) FROM events WHERE play_id IS NOT NULL AND event_type = 'show';
# Must be > 0

# Track B: backfill deploys and processes unmatched events
supabase functions deploy play-catalog-backfill
# Dry run:
curl -X POST -H "x-scraper-key: $SCRAPER_SECRET" \
  -d '{"dry_run": true, "batch_size": 10}' \
  $SUPABASE_URL/functions/v1/play-catalog-backfill
# Must return: { "dry_run": true, "summary": { "events_processed": N, ... } } where N > 0

# Acceptance criteria from PRD §10:
# AC1: SELECT count(*) FROM plays >= 260
# AC2: Original 59 plays unchanged (spot-check 5 slugs)
# AC3: source column exists with default 'curated'
# AC4: >= 70% of event_type='show' events have non-null play_id (after backfill)
# AC5: "God of Carnage", "The Children's Hour", "Purpose" findable in UI
# AC6: No class/workshop/festival/open-call events have play_id set
# AC7: Re-scraping preserves play_id
# AC8: AI-created plays have source='ai' and synopsis IS NULL
# AC9: Backfill returns valid JSON summary
# AC10: Matcher errors do not cause scraper failures
```

---

## Section 6: Execution Guide

### Running this graph with Claude Code

**Starting a node:**

1. Read the node spec completely before writing any code
2. Read all listed **Inputs** files (they contain patterns you must follow exactly)
3. Implement the code from the **Full implementation** block in the node spec
4. Run the verification commands from the node spec
5. If verification fails, follow the retry rules in the Loop Specification
6. Only mark complete when ALL success criteria pass

**Parallel execution rules:**

- Phase 2 tracks (pc-seed-plays, pc-play-matcher) can be handed to separate subagents simultaneously
- Phase 3 tracks (pc-scraper-hook, pc-backfill) can be handed to separate subagents after both Phase 2 tracks complete
- A subagent working on pc-backfill must wait for pc-seed-plays to complete (not just pc-play-matcher) — the backfill against an empty catalog wastes DeepSeek budget
- Never run Phase 2 before Phase 1's quality gate passes — the migration must be applied before the matcher can query the plays table

**What to NOT do:**

- Do not modify `executeStrategyTree` or any extraction/verification logic in the scraper
- Do not add `play_id` to the `row` object in the event upsert loop — this would overwrite manually set `play_id` on re-scrapes
- Do not put `DEEPSEEK_API_KEY` in any VITE_ env var — it is a server-side secret
- Do not call `runPlayMatcherBatch` with more than 200 event IDs in a single call — the AI batch will time out

**Rollback procedures:**

| Node | Rollback |
|------|---------|
| pc-types | Revert the append to `types.ts` (delete the 3 new interfaces). No DB change. |
| pc-source-column | `ALTER TABLE public.plays DROP COLUMN IF EXISTS source;` `ALTER TABLE public.plays DROP COLUMN IF EXISTS scraper_run_id;` `DROP INDEX IF EXISTS idx_plays_source;` |
| pc-seed-plays | `DELETE FROM plays WHERE source = 'curated' AND created_at > '2026-08-15';` (only deletes rows added by this migration — existing 59 are older) |
| pc-play-matcher | Delete `supabase/functions/_shared/scraper/play-matcher.ts`. No DB change. |
| pc-scraper-hook | Revert the 3 modifications to `process-venue.ts`. Re-deploy event-scraper. No DB change. |
| pc-backfill | Delete `supabase/functions/play-catalog-backfill/index.ts`. Undeploy if desired: `supabase functions delete play-catalog-backfill`. Setting `play_id` to null: `UPDATE events SET play_id = NULL WHERE play_id IN (SELECT id FROM plays WHERE source = 'ai');` (only nulls AI-matched events) |

**Debugging common failures:**

**`deno check` fails with "Cannot find name 'PlayRecord'"**
→ The import statement in `play-matcher.ts` uses a wrong path. The correct import is:
`import type { PlayRecord, AiPlayIdentification, PlayMatchSummary } from "./types.ts";`
Confirm `types.ts` is in the same directory as `play-matcher.ts`: both in `supabase/functions/_shared/scraper/`.

**Backfill returns `events_processed: 0` but there are unmatched events**
→ Check the WHERE clause: `play_id IS NULL AND event_type = 'show'`. Run:
`SELECT count(*) FROM events WHERE play_id IS NULL AND event_type = 'show';`
If 0 rows: all shows are already matched — this is the success state.
If > 0 rows: check that the backfill function is receiving and parsing the request body correctly (log `batch_size` and `dry_run` values on function start).

**`exactMatch` returns null for "The Children's Hour" even though it's in the catalog**
→ Verify the seed migration applied: `SELECT slug FROM plays WHERE slug = 'the-childrens-hour';`
If not found: re-apply the seed migration.
If found: add a debug log to `normalizePlayTitle` to inspect what the title normalizes to — confirm it matches the normalized catalog entry.

**play_id is set on a non-show event**
→ This is a bug. Check that the events query in `runPlayMatcherBatch` includes `.eq("event_type", "show")`. If the filter is missing, add it. Then audit and fix any incorrectly-set `play_id` values: `UPDATE events SET play_id = NULL WHERE event_type != 'show' AND play_id IS NOT NULL;`

**scraper times out or slows down noticeably after pc-scraper-hook**
→ The matcher runs after all event upserts, so it adds latency only at the end of `processVenue`. Check the matcher's `duration_ms` in console logs. If it exceeds 500ms, the AI batch may be too large. Reduce `AI_BATCH_SIZE` from 10 to 5. If still slow, check DeepSeek API latency — the 15-second timeout protects against hanging, but slow API responses add up.

---

## Appendix: File Index

All files created or modified by this feature, organized by layer.

### Database

| File | Node | Action |
|------|------|--------|
| `supabase/migrations/20260815000001_plays_source_column.sql` | pc-source-column | Create |
| `supabase/migrations/20260815000002_seed_plays_v2.sql` | pc-seed-plays | Create |

### Edge Functions — New

| File | Node | Action |
|------|------|--------|
| `supabase/functions/_shared/scraper/play-matcher.ts` | pc-play-matcher | Create |
| `supabase/functions/play-catalog-backfill/index.ts` | pc-backfill | Create |

### Edge Functions — Modified

| File | Node | Action |
|------|------|--------|
| `supabase/functions/_shared/scraper/types.ts` | pc-types | Modify (append 3 interfaces at end of file) |
| `supabase/functions/_shared/scraper/process-venue.ts` | pc-scraper-hook | Modify (3 changes: 1 import, 1 ID collection, 1 post-process call) |

### No Frontend Changes

Play detail pages (`src/pages/PlayPage.tsx` or equivalent) already query `events` by `play_id`. Once `play_id` is set by the matcher, those pages populate automatically. No frontend code changes are required.

### No New Supabase Secrets

The matcher uses `DEEPSEEK_API_KEY` (already set for the event-scraper and tic-crossref functions) and `SUPABASE_SERVICE_ROLE_KEY` (already set for all functions). The backfill uses `SCRAPER_SECRET` (already set for the event-scraper). No `supabase secrets set` commands are needed.

### Documentation

| File | Node | Action |
|------|------|--------|
| `docs/graphs/play-catalog.md` | (this design phase) | Create |
| `docs/adr/0003-play-catalog.md` | (alongside this feature) | Create |
| `.claude/docs/prd/play-catalog.md` | (already exists) | No change |
| `.claude/docs/qa/play-catalog.md` | (already exists) | No change |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-14 | Sashiko | Initial graph — 5 nodes, minimal specs (120 lines) |
| 2.0 | 2026-08-14 | Sashiko | Full rewrite — all node specs with complete implementation code, full seed migration with 200+ plays, full play-matcher.ts implementation, full backfill function, loop specs, shared state schema, execution guide |

---

[timestamp] 2026-08-14 00:00 CST
