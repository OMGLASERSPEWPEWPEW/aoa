# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-16 — Optional-Param Backward Compatibility and Context Testing Gaps

### Situation

Six shared scraper modules were modified in the art-classes feature branch to accept optional parameters for class-domain support: `completeness-evaluator.ts` now takes optional `weights?`, `strategy-agent.ts` takes optional `StrategyProfile`, `targeted-prompt.ts` takes optional `includeClassFields?`, and the types file added four new optional fields (`instructor_name`, `skill_level`, `session_count`, `class_format`) to `Pass1Event`, `Pass2Verification`, and `TargetedEnrichment`. Zero new tests were written for any of these changes. Meanwhile, `ScrapeContext` grew a third domain (`classDiscovery` with `ClassDiscoveryProgress`) plus two new state slices and an SSE streaming handler, again with no test coverage. Four pre-existing test failures in `HouseChips.test.tsx` and `SeatingChart.test.tsx` remain unfixed because both components switched from inline `oklch()` values to CSS custom properties (`var(--accent)`, `var(--accent-border)`, etc.), which jsdom cannot resolve.

### Research: Optional-Param Backward Compatibility Testing

The key principle for testing functions that added optional parameters is **contract preservation**: the function must behave identically to its previous behavior when the new parameter is omitted. The testing pattern is:

1. **Default-path test**: Call the function without the new parameter. Assert the output matches the original behavior exactly. This is the backward compatibility guarantee.
2. **Explicit-default test**: Pass the old default value explicitly (e.g., `DEFAULT_FIELD_WEIGHTS`). Assert the output is identical to the no-argument call.
3. **New-path test**: Pass the new parameter value (e.g., `CLASS_FIELD_WEIGHTS`). Assert the changed behavior -- different scores, different `needsFollow` thresholds, different `missingFields` lists.
4. **Boundary test**: Verify edge cases specific to the new parameter -- empty weights map, weights with zero values, weights with fields not present on the event object.

For `evaluateCompleteness`, the concrete test matrix is: (a) theater event with no weights arg returns same score as with `DEFAULT_FIELD_WEIGHTS`, (b) class event with `CLASS_FIELD_WEIGHTS` includes `instructor_name` and `skill_level` in `missingFields`, (c) fully-complete class event with all optional fields filled scores 100%. For `shouldFollowLinks`, same principle: omitting `weights` uses theater defaults. For `mergeTargetedExtraction`, the new class fields (`instructor_name`, `skill_level`, `session_count`, `class_format`) should be tested: enrichment with class fields merges correctly, enrichment without class fields leaves them untouched.

### Research: React Context Testing with Extended State

`ScrapeContext` is a complex provider with three state domains, polling logic, and SSE streaming. Testing strategies for extended contexts:

1. **Render hook in isolation**: Use `renderHook(() => useScrape(), { wrapper: ScrapeProvider })` to test the context's initial state shape. Verify all three progress objects (`discovery`, `scraper`, `classDiscovery`) start at their idle defaults.
2. **Mock fetch for SSE**: The `runClassDiscovery` method reads `res.body.getReader()` for streaming. In tests, build a `ReadableStream` from NDJSON lines and return it from a mocked `fetch`. This lets you verify the state machine transitions: idle -> scraping -> (stream events) -> done.
3. **Guard clause**: `useScrape()` throws when used outside provider. Test this with `renderHook(() => useScrape())` and `expect(...).toThrow()`.
4. **Avoid testing the provider's internal wiring to Supabase** -- that is an integration concern. Focus on: (a) state shape correctness, (b) phase transitions, (c) error handling paths.

### The Stale Test Problem (HouseChips + SeatingChart)

Both components now use CSS custom properties. jsdom does not compute CSS custom properties -- `var(--accent)` passes through as a literal string. The tests assert `toContain('oklch')` which fails because the component now renders `var(--accent)`. Fix options: (a) assert `toContain('var(--accent)')` instead, (b) mock CSS custom properties via `document.documentElement.style.setProperty('--accent', 'oklch(...)')` in a `beforeEach`. Option (a) is simpler and tests the actual component output. Option (b) adds complexity for marginal gain since we are not testing the design system's color tokens.

### Commitments

1. **Fix stale tests first** -- update HouseChips and SeatingChart assertions to match current CSS-variable output. This restores the green baseline (112 tests passing, 0 failing).
2. **Write backward-compat tests for `completeness-evaluator.ts`** -- the most testable of the modified scraper modules because it is pure logic with no I/O. Cover: default weights path, class weights path, `mergeTargetedExtraction` with class fields, `averageCompleteness` with custom weights.
3. **Write initial state shape test for `ScrapeContext`** -- verify the `classDiscovery` slice exists with correct idle defaults when accessed via `useScrape()`.
4. **Skip `strategy-agent.ts` unit tests** -- it has heavy I/O (fetch + DeepSeek API) and would require mocking Deno runtime globals. ROI is low for unit tests; this is better covered by integration/smoke tests via curl.

### Priority Queue (next evolution)

- `offlineSync.ts` retry queue with exponential backoff (pure logic, high value)
- `useDiscoveryQueue` / `useHouseCheck` hooks (data transformation logic)
- `ClassDiscoveryDashboard` component tests (render states, conditional UI)
