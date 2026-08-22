import { assertEquals, assertAlmostEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { CostBudget, CLASS_CRAWL_TOTALS, CLASS_INVOCATION_CAPS } from "./cost-budget.ts";

Deno.test("recordAiCall: gpt-4o-mini prices at 0.15/0.60 per 1M", () => {
  const b = new CostBudget();
  b.recordAiCall(1_000_000, 1_000_000, "gpt-4o-mini");
  assertAlmostEquals(b.spent, 0.75, 0.001);
});

Deno.test("recordAiCall: deepseek-chat prices at 0.27/1.10 per 1M", () => {
  const b = new CostBudget();
  b.recordAiCall(100_000, 50_000, "deepseek-chat");
  const expected = (100_000 * 0.27 + 50_000 * 1.1) / 1_000_000;
  assertAlmostEquals(b.spent, expected, 0.0001);
});

Deno.test("recordAiCall: omitted model defaults to deepseek-v4-flash", () => {
  const b = new CostBudget();
  b.recordAiCall(500_000, 200_000);
  const expected = (500_000 * 0.10 + 200_000 * 0.40) / 1_000_000;
  assertAlmostEquals(b.spent, expected, 0.0001);
});

Deno.test("usage sink receives per-call {model, inputTokens, outputTokens, costUsd}", () => {
  const b = new CostBudget();
  const calls: { model: string; inputTokens: number; outputTokens: number; costUsd: number }[] = [];
  b.attachUsageSink((u) => { calls.push(u); });
  b.recordAiCall(1000, 500, "gpt-4o-mini");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].model, "gpt-4o-mini");
  assertEquals(calls[0].inputTokens, 1000);
  assertEquals(calls[0].outputTokens, 500);
  assertAlmostEquals(calls[0].costUsd, (1000 * 0.15 + 500 * 0.6) / 1_000_000, 0.000001);
});

Deno.test("throwing sink does not throw out of recordAiCall", () => {
  const b = new CostBudget();
  b.attachUsageSink(() => { throw new Error("boom"); });
  b.recordAiCall(1000, 500, "gpt-4o-mini");
  assertEquals(b.aiCallsMade, 1);
});

Deno.test("token sums accumulate across calls", () => {
  const b = new CostBudget();
  b.recordAiCall(1000, 500, "gpt-4o-mini");
  b.recordAiCall(2000, 800, "deepseek-chat");
  assertEquals(b.inputTokens, 3000);
  assertEquals(b.outputTokens, 1300);
});

Deno.test("toJSON includes inputTokens and outputTokens", () => {
  const b = new CostBudget();
  b.recordAiCall(5000, 3000, "gpt-4o-mini");
  const j = b.toJSON();
  assertEquals(j.inputTokens, 5000);
  assertEquals(j.outputTokens, 3000);
  assertEquals(j.aiCalls, 1);
});

Deno.test("fromResumable still constrains by CLASS_INVOCATION_CAPS", () => {
  const b = CostBudget.fromResumable(CLASS_CRAWL_TOTALS, { fetches: 0, aiCalls: 0, usd: 0 });
  for (let i = 0; i < CLASS_INVOCATION_CAPS.maxAiCalls; i++) {
    b.recordAiCall(100, 50);
  }
  assertEquals(b.isExhausted(), true);
  assertEquals(b.stopReason, "budget_calls");
});
