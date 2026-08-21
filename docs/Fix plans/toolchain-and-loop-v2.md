# Graph: Toolchain Consolidation + Loop System v2

**Date:** 2026-08-21
**Version:** 1.0
**Target repo:** aoa (with one ordered side-effect in `~/Development/patterns/`)
**Doc location when landed:** `docs/graphs/toolchain-and-loop-v2.md`

This document is the executable build specification for two coupled workstreams:

1. **Toolchain consolidation** — remove or merge hooks and skills that duplicate each other or have no reader, and add the two hooks the system is missing (a blocking pre-push gate and a single status digest).
2. **Loop System v2** — upgrade the graph-engineering / loop templates so every node's evaluator is an executable command, tests are written *before* implementation as the node's evaluator, tests are frozen during implementation, and verification runs in fresh context. Add the scraper fixture corpus that makes this possible for data-shaped behavior.

**How to use this document:** Resolve the Decision Gates (Section 0) with the author first. Then read Section 5 (Build Phases), find the current phase, read the node specs for each uncompleted node, execute using the loop specs in Section 3, tick the checklist, and record deviations in Section 7. Do not skip phases; Phase 1 and its patterns-manifest sync are order-critical (see the warning in `tlv-patterns-manifest-sync`).

**Pre-conditions:** `.claude/settings.json` parses. `~/Development/patterns/ClaudeHooks/manifest.json` exists and parses. Working tree clean or author has confirmed proceeding dirty.

**Rationale record:** the analysis behind every cut and every loop change is in the ADR this graph produces (`tlv-adr`). Summary: changelog 0.20.6–0.20.8 shows three consecutive releases fixing bugs that "deploy and observe" evaluators had passed; per-turn reminder hooks have trained the agent to ignore injections; TDD-as-evaluator and fresh-context verification are the current published best practice for agentic loops; multi-agent fan-out is retained only where it pays (verification, parallel reads).

---

## Section 0: Decision Gates

Resolve these with the author BEFORE Phase 1. Record answers in Section 7 (Execution Notes). Defaults apply if the author says "use defaults."

| Gate | Question | Default | Consequence |
|------|----------|---------|-------------|
| **DG-1** | Is `/search-knowledge` actually used? (Evidence: check mtimes under the conversation-logger heap/daily dirs; ask the author.) | Not used → **cut** `conversation-logger` hook AND `/search-knowledge` skill together | If kept, both stay; neither is touched by this graph |
| **DG-2** | `/standup`: configure for AOA or remove? (It still says Project Name `My Project` and points at `docs/roadmap.md`, which does not exist.) | **Remove** from AOA, archive in patterns | If "configure": replace config block (name=AOA, roadmap=`docs/graph-engineering.md`, log dir `.claude/standups/`), and skip its removal node |
| **DG-3** | Zephyr-first: keep mandatory for every message, or make conditional (mandatory for multi-file features / planning / schema; direct execution for single-file edits, questions, ops commands)? | **Author's call — no default.** This is a policy change, not a cleanup | If "conditional": node `tlv-zephyr-policy` activates. If "keep mandatory": that node is skipped and only the orchestrator-init *duplicate* is removed |
| **DG-4** | `completion-notification` vs `ghostty-done` | Executor resolves without the author: read both scripts; if they notify through the same channel, keep `ghostty-done` (consistency with the ghostty family) and remove the other; if different channels (e.g., OS notification vs terminal title), keep both | — |

---

## Section 1: Task Graph Topology

### Nodes

tlv-hook-audit, tlv-hook-removals, tlv-patterns-manifest-sync,
tlv-pre-push-gate, tlv-status-digest, tlv-hook-selftest, tlv-settings-rewire,
tlv-skill-merges, tlv-skill-removals, tlv-claude-md-update, tlv-security-review-wiring, tlv-zephyr-policy?,
tlv-loop-template-v2, tlv-testing-rule, tlv-cap-graph-check,
tlv-scraper-fixtures, tlv-gate-deno,
tlv-adr, tlv-runbook, tlv-promote

### Edges (arrows = "must complete before")

```
DG-1..DG-4 (decisions)
   → tlv-hook-audit
        → tlv-hook-removals → tlv-patterns-manifest-sync   [SAME SESSION — see warning]
        → tlv-pre-push-gate ─┐
        → tlv-status-digest ─┤→ tlv-hook-selftest → tlv-settings-rewire
   → tlv-skill-merges → tlv-skill-removals → tlv-claude-md-update
   → tlv-loop-template-v2 → tlv-testing-rule
                          → tlv-security-review-wiring
   → tlv-cap-graph-check (independent; before tlv-scraper-fixtures lands via /cap)
   → tlv-scraper-fixtures → tlv-gate-deno (needs tlv-pre-push-gate)
   → tlv-adr, tlv-runbook (after Phases 1–5)
   → tlv-promote (after ≥1 week local soak of the new hooks)
   → tlv-zephyr-policy? (only if DG-3 = conditional; independent)
```

---

## Section 2: Node Specifications

### Phase 1 — Hook Removals

