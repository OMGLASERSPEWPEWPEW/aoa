# ADR 0011: Executable Evaluators and Test-First Loops

**Date:** 2026-08-21
**Status:** Accepted
**Feature:** Loop System v2 — toolchain consolidation

## Context

Loops with observation-based evaluators ("deploy and observe," "check in browser") shipped three consecutive firefighting releases (0.20.6–0.20.8): geocode stacking, chain fork bug (timeout-retry spawning parallel invocations), and cooldown trap. Each passed its evaluator at implementation time and failed in production.

Verification ran in the implementer's own context, which is biased toward the code it just wrote — the implementer reads their own changes as correct. Retry budgets had no ledger (enforced by memory, not by file). Per-turn reminder hooks (8 Stop hooks emitting systemMessages every response) produced alarm fatigue — the agent learned to ignore injections that fire unconditionally.

## Decision

1. **Evaluators must be executable commands** — a command whose exit code decides pass/fail, or a test file the runner executes. "Deploy and observe" is not an evaluator; it may appear only as a post-pass smoke step.

2. **Tests are written before implementation** (TDD-as-evaluator) — committed failing, then frozen during implementation. The implementation must not modify any test committed in the Test step. If a test turns out to be wrong, the implementer stops and surfaces it to the author for sign-off.

3. **Node completion requires fresh-context verification** — a cold Argus subagent with only the node spec, the diff, and the evaluator command. No implementation conversation. The verifier runs the evaluator itself and reads the diff independently.

4. **Data-shaped behavior gets fixtures** — input file + expected output file. The fixture test is the evaluator. "Too hard to test" resolves to "write the fixture," never to "observe in prod."

5. **Blocking pre-push gate** — typecheck + vitest + deno tests must pass before `git push`. Graceful degradation: only runs checks whose config exists.

6. **Reminder hook consolidation** — 8 unconditional Stop hooks replaced with one `status-digest` emitting a single ≤160-char line. Signal-to-noise ratio over volume.

7. **Attempts ledger** — `docs/graphs/attempts.jsonl` tracks every verify cycle with timestamps, node names, gate type, and result. Retry budgets are enforced by counting this file, not by memory.

## Alternatives Considered

- **Status quo** (deploy-and-observe evaluators) — rejected. Three consecutive releases of bugs those evaluators passed. The chain-fork bug (timeout-retry spawning parallel invocations) is invisible to observation and trivial for a fake-timer test.
- **Full CI-first** (GitHub Actions before local gates) — deferred. Local gate is cheaper and faster; CI can mirror it later.
- **Browser-bot QA squads** (Playwright for scraper verification) — deferred. Fixtures are cheaper and deterministic for extraction correctness.
- **Keeping all reminder hooks** — rejected. Injections that fire unconditionally are ignored unconditionally.

## Consequences

- **Positive:** Pushes get a quality floor (typecheck + tests). Bugs that survive testing are genuine misses, not skipped verification. Fresh-context verification catches the "implementer reads their own code as correct" bias. Attempts ledger creates a tamper-evident record.
- **Negative:** Pushes get slower by one typecheck + test run (deliberate trade — the three firefighting releases cost more time than every future gate run combined). The agent loses the ability to silently "fix" a red suite by editing tests.
- **Neutral:** Tests and fixtures excluded from version bumps. Sibling projects inherit the gate via promotion and must tolerate graceful degradation (checks only run if config files exist).
