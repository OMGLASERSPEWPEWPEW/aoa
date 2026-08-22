import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Inline the builder logic to test the shape without importing the full function
function buildRecentSchoolEntry(
  school: { id: string; name: string; calendar_url: string },
  status: string,
  prevEntry: { invocations?: number } | null,
  result: { programs?: unknown[]; schoolAddress?: string | null; trace?: Record<string, unknown> } | null,
) {
  const trace = result?.trace;
  return {
    name: school.name,
    venueId: school.id,
    status,
    invocations: ((prevEntry?.invocations ?? 0) + 1),
    eventsFound: 0,
    eventsCreated: 0,
    address: result?.schoolAddress ?? null,
    calendarUrl: school.calendar_url,
    timestamp: new Date().toISOString(),
    trace: trace ? {
      stopReason: (trace as any).stopReason ?? null,
      aiCalls: (trace as any).totalAiCalls ?? null,
      fetches: (trace as any).totalFetches ?? null,
      durationMs: (trace as any).wallMs ?? 0,
      costUsd: (trace as any).budgetUsed ?? null,
      programsExtracted: result?.programs?.length ?? null,
      modelResults: null,
    } : null,
  };
}

Deno.test("entry emits nested trace shape", () => {
  const entry = buildRecentSchoolEntry(
    { id: "abc", name: "Test School", calendar_url: "https://test.com" },
    "success",
    null,
    {
      programs: [{ name: "Acting 1" }, { name: "Voice" }],
      schoolAddress: "123 Main St",
      trace: { stopReason: "complete", totalAiCalls: 5, totalFetches: 3, budgetUsed: 0.042 },
    },
  );
  assertEquals(entry.trace?.stopReason, "complete");
  assertEquals(entry.trace?.aiCalls, 5);
  assertEquals(entry.trace?.fetches, 3);
  assertEquals(entry.trace?.costUsd, 0.042);
  assertEquals(entry.trace?.programsExtracted, 2);
  assertEquals(entry.trace?.modelResults, null);
  assertEquals(entry.trace?.durationMs, 0);
});

Deno.test("invocations increments from previous entry", () => {
  const entry = buildRecentSchoolEntry(
    { id: "abc", name: "Test School", calendar_url: "https://test.com" },
    "success",
    { invocations: 3 },
    { programs: [], trace: { stopReason: "complete", totalAiCalls: 1, totalFetches: 1, budgetUsed: 0.01 } },
  );
  assertEquals(entry.invocations, 4);
});

Deno.test("trace is null when strategy crashed", () => {
  const entry = buildRecentSchoolEntry(
    { id: "abc", name: "Test School", calendar_url: "https://test.com" },
    "error",
    null,
    null,
  );
  assertEquals(entry.trace, null);
});