#### Node: tlv-hook-audit
- **Type**: discovery
- **Agent**: devops-engineer
- **Depends on**: Decision Gates resolved
- **Inputs**: `.claude/settings.json`, every file in `.claude/hooks/`, `~/Development/patterns/ClaudeHooks/manifest.json`
- **Outputs**: A removal-manifest table appended to Section 7 of this doc: one row per hook — name, registered lifecycle events, verdict (keep / remove / relocate / merge-into-digest), present-in-patterns-manifest (yes/no)
- **Loop pattern**: one-shot
- **Success criteria**: Table row count equals `ls .claude/hooks/*.sh | wc -l`; every row has a verdict; every REMOVE row records patterns-manifest presence
- **Estimated effort**: Small
- **Pattern(s)**: —

#### Node: tlv-hook-removals
- **Type**: infra
- **Agent**: devops-engineer
- **Depends on**: tlv-hook-audit
- **Inputs**: Removal manifest. Fixed removal set: `orchestrator-init.sh` (duplicate of zephyr-init + CLAUDE.md mandate), `stuck-detector.sh` (superseded by on-demand `/escalate`), `task-summary-reminder.sh`, `test-review-reminder.sh` (unconditional nags), `context-stamp.sh` (CLAUDE.md timestamp rule is the single mechanism), `session-journal.sh` from ALL FIVE lifecycle events (lighthouse already streams every event), `test-runner.sh` from Stop (logic relocates into `tlv-pre-push-gate`). Conditional per gates: `conversation-logger.sh` (DG-1), loser of DG-4.
- **Outputs**: Hook files deleted; every corresponding entry deregistered from `.claude/settings.json`; `.claude/journals/` and `.claude/queries/` added to `.gitignore` (existing files left in place — never destroy history silently)
- **Loop pattern**: plan-execute-verify
- **Success criteria** (all executable):
  - For each removed name N: `test ! -f .claude/hooks/N.sh` AND `grep -c "hooks/N.sh" .claude/settings.json` returns 0
  - `python3 -m json.tool .claude/settings.json > /dev/null` exits 0
  - `docs-review-reminder.sh` and `cost-tracker.sh` and `context-window.sh` still present (they are removed later by `tlv-status-digest`, not here)
- **Estimated effort**: Small
- **Pattern(s)**: —

#### Node: tlv-patterns-manifest-sync
- **Type**: infra (external to repo)
- **Agent**: devops-engineer
- **Depends on**: tlv-hook-removals — **MUST land in the same working session**
- **Inputs**: `~/Development/patterns/ClaudeHooks/manifest.json`, removal manifest
- **Outputs**: Every removed hook deleted from the manifest's HOOKS array; its pattern directory moved to `~/Development/patterns/ClaudeHooks/_retired/<name>/` (moved, not deleted)
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Manifest parses (`node -e "JSON.parse(...)"` exits 0) and contains none of the removed names; then run `bash .claude/hooks/sota-sync.sh` once and assert `ls .claude/hooks/` still lacks every removed hook (resurrection test)
- **Estimated effort**: Small
- **Pattern(s)**: claudehooks/

> **WARNING — resurrection hazard:** `sota-sync.sh` auto-reinstalls any manifest hook missing locally at every SessionStart. Deleting hooks locally without removing them from the patterns manifest means they all come back next session. Phase 1 is not complete until the resurrection test passes. The same applies in reverse for sibling projects: retired patterns stop being pushed, but already-installed copies in siblings are left alone (sota-sync never deletes) — clean those up via `/promote-hook`'s report or manually, out of scope here.

### Phase 2 — New Hooks

#### Node: tlv-pre-push-gate
- **Type**: infra
- **Agent**: devops-engineer
- **Depends on**: tlv-hook-removals
- **Inputs**: `.claude/hooks/git-push-confirm.sh` (for PreToolUse JSON parsing pattern), `test-runner.sh` (pre-removal copy, for test-command detection logic), `package.json`, `tsconfig.json`
- **Outputs**: `.claude/hooks/pre-push-gate.sh` — PreToolUse/Bash hook. Behavior:
  1. Parse hook JSON; if the Bash command does not contain `git push`, emit `{"decision":"allow"}` and exit.
  2. If env `SKIP_GATE=1`: append a line to `.claude/gate-skips.log` (timestamp + cwd), emit a loud systemMessage warning, allow.
  3. Otherwise run, in order, **only the checks whose config exists** (graceful degradation — this hook will be promoted to sibling projects): `npx tsc --noEmit` (if tsconfig.json), `npx vitest run` (if vitest in devDependencies AND at least one `*.test.ts` under src/), `deno test <fixture paths>` (added by tlv-gate-deno).
  4. Any failure → `{"decision":"block","reason":"<tail of failing output>"}`. All pass → allow.
