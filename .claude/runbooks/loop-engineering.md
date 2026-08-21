# Loop Engineering Runbook

## Entry 1: Evaluators must be executable

**Wrong**: Evaluator = "deploy and test against <venue>" or "check in browser."
**Right**: Evaluator = a command or fixture test whose exit code decides pass/fail. Deploy is a post-pass smoke step only.
**Why**: 0.20.6–0.20.8 were three consecutive releases of bugs that observation-based evaluators passed. The chain-fork bug (timeout-retry spawning parallel invocations) is invisible to observation and trivial for a fake-timer test.

## Entry 2: Fresh context verifies, not the implementer

**Wrong**: The implementing context verifies its own node ("tests pass, looks good").
**Right**: Fresh-context subagent (Argus) runs the evaluator against the cold diff — no implementation conversation, just the spec + diff + evaluator command.
**Why**: The implementer's context reads its own changes as correct. A clean context catches missing conditions, untested branches, and assumptions baked into the implementation conversation that don't survive a cold read.

## Entry 3: Tests are frozen during implementation

**Wrong**: Agent edits a test to reach green, then reports "all tests pass."
**Right**: Tests committed failing before implementation, frozen during it. Changing a test requires author sign-off.
**Why**: The diff of committed tests is the tamper-evidence. Without it, green proves nothing — the agent can always make tests pass by rewriting them to match whatever it built. The commit history shows whether tests were written first or modified after.