- Registered in settings.json PreToolUse/Bash group **before** `git-push-confirm.sh` (red blocks before the human is asked).
- **Loop pattern**: plan-execute-verify
- **Success criteria** (all executable):
  - `shellcheck .claude/hooks/pre-push-gate.sh` exits 0 (or `bash -n` if shellcheck unavailable)
  - Simulated-event test A: create a temp failing test file, pipe `{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"git push"}}` into the hook, assert stdout JSON has `"decision":"block"`; delete temp test
  - Simulated-event test B: with a clean tree, same pipe asserts `"decision":"allow"`
  - Simulated-event test C: command `ls -la` piped in → allow, and no test run occurred (runtime < 2s)
- **Estimated effort**: Medium
- **Pattern(s)**: claudehooks/ (promote candidate)

#### Node: tlv-status-digest
- **Type**: infra
- **Agent**: devops-engineer
- **Depends on**: tlv-hook-removals
- **Inputs**: `context-window.sh`, `cost-tracker.sh`, `docs-review-reminder.sh` (source logic for all three)
- **Outputs**: `.claude/hooks/status-digest.sh` — single Stop hook emitting ONE systemMessage line, ≤ 160 chars: `[ctx 🟢 41% | $0.83 | docs?]` where the `docs?` flag appears only when source files changed since last flag (reuse docs-review-reminder's marker-file logic). Then delete `context-window.sh`, `cost-tracker.sh`, `docs-review-reminder.sh` and deregister all three; register the digest.
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Pipe a sample Stop event with a synthetic transcript containing one usage block → stdout is valid JSON, `continue:true`, systemMessage is exactly one line and ≤ 160 chars; the three source hooks absent from disk and settings.json
- **Estimated effort**: Small
- **Pattern(s)**: claudehooks/ (promote candidate)

#### Node: tlv-hook-selftest
- **Type**: infra
- **Agent**: devops-engineer
- **Depends on**: tlv-pre-push-gate, tlv-status-digest
- **Inputs**: All surviving hooks; canonical event JSON samples for each lifecycle (SessionStart, PreToolUse, PostToolUse, Notification, Stop)
- **Outputs**: `~/Development/patterns/ClaudeHooks/selftest.sh` — for every `hook.sh` in patterns AND every `.claude/hooks/*.sh` locally: `bash -n`, then pipe the matching lifecycle sample and assert stdout parses as JSON. This is the tool that keeps a bad hook edit from wedging 24 projects.
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `bash selftest.sh` exits 0 against the current post-consolidation hook set; deliberately corrupting one hook's output makes it exit non-zero
- **Estimated effort**: Small
- **Pattern(s)**: claudehooks/ (promote candidate; also the proposed fix for the "no tooling for the tooling" gap)

#### Node: tlv-settings-rewire
- **Type**: config
- **Agent**: devops-engineer
- **Depends on**: tlv-hook-removals, tlv-pre-push-gate, tlv-status-digest
- **Inputs**: Target end-state below
- **Outputs**: `.claude/settings.json` matching exactly:
  - **SessionStart**: ghostty-title, sota-sync, journal-check, zephyr-init, lighthouse
  - **PreToolUse [Bash]**: pre-push-gate, git-push-confirm
  - **PreToolUse [no matcher]**: ghostty-working, lighthouse
  - **Stop**: status-digest, test-runner→(removed), completion-notification-or-ghostty-done (per DG-4), promote-hook-detector, ripple-capture, lighthouse, conversation-logger (per DG-1)
  - **PostToolUse**: lighthouse
  - **Notification**: (empty or removed)
- **Loop pattern**: one-shot
- **Success criteria**: `python3 -m json.tool` exits 0; the set of registered commands equals the target list exactly (script the comparison); Stop-event systemMessage-emitting hooks number ≤ 3
- **Estimated effort**: Trivial
- **Pattern(s)**: —

### Phase 3 — Skills Consolidation

#### Node: tlv-skill-merges
- **Type**: infra
- **Agent**: technical-writer
- **Depends on**: Decision Gates
- **Inputs**: `.claude/skills/{retro,observe,evolution,implementation,new-feature}/skill.md`, `.claude/agents/divisions.json`
- **Outputs**:
  1. `/evolution` gains two phases: "Retro" (operational Wrong/Right/Why capture, feeding `.claude/runbooks/`) and "Observe" (diagnostic pass) — content lifted from the two source skills, deduplicated, then `retro/` and `observe/` directories deleted.
  2. `/evolution`'s Agent Roster table regenerated from `divisions.json` (fixes the stale 6-generic-agents table; journals exist for agents the table doesn't list).
  3. `/new-feature` gains an "Execute" phase absorbing `/implementation`; `implementation/` deleted.
  4. All "Relationship to Other Skills" tables across surviving skills updated (no references to deleted skills).
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `test ! -d` for the three deleted dirs; `grep -rln "\/retro\|\/observe\b\|\/implementation" .claude/skills/ CLAUDE.md .claude/rules/` returns empty (agent journals exempt — they are history); evolution roster row count equals agent count in divisions.json
- **Estimated effort**: Medium
- **Pattern(s)**: claudeskills/

#### Node: tlv-skill-removals
- **Type**: infra
- **Agent**: technical-writer
- **Depends on**: tlv-skill-merges
- **Inputs**: DG-1, DG-2 answers
- **Outputs**: `/install-hooks` deleted (sota-sync superseded it). `/clio`, `/teach-codebase`, and (per DG-2) `/standup` moved to `~/Development/patterns/claudeskills/_archive/` then removed locally. (Per DG-1) `/search-knowledge` removed alongside conversation-logger, or both kept. Check `~/Development/patterns/claudeskills/install.sh` for any auto-install list and retire entries there too (same resurrection logic as hooks, if any exists).
- **Loop pattern**: plan-execute-verify
- **Success criteria**: Removed dirs absent locally, present in `_archive/`; a fresh run of the claudeskills installer (if it has an auto mode) does not restore them
- **Estimated effort**: Small
- **Pattern(s)**: claudeskills/

#### Node: tlv-claude-md-update
- **Type**: docs
- **Agent**: technical-writer
- **Depends on**: tlv-skill-removals, tlv-settings-rewire
- **Inputs**: Final skill dirs, final settings.json
- **Outputs**: CLAUDE.md — Available Skills table matches surviving skills exactly; a short "Hooks" note documenting pre-push-gate (and SKIP_GATE=1 escape + its log), status-digest, and the resurrection rule ("hook removals require a patterns-manifest edit"); orchestration section untouched unless DG-3 = conditional
- **Loop pattern**: one-shot
- **Success criteria**: Skills-table row count equals `ls -d .claude/skills/*/ | wc -l`; every table entry has a matching directory and vice versa
- **Estimated effort**: Trivial
- **Pattern(s)**: —

#### Node: tlv-security-review-wiring
- **Type**: docs
- **Agent**: security-engineer
- **Depends on**: tlv-loop-template-v2
- **Inputs**: `/security-review` skill, updated templates
- **Outputs**: One rule added to the node-spec template (in all three template homes — see tlv-loop-template-v2): "Nodes whose Outputs touch auth, RLS policies, or Edge Function input handling MUST include a `/security-review` step in their loop's Verify stage." The skill goes from dormant to triggered.
- **Loop pattern**: one-shot
- **Success criteria**: `grep -l "security-review" ` on all three template files returns all three
- **Estimated effort**: Trivial
- **Pattern(s)**: —

#### Node: tlv-zephyr-policy  *(OPTIONAL — only if DG-3 = conditional)*
- **Type**: docs
- **Agent**: Zephyr (he should rewrite his own mandate)
- **Depends on**: DG-3 = conditional
- **Inputs**: CLAUDE.md orchestration section, `.claude/hooks/zephyr-init.sh`
- **Outputs**: Both updated to the conditional rule: Zephyr-first mandatory for multi-file features, planning, anything touching schema/auth/RLS; direct execution permitted for single-file edits, factual questions, and ops commands. Wording consistent between the two (they currently drift even on the agent's name).
- **Loop pattern**: one-shot
- **Success criteria**: `diff <(extracted rule from CLAUDE.md) <(extracted rule from zephyr-init.sh)` — semantically identical; author signs off on wording
- **Estimated effort**: Small
- **Pattern(s)**: —

### Phase 4 — Loop System v2

#### Node: tlv-loop-template-v2
- **Type**: infra
- **Agent**: Sashiko (code-architect)
- **Depends on**: Decision Gates
- **Inputs**: The three template homes: `.claude/skills/new-app/skill.md` §5, `.claude/skills/new-design/skill.md`, `.claude/skills/iterate/skill.md` (wherever each defines node/loop formats)
- **Outputs**: All three updated with Loop System v2:

  **Node spec template gains one required field:**
  ```
  - **Evaluator command**: <a command with a pass/fail exit code, or a test file path>
  ```

  **Evaluator rules (add verbatim to each template):**
  1. The evaluator MUST be executable — a command whose exit code decides pass/fail, or a test file the runner executes. "Deploy and observe," "check in browser," and "user confirms on iPhone" are NOT evaluators.
  2. Human/production observation may appear only as a **final smoke step** listed AFTER the executable evaluator has passed — it confirms, it never decides.
  3. If the behavior cannot be expressed as a command (data-shaped behavior like scraper extraction), the node MUST create or extend a fixture (input file + expected output file) and the evaluator is the fixture test. "Too hard to test" resolves to "write the fixture," never to "observe in prod."

  **Loop inner cycle becomes five steps:**
  ```
  1. Discover  — read inputs, existing code, PRD sections
  2. Plan      — design the change
  3. Test      — translate this node's success criteria into FAILING tests
                 (via /create-tests conventions). Run them; confirm red.
                 COMMIT the failing tests before any implementation.
  4. Execute   — implement. Test files are FROZEN: the implementation MUST NOT
                 modify any test committed in step 3. If a test turns out to be
                 wrong, STOP, surface it to the author, amend only with sign-off.
  5. Verify    — run the Evaluator command. On green, run the fresh-context
                 verification (below). Append an attempts record (below).
  ```

  **Fresh-context verification (add to loop template):** At node close, spawn ONE subagent (`Argus`/code-reviewer) whose prompt contains ONLY: the node spec, the diff (`git diff` of the node's files), and the Evaluator command — no implementation conversation. The subagent runs the evaluator itself and reads the diff cold. A node is complete only when this verifier reports pass. (The implementer's own context is biased toward the code it just wrote; this is the one place multi-agent fan-out demonstrably pays.)

  **Attempts record (replaces the currently-unimplemented `attempts.jsonl` convention):** every Verify cycle appends one line to `docs/graphs/attempts.jsonl`:
  `{"ts":"<ISO-8601>","graph":"<doc>","node":"<name>","cycle":<n>,"gate":"<test|typecheck|fixture|fresh-verify>","result":"pass|fail","note":"<≤120 chars>"}`
  Retry budgets ("max 2 cycles") are enforced by counting this file, not by memory. The file is tracked in git and travels in the same commit as the node's source changes.
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `grep -l "Evaluator command" <3 files>` returns all three; `grep -c "FROZEN" <3 files>` ≥ 1 each; the phrase "deploy and observe" appears in none of the three as an allowed evaluator (only inside the smoke-step rule); attempts.jsonl schema present in all three
- **Estimated effort**: Medium
- **Pattern(s)**: claudeskills/ (promote candidate — sibling projects share these templates)

#### Node: tlv-testing-rule
- **Type**: infra
- **Agent**: test-engineer
- **Depends on**: tlv-loop-template-v2
- **Inputs**: Loop System v2 text above; `.claude/rules/` (blueprint auto-loads this directory every session)
- **Outputs**: `.claude/rules/testing.md` — the four load-bearing rules, stated once, auto-loaded always:
  1. In graph loops, tests are written before implementation and committed failing.
  2. Test files are frozen during implementation; changing a test to reach green requires stopping and getting author sign-off.
  3. Data-shaped behavior gets fixtures; the fixture test is the evaluator.
  4. Node completion requires a fresh-context verifier pass, not the implementer's own claim.
- **Loop pattern**: one-shot
- **Success criteria**: File exists; ≤ 40 lines (rules files must stay small enough to always load); referenced from CLAUDE.md's rules note
- **Estimated effort**: Trivial
- **Pattern(s)**: blueprint/ (promote candidate)

#### Node: tlv-cap-graph-check
- **Type**: infra
- **Agent**: git-manager
- **Depends on**: Decision Gates (independent of other phases; land BEFORE tlv-scraper-fixtures so the versioning amendment exists when fixtures commit)
- **Inputs**: `.claude/skills/cap/skill.md`, `.claude/rules/versioning.md`, File Index tables in `docs/graphs/*.md`
- **Outputs**:
  1. **`/cap` Phase 1.6 — GRAPH CHECK:** after the version check, map changed files to graph nodes via the File Index tables of every doc in `docs/graphs/`. For each hit: prompt the author to tick the node's Build Phase checkbox (mark complete) or, if the work happened outside any graph, append one line to that graph's Deviations section. This kills spec↔code drift the same way Phase 1.5 killed forgotten version bumps.
  2. **Versioning amendment:** `versioning.md` and `/cap`'s `CODE_CHANGED` grep both updated to exclude `*.test.ts`, `*.test.tsx`, and `__fixtures__/` paths from the bump requirement (tests and fixtures are not user-facing capability). One sentence added to versioning.md stating this explicitly.
  3. `/cap` grouping note: `attempts.jsonl` travels with its node's source commit, never as a standalone docs commit.
- **Loop pattern**: plan-execute-verify
- **Success criteria**: `grep -q "Phase 1.6" .claude/skills/cap/skill.md`; `grep -q "__fixtures__" .claude/rules/versioning.md`; dry-run description: a simulated change to a file listed in `docs/graphs/scraper-v3.md`'s File Index produces a Phase 1.6 prompt in the skill's written flow
- **Estimated effort**: Small
- **Pattern(s)**: claudeskills/

### Phase 5 — Fixture Corpus

#### Node: tlv-scraper-fixtures
- **Type**: feature (test infrastructure)
- **Agent**: test-engineer + Frontinus (backend-architect)
- **Depends on**: tlv-cap-graph-check (versioning amendment), tlv-loop-template-v2
- **Inputs**: `supabase/functions/_shared/scraper/` modules; live HTML from four venues chosen to span the failure history: Acting Studio Chicago (class-native, the v4 proving ground), one theater with schema.org ld+json markup, one theater without structured data, one venue exhibiting the nav-menu-bleed case fixed in 0.21.0
- **Outputs**:
  - `supabase/functions/_shared/scraper/__fixtures__/<venue-slug>/page.html` (saved real HTML, boilerplate intact — the fixture must contain the traps)
  - `supabase/functions/_shared/scraper/__fixtures__/<venue-slug>/expected.json` (the extraction result a correct scraper produces: titles, dates, event_type/class fields; volatile fields like descriptions matched leniently)
  - `supabase/functions/_shared/scraper/fixtures.test.ts` — Deno test: for each fixture dir, run the extraction pipeline (classifier → boilerplate strip → extract) against `page.html`, deep-compare required fields against `expected.json` with a tolerant matcher (exact on titles/dates/types; substring/optional on prose fields)
- **Loop pattern**: plan-execute-verify — and this node EATS ITS OWN DOGFOOD: write `expected.json` first (that IS the failing test), confirm `deno test` is red against a deliberately empty expectation, then wire the pipeline call until green
- **Success criteria**: `deno test supabase/functions/_shared/scraper/fixtures.test.ts` exits 0; corrupting one `expected.json` title makes it exit non-zero; total fixture payload < 2 MB (trim scripts/images from saved HTML if needed — keep DOM structure and nav)
- **Estimated effort**: Large
- **Pattern(s)**: — (new; the scraper's test-first equivalent — extraction correctness is data-shaped, so the fixture corpus is how Loop v2's Rule 3 applies here)

#### Node: tlv-gate-deno
- **Type**: config
- **Agent**: devops-engineer
- **Depends on**: tlv-pre-push-gate, tlv-scraper-fixtures
- **Inputs**: Both outputs above
- **Outputs**: `pre-push-gate.sh` extended: if `deno` is on PATH and any `supabase/functions/**/*.test.ts` exists, run `deno test` on those paths as a gate check (graceful skip when deno absent — the promoted hook must not break siblings)
- **Loop pattern**: one-shot
- **Success criteria**: Simulated-event test: with one fixture expectation corrupted, a piped `git push` event returns `"decision":"block"`; restored, it allows
- **Estimated effort**: Trivial
- **Pattern(s)**: claudehooks/

### Phase 6 — Documentation + Promotion

#### Node: tlv-adr
- **Type**: docs
- **Agent**: Sashiko (code-architect)
- **Depends on**: Phases 1–5 complete
- **Inputs**: This graph; changelog 0.20.6–0.21.0; `.claude/agents/git-manager/journal.md` and `devops-engineer/journal.md` entries
- **Outputs**: `docs/adr/000N-executable-evaluators-and-test-first-loops.md` (N = next sequence number). Sections per house format:
  - **Context**: loops with observation evaluators shipped three consecutive firefighting releases (0.20.6–0.20.8: geocode stacking, chain fork, cooldown trap); verification ran in the implementer's context; retry budgets had no ledger; per-turn reminder hooks produced alarm fatigue.
  - **Decision**: evaluators must be executable commands; tests are written first, committed failing, and frozen during implementation; node completion requires a fresh-context verifier; a blocking pre-push gate is the floor under every loop; data-shaped behavior is evaluated by fixtures.
  - **Alternatives Considered**: status quo (deploy-and-observe) — rejected, see Context; full CI-first (GitHub Actions before local gates) — deferred, local gate is cheaper and CI can mirror it later; browser-bot QA squads (the glyffiti pattern) for scraper verification — deferred, fixtures are cheaper and deterministic; keeping all reminder hooks — rejected, injections that fire unconditionally are ignored unconditionally.
  - **Consequences**: pushes get slower by one typecheck+test run (deliberate); tests/fixtures excluded from version bumps; sibling projects inherit the gate via promotion and must tolerate graceful degradation; the agent loses the ability to silently "fix" a red suite by editing tests.
- **Loop pattern**: one-shot
- **Success criteria**: File exists at next ADR number; contains all four house-format sections; `docs-check`'s ADR checklist item satisfiable
- **Estimated effort**: Small
- **Pattern(s)**: —

#### Node: tlv-runbook
- **Type**: docs
- **Agent**: technical-writer
- **Depends on**: tlv-adr
- **Inputs**: ADR; this graph
- **Outputs**: `.claude/runbooks/loop-engineering.md` — three Wrong/Right/Why entries:
  1. **Wrong**: evaluator = "deploy and test against <venue>". **Right**: evaluator = command or fixture test; deploy is a post-pass smoke step. **Why**: 0.20.6–0.20.8 were three releases of bugs those evaluators passed; the chain-fork bug (timeout-retry spawning parallel invocations) is invisible to observation and trivial for a fake-timer test.
  2. **Wrong**: the implementing context verifies its own node. **Right**: fresh-context subagent runs the evaluator against the cold diff. **Why**: the author-context reads its own changes as correct; a clean context catches missing conditions.
  3. **Wrong**: agent edits a test to reach green. **Right**: tests committed failing before implementation, frozen during it; changing one requires author sign-off. **Why**: the diff of committed tests is the tamper-evidence; without it, green proves nothing.
- **Loop pattern**: one-shot
- **Success criteria**: File exists; three entries, each with all three fields
- **Estimated effort**: Trivial
- **Pattern(s)**: —

#### Node: tlv-promote
- **Type**: infra
- **Agent**: (main context)
- **Depends on**: ≥ 1 week of local soak on pre-push-gate + status-digest with zero false blocks (check `.claude/gate-skips.log` and author experience)
- **Inputs**: `/promote-hook` skill
- **Outputs**: `pre-push-gate`, `status-digest`, `selftest` promoted to `~/Development/patterns/ClaudeHooks/` + installed across `~/Development/*/`; `testing.md` rule and Loop v2 templates promoted via claudeskills/blueprint patterns; one ripple-ledger entry (`tags: ["testing","dx","deployment"]`) so siblings surface it
- **Loop pattern**: one-shot
- **Success criteria**: `/promote-hook` report shows install counts; ripple ledger contains the entry
- **Estimated effort**: Small
- **Pattern(s)**: claudehooks/, claudeskills/, blueprint/

---

## Section 3: Loop Specifications

Nodes marked one-shot follow: execute → run success criteria → fix → re-run (max 2 cycles). The plan-execute-verify nodes:

### Loop: tlv-hook-removals / tlv-patterns-manifest-sync (run as one session)
- **Trigger**: Decision Gates recorded in Section 7
- **Inner cycle**: Plan (removal manifest → exact file+settings edits) → Execute → Verify (per-name grep/test assertions, settings parse, then sota-sync resurrection test)
- **Evaluator command**: the assertion script from the two nodes' success criteria, run as one bash block
- **Retry**: a resurrected hook means a missed manifest entry — fix manifest, re-run (max 2)
- **Stop condition**: resurrection test passes

### Loop: tlv-pre-push-gate
- **Trigger**: tlv-hook-removals complete
- **Inner cycle**: Plan (read git-push-confirm's JSON parsing; enumerate degradation branches) → Test (write the three simulated-event assertions as a script FIRST — they are this node's failing tests) → Execute (write the hook) → Verify (assertions + shellcheck)
- **Evaluator command**: the simulated-event assertion script (tests A, B, C)
- **Retry**: max 3 cycles; a false block on test C (non-push command triggering checks) is a hard fail — fix the command match, never widen the skip
- **Stop condition**: A blocks, B allows, C allows fast, shellcheck clean

### Loop: tlv-scraper-fixtures
- **Trigger**: tlv-cap-graph-check + tlv-loop-template-v2 complete
- **Inner cycle**: Discover (fetch + save the four venues' HTML; read the extraction pipeline's entry points) → Test (author `expected.json` per venue BY HAND-READING the pages — this is the failing test; confirm `deno test` red) → Execute (wire fixtures.test.ts to the real pipeline; tolerant matcher) → Verify (green; corruption test red; fresh-context verifier)
- **Evaluator command**: `deno test supabase/functions/_shared/scraper/fixtures.test.ts`
- **Retry**: max 3 cycles; if the pipeline genuinely extracts wrong data from a fixture, that is a DEFECT — log it as a potential bug per /create-tests rules, do not bend expected.json to match broken output
- **Stop condition**: green suite + corruption test + verifier pass

---

## Section 4: Shared State

| Key | Type | Set by | Consumed by |
|-----|------|--------|-------------|
| dg_answers | map | Decision Gates | hook-removals, skill-removals, settings-rewire, zephyr-policy |
| removal_manifest | table | tlv-hook-audit | hook-removals, patterns-manifest-sync |
| target_settings | json | this doc (tlv-settings-rewire spec) | settings-rewire verify |
| adr_number | int | tlv-adr (ls docs/adr/) | runbook cross-reference |
| fixture_venues | list[4] | tlv-scraper-fixtures Discover | fixtures, gate-deno |
| soak_start | date | tlv-settings-rewire completion | tlv-promote trigger |

---

## Section 5: Build Phases

### Phase 0: Decisions
- [ ] DG-1 conversation-logger / search-knowledge
- [ ] DG-2 standup
- [ ] DG-3 Zephyr policy
- [ ] DG-4 notifier (executor-resolved)

### Phase 1: Hook removals  *(order-critical, single session)*
- [ ] tlv-hook-audit
- [ ] tlv-hook-removals
- [ ] tlv-patterns-manifest-sync  ← resurrection test gates this phase

### Phase 2: New hooks
- [ ] tlv-pre-push-gate
- [ ] tlv-status-digest
- [ ] tlv-hook-selftest
- [ ] tlv-settings-rewire

### Phase 3: Skills
- [ ] tlv-skill-merges
- [ ] tlv-skill-removals
- [ ] tlv-claude-md-update
- [ ] tlv-zephyr-policy (optional per DG-3)

### Phase 4: Loop System v2
- [ ] tlv-loop-template-v2
- [ ] tlv-testing-rule
- [ ] tlv-cap-graph-check
- [ ] tlv-security-review-wiring

### Phase 5: Fixtures
- [ ] tlv-scraper-fixtures
- [ ] tlv-gate-deno

### Phase 6: Docs + promotion
- [ ] tlv-adr
- [ ] tlv-runbook
- [ ] /docs-check → /cap
- [ ] tlv-promote (after soak)

---

## Section 6: Conventions, Verification, and Documentation Surface

**Execution path**: open this doc in Claude Code → resolve Section 0 with the author → execute phases in order using Section 3 loops → `/docs-check` → `/cap`. `/security-review` is not triggered (no auth/RLS/edge-input changes); `/create-tests` conventions govern the fixture test style.

**Semver**: **No version bump and no changelog entry.** Every change lands in `.claude/`, `docs/`, `~/Development/patterns/`, or test/fixture files. The only `supabase/functions/` paths touched are `__fixtures__/` and `fixtures.test.ts`, which the tlv-cap-graph-check amendment explicitly excludes from the bump requirement — which is why that node lands before fixtures. If fixtures somehow commit first, `/cap` will prompt for a bump; the author should choose skip.

**Expected /cap grouping** (approximate):
1. `chore(infra): consolidate hooks — remove 8, add pre-push gate + status digest` *(+ patterns-side edits noted in Why:)*
2. `chore(infra): merge retro/observe into evolution, implementation into new-feature; prune dormant skills`
3. `chore(infra): loop system v2 — executable evaluators, test-first cycle, frozen tests, fresh-context verify`
4. `chore(infra): /cap phase 1.6 graph check + versioning test-file exclusion`
5. `test(gateway): scraper fixture corpus — 4 venues + deno fixture suite`
6. `docs(adr): executable evaluators and test-first loops` / `docs(runbooks): loop-engineering`
7. `docs(claude-md): update skills table and hook documentation`

**Documentation surface** (per /docs-check mapping — stated explicitly): CLAUDE.md (skills table, hooks note, rules reference), `.claude/skills/{new-app,new-design,iterate,evolution,new-feature,cap}/skill.md`, `.claude/rules/{testing.md NEW, versioning.md}`, `docs/adr/000N NEW`, `.claude/runbooks/loop-engineering.md` NEW, this graph doc at `docs/graphs/toolchain-and-loop-v2.md`. **No feature docs and no design docs** — no user-facing behavior changes.

**Tooling gaps flagged**: `selftest.sh` is the new tool this spec proposes (lifecycle: manual + candidate for the pre-push gate in patterns repo itself). **Ripple/promote candidates**: pre-push-gate, status-digest, selftest, testing.md rule, Loop v2 templates — all sibling-valuable; handled by tlv-promote after soak.

**Out of scope** (deliberately): GitHub Actions CI mirror of the gate (add after gate soaks); Vercel preview-deploy branch workflow (a policy change — raise at Phase 6 pre-launch per git-manager's journal); cleaning already-installed retired hooks out of sibling projects; browser-bot QA integration for AOA.

---

## Section 7: Execution Notes

*(Executor appends here: Decision Gate answers, the removal manifest table from tlv-hook-audit, deviations, and attempts summaries.)*

---

## File Index

| File | Node | Action |
|------|------|--------|
| `.claude/hooks/orchestrator-init.sh` | tlv-hook-removals | Delete |
| `.claude/hooks/stuck-detector.sh` | tlv-hook-removals | Delete |
| `.claude/hooks/task-summary-reminder.sh` | tlv-hook-removals | Delete |
| `.claude/hooks/test-review-reminder.sh` | tlv-hook-removals | Delete |
| `.claude/hooks/context-stamp.sh` | tlv-hook-removals | Delete |
| `.claude/hooks/session-journal.sh` | tlv-hook-removals | Delete |
| `.claude/hooks/test-runner.sh` | tlv-hook-removals | Delete (logic → gate) |
| `.claude/hooks/conversation-logger.sh` | tlv-hook-removals | Per DG-1 |
| `.claude/hooks/completion-notification.sh` / `ghostty-done.sh` | tlv-hook-removals | Per DG-4 |
| `.claude/hooks/context-window.sh`, `cost-tracker.sh`, `docs-review-reminder.sh` | tlv-status-digest | Delete (merged) |
| `.claude/hooks/pre-push-gate.sh` | tlv-pre-push-gate | Create |
| `.claude/hooks/status-digest.sh` | tlv-status-digest | Create |
| `~/Development/patterns/ClaudeHooks/manifest.json` | tlv-patterns-manifest-sync | Modify |
| `~/Development/patterns/ClaudeHooks/selftest.sh` | tlv-hook-selftest | Create |
| `.claude/settings.json` | tlv-settings-rewire | Modify |
| `.claude/skills/{retro,observe,implementation,install-hooks,clio,teach-codebase}/` | tlv-skill-merges/-removals | Delete/archive |
| `.claude/skills/{evolution,new-feature}/skill.md` | tlv-skill-merges | Modify |
| `.claude/skills/{new-app,new-design,iterate}/skill.md` | tlv-loop-template-v2 | Modify |
| `.claude/skills/cap/skill.md` | tlv-cap-graph-check | Modify |
| `.claude/rules/testing.md` | tlv-testing-rule | Create |
| `.claude/rules/versioning.md` | tlv-cap-graph-check | Modify |
| `supabase/functions/_shared/scraper/__fixtures__/**` | tlv-scraper-fixtures | Create |
| `supabase/functions/_shared/scraper/fixtures.test.ts` | tlv-scraper-fixtures | Create |
| `docs/adr/000N-executable-evaluators-and-test-first-loops.md` | tlv-adr | Create |
| `.claude/runbooks/loop-engineering.md` | tlv-runbook | Create |
| `CLAUDE.md` | tlv-claude-md-update | Modify |
| `docs/graphs/toolchain-and-loop-v2.md` | (this doc) | Create |
